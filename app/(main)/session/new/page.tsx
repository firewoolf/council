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
import { BYOK_PROVIDERS, type AiProvider } from '@/lib/ai/providers';
import { showAiError } from '@/lib/ai/showAiError';
import { useApiKeyStore } from '@/store/api-key';
import { useSessionsStore } from '@/store/sessions';
import { useHasMounted } from '@/hooks/useHasMounted';

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
      const currentProvider = state.provider;
      const currentKey = currentProvider ? state.keys[currentProvider] : null;
      if (!currentProvider || !currentKey) {
        toast.error('API 키가 필요합니다. 설정 페이지에서 먼저 등록해주세요.');
        return;
      }
      setConcern(text);
      setStep('analyzing');

      try {
        const result = await recommendPersonas({
          provider: currentProvider,
          apiKey: currentKey,
          concern: text,
        });

        const recIds = result.recommended.map((r) => r.personaId);
        const reasonMap = Object.fromEntries(
          result.recommended.map((r) => [r.personaId, r.reason]),
        );

        // 사회자는 항상 자동 포함
        const initialSelection = [...new Set([...recIds, FACILITATOR_ID])];

        setRecommendedIds(recIds);
        setReasons(reasonMap);
        setDomain(result.detectedDomain ?? null);
        setSelectedIds(initialSelection);
        setStep('picking');
      } catch (err) {
        setStep('input');
        if (err instanceof AiCallError) {
          // fallback 후보: 다른 BYOK 공급사 중 키 등록된 첫 번째
          const altProvider: AiProvider | null =
            BYOK_PROVIDERS.find(
              (p) => p !== currentProvider && !!state.keys[p],
            ) ?? null;
          showAiError(err, {
            alternateProvider: altProvider,
            onSwitch: (target) => {
              setProvider(target);
              // setProvider 즉시 반영 → 다음 줄 getState 로 새 값 읽음
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
    if (selectedIds.length < 2) {
      toast.error('최소 2명 이상 선택해주세요.');
      return;
    }
    const session = createSession({
      concern,
      personaIds: selectedIds,
      aiProvider: provider,
      domain,
    });
    router.push(`/session/${session.id}`);
  }, [provider, selectedIds, concern, domain, createSession, router]);

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
          domain={domain}
          selectedIds={selectedIds}
          onToggle={handleToggle}
          onStart={handleStart}
        />
      )}
    </div>
  );
}
