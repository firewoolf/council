'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, KeyRound } from 'lucide-react';

import { ConcernInput } from '@/components/session/ConcernInput';
import { PersonaPicker } from '@/components/session/PersonaPicker';
import { Button } from '@/components/ui/button';
import { recommendPersonas } from '@/lib/ai/client';
import { AiCallError } from '@/lib/ai/errors';
import {
  BYOK_PROVIDERS,
  listAvailableProviders,
  type AiProvider,
} from '@/lib/ai/providers';
import { runWithFallback } from '@/lib/ai/runWithFallback';
import { showAiError } from '@/lib/ai/showAiError';
import { PERSONA_MAP } from '@/lib/prompts/personas';
import {
  sanitizeRecommendedIds,
  sanitizeSelectedIds,
} from '@/lib/persona-safety';
import { useApiKeyStore } from '@/store/api-key';
import { useSessionsStore } from '@/store/sessions';
import { useHasMounted } from '@/hooks/useHasMounted';
import type { CastMember } from '@/types/persona';

const FACILITATOR_ID = 'facilitator';

type Step = 'input' | 'analyzing' | 'picking';

/**
 * 새 회의 시작 흐름.
 *
 * input → analyzing → picking → /session/[id]
 *
 * API 키가 없으면 처음부터 차단하고 설정 페이지로 안내한다.
 * recommendPersonas 가 실패하면 사용자에게 재시도 옵션을 준다.
 */
export default function NewSessionPage() {
  const router = useRouter();
  const mounted = useHasMounted();
  const { provider, getActiveKey, setProvider } = useApiKeyStore();
  const createSession = useSessionsStore((s) => s.createSession);

  const [step, setStep] = useState<Step>('input');
  const [concern, setConcern] = useState('');
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  // Phase A — 추천기가 배정한 personaId → stance. 회의 시작 시 createSession 에 전달.
  const [stances, setStances] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [domain, setDomain] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const apiKey = getActiveKey();
  const hasKey = mounted && !!apiKey && !!provider;

  /**
   * 추천 호출 + 자동 fallback 흐름.
   * 의존성을 setProvider 하나로 줄이기 위해, 호출 시점의 store 값을
   * useApiKeyStore.getState() 로 읽는다 — fallback 후 즉시 재호출 시에도 최신 값 보장.
   */
  const handleAnalyze = useCallback(
    async (text: string): Promise<void> => {
      const state = useApiKeyStore.getState();
      const available = listAvailableProviders(state.keys);
      if (available.length === 0) {
        toast.error('API 키가 필요합니다. 설정 페이지에서 먼저 등록해주세요.');
        return;
      }
      setConcern(text);
      setStep('analyzing');

      try {
        // Phase B 라우팅 + Phase C 자동 폴백:
        // 'recommend' 적합 공급사로 시도 → quota면 다른 공급사로 1회 재시도.
        const { result } = await runWithFallback(
          'recommend',
          state.keys,
          (provider, apiKey) =>
            recommendPersonas({ provider, apiKey, concern: text }),
        );

        // B-4 안전망: 모델이 환각 id 또는 어드민 삭제 직후 stale id 를 줄 수 있다.
        // 알려진 id 만 통과시키고 부족분은 무작위 보충.
        const rawIds = result.recommended.map((r) => r.personaId);
        const safe = sanitizeRecommendedIds(rawIds);
        if (safe.dropped.length > 0) {
          toast.info(
            `삭제됐거나 알 수 없는 페르소나 ${safe.dropped.length}명 → 다른 페르소나로 대체`,
            { duration: 5_000 },
          );
        }
        // reasonMap + stanceMap 도 정리 — drop 된 id 는 함께 제거.
        // filled 된 id 는 stance/reason 없음(중립). 토론 시 stance 빈 문자열로 처리됨.
        const survivingRecs = result.recommended.filter((r) =>
          safe.ids.includes(r.personaId),
        );
        const reasonMap = Object.fromEntries(
          survivingRecs.map((r) => [r.personaId, r.reason]),
        );
        const stanceMap = Object.fromEntries(
          survivingRecs.map((r) => [r.personaId, r.stance]),
        );

        // 사회자는 항상 자동 포함
        const initialSelection = [...new Set([...safe.ids, FACILITATOR_ID])];

        setRecommendedIds(safe.ids);
        setReasons(reasonMap);
        setStances(stanceMap);
        setDomain(result.detectedDomain ?? null);
        setSelectedIds(initialSelection);
        setStep('picking');
      } catch (err) {
        setStep('input');
        if (err instanceof AiCallError) {
          // Phase C 자동 폴백 후에도 실패한 경우 = 모든 BYOK 공급사가 막힘.
          // err.provider 는 마지막으로 실패한 공급사. 그 외 등록된 키 중에
          // 토론에선 안 써본 공급사가 있으면 사용자 동의 후 전환 토스트로 안내.
          const altProvider: AiProvider | null =
            BYOK_PROVIDERS.find(
              (p) => p !== err.provider && !!state.keys[p],
            ) ?? null;
          showAiError(err, {
            alternateProvider: altProvider,
            onSwitch: (target) => {
              setProvider(target);
              void handleAnalyze(text);
            },
          });
        } else {
          const msg = err instanceof Error ? err.message : '알 수 없는 오류';
          toast.error(`추천 실패: ${msg}`);
        }
      }
    },
    [setProvider],
  );

  const handleToggle = useCallback((personaId: string) => {
    if (personaId === FACILITATOR_ID) {
      toast.info('사회자는 항상 참여합니다.');
      return;
    }
    setSelectedIds((prev) =>
      prev.includes(personaId)
        ? prev.filter((id) => id !== personaId)
        : [...prev, personaId],
    );
  }, []);

  const handleStart = useCallback(() => {
    if (!provider) {
      toast.error('AI 공급사가 선택되지 않았습니다.');
      return;
    }
    const safe = sanitizeSelectedIds(selectedIds);
    if (safe.dropped.length > 0) {
      toast.info(
        `선택했던 페르소나 중 ${safe.dropped.length}명이 더 이상 존재하지 않아 제외했습니다.`,
        { duration: 5_000 },
      );
    }
    if (safe.ids.length < 2) {
      toast.error('최소 2명 이상 선택해주세요.');
      return;
    }
    // Phase B — 아키타입 id 배열 → CastMember[] 변환.
    // id 는 아키타입 id 그대로(§4.3) 사용해 옛 messages.speakerId 호환.
    const cast: CastMember[] = [];
    for (const id of safe.ids) {
      const arch = PERSONA_MAP[id];
      if (!arch) continue;
      cast.push({
        id,
        source: 'archetype',
        archetypeId: id,
        name: arch.name,
        role: arch.role,
        temperament: arch.temperament,
        stance: stances[id] ?? '',
        colorFrom: arch.colorFrom,
        colorTo: arch.colorTo,
        isFacilitator: id === FACILITATOR_ID,
      });
    }
    const session = createSession({
      concern,
      cast,
      aiProvider: provider,
      domain,
    });
    router.push(`/session/${session.id}`);
  }, [provider, selectedIds, concern, domain, stances, createSession, router]);

  // 마운트 전: 깜빡임 방지용 빈 컨테이너
  if (!mounted) {
    return <div className="min-h-[60vh]" aria-hidden />;
  }

  // 키 없음 → 차단
  if (!hasKey) {
    return (
      <section className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
        <KeyRound className="size-12 text-accent" />
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-text">API 키가 필요합니다</h1>
          <p className="max-w-prose text-sm leading-relaxed text-text-muted">
            COUNCIL은 당신의 키로 직접 AI를 호출합니다. 30초면 무료 키 발급이
            끝나요.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="size-4" /> 홈으로
            </Link>
          </Button>
          <Button asChild>
            <Link href="/settings">키 설정하러 가기</Link>
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-8 pt-4">
      {step === 'input' && (
        <ConcernInput
          busy={false}
          defaultValue={concern}
          onSubmit={handleAnalyze}
        />
      )}
      {step === 'analyzing' && (
        <ConcernInput busy={true} defaultValue={concern} onSubmit={() => {}} />
      )}
      {step === 'picking' && (
        <PersonaPicker
          recommendedIds={recommendedIds}
          reasons={reasons}
          stances={stances}
          domain={domain}
          selectedIds={selectedIds}
          onToggle={handleToggle}
          onStart={handleStart}
        />
      )}
    </div>
  );
}
