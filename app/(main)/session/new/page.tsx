'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, KeyRound } from 'lucide-react';

import { ConcernClarify } from '@/components/session/ConcernClarify';
import { ConcernInput } from '@/components/session/ConcernInput';
import {
  PersonaPicker,
  type CustomPersonaInput,
} from '@/components/session/PersonaPicker';
import { TopicSuggestions } from '@/components/session/TopicSuggestions';
import { Button } from '@/components/ui/button';
import { clarifyConcern, designPanel } from '@/lib/ai/client';
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
  ensureFacilitator,
  sanitizePanel,
  LENS_COLORS,
} from '@/lib/persona-safety';
import {
  synthesizeCharacterPrompt,
  synthesizeVoiceCard,
} from '@/lib/prompts/synthesize';
import { composeConcern, type ClarifyQuestion } from '@/lib/prompts/concern-shaping';
import { buildMirrorContext, computeMirrorStats } from '@/lib/mirror/stats';
import {
  clearEmbedSeed,
  isEmbedded,
  readEmbedSeed,
  type EmbedSource,
} from '@/lib/embed/protocol';
import {
  augmentConcernWithMi,
  buildMiContext,
  loadMiBundle,
} from '@/lib/mi/client';
import { isMiBundleEmpty, type MiBundle } from '@/lib/mi/types';
import { resolveKeys } from '@/lib/ai/access';
import { useApiKeyStore } from '@/store/api-key';
import { useEmbedAuthStore } from '@/store/embed-auth';
import { useProfileStore } from '@/store/profile';
import { useSessionsStore } from '@/store/sessions';
import { useHasMounted } from '@/hooks/useHasMounted';
import type { CastMember, Lens, Trait } from '@/types/persona';

type Step = 'input' | 'clarifying' | 'analyzing' | 'picking';

/**
 * 새 회의 시작 흐름.
 *
 * input → analyzing → picking → /session/[id]
 *
 * Phase B-2 §5.6 — state 압축: cast / reasons / domain 세 개만.
 * 토글 선택 개념 폐기 — cast 가 곧 패널.
 */
export default function NewSessionPage() {
  const router = useRouter();
  const mounted = useHasMounted();
  const { provider, getActiveKey, setProvider } = useApiKeyStore();
  const createSession = useSessionsStore((s) => s.createSession);

  const [step, setStep] = useState<Step>('input');
  // 임베드(insight-out) 컨텍스트 주입 — 고민/근거 소스를 초기 렌더에 프리필.
  const [concern, setConcern] = useState<string>(() => readEmbedSeed()?.concern ?? '');
  const [embedSources] = useState<EmbedSource[]>(() => readEmbedSeed()?.sources ?? []);
  const [clarifyQuestions, setClarifyQuestions] = useState<ClarifyQuestion[]>([]);
  const [clarifyLoading, setClarifyLoading] = useState(false);
  const [cast, setCast] = useState<CastMember[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [domain, setDomain] = useState<string | null>(null);

  // MI(insight-out) 근거 — 임베드 모드면 기본 사용. 로드 후 패널 설계·토론에 주입.
  const [useMi, setUseMi] = useState<boolean>(() => isEmbedded());
  const [miBundle, setMiBundle] = useState<MiBundle | null>(null);
  const [miContext, setMiContext] = useState<string | undefined>(undefined);

  const apiKey = getActiveKey();
  // 서버 모드(임베드 로그인)면 BYOK 키 없이도 통과.
  const serverMode = useEmbedAuthStore(
    (s) => !!s.ticket && s.serverProviders.length > 0,
  );
  const hasKey = mounted && (serverMode || (!!apiKey && !!provider));

  // 주입된 컨텍스트는 초기 state 로 소비했으니 즉시 삭제 — 재진입 시 오염 방지.
  useEffect(() => {
    clearEmbedSeed();
  }, []);

  /**
   * 추천 호출 + 자동 fallback 흐름.
   * 의존성을 setProvider 하나로 줄이기 위해, 호출 시점의 store 값을
   * useApiKeyStore.getState() 로 읽는다 — fallback 후 즉시 재호출 시에도 최신 값 보장.
   */
  const handleAnalyze = useCallback(
    async (text: string): Promise<void> => {
      const state = useApiKeyStore.getState();
      const activeKeys = resolveKeys();
      const available = listAvailableProviders(activeKeys);
      if (available.length === 0) {
        toast.error('API 키가 필요합니다. 설정 페이지에서 먼저 등록해주세요.');
        return;
      }
      setConcern(text);
      setStep('analyzing');

      // MI 근거 로드 (설정·임베드 시). 실패해도 토론은 MI 없이 진행.
      let designConcern = text;
      let bundle = miBundle;
      if (useMi && !bundle) {
        try {
          const res = await loadMiBundle(text);
          if (res.configured && !isMiBundleEmpty(res.bundle)) {
            bundle = res.bundle;
            setMiBundle(res.bundle);
            setMiContext(buildMiContext(res.bundle));
          }
        } catch {
          /* MI 없이 계속 */
        }
      }
      if (bundle && !isMiBundleEmpty(bundle)) {
        designConcern = augmentConcernWithMi(text, bundle);
      }

      try {
        const { result } = await runWithFallback(
          'recommend',
          activeKeys,
          (provider, apiKey) =>
            designPanel({ provider, apiKey, concern: designConcern }),
        );

        const { cast: sanitized, notes } = sanitizePanel(result.panel);
        if (notes.length > 0) {
          toast.info(notes.join(' / '), { duration: 5_000 });
        }

        const withFacilitator = ensureFacilitator(sanitized);

        // archetype 멤버에 대한 추천 사유 맵
        const reasonMap: Record<string, string> = {};
        for (const raw of result.panel) {
          if (raw.source === 'archetype' && raw.archetypeId && raw.reason) {
            reasonMap[raw.archetypeId] = raw.reason;
          }
        }

        setCast(withFacilitator);
        setReasons(reasonMap);
        setDomain(result.detectedDomain ?? null);
        setStep('picking');
      } catch (err) {
        setStep('input');
        if (err instanceof AiCallError) {
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
    [setProvider, useMi, miBundle],
  );

  /** I-1 — "AI와 다듬기" 클릭 시 역질문 생성. 실패 시 analyzing 직행. */
  const handleClarify = useCallback(
    async (text: string): Promise<void> => {
      const state = useApiKeyStore.getState();
      const activeKeys = resolveKeys();
      const available = listAvailableProviders(activeKeys);
      if (available.length === 0) {
        toast.error('API 키가 필요합니다. 설정 페이지에서 먼저 등록해주세요.');
        return;
      }
      setConcern(text);
      setClarifyLoading(true);
      setStep('clarifying');
      try {
        const sessionsState = useSessionsStore.getState();
        const profileState = useProfileStore.getState();
        const mirror = buildMirrorContext(
          computeMirrorStats(
            sessionsState.sessionChunks ?? {},
            sessionsState.conclusions,
          ),
          profileState.observedPatterns,
        );
        const prov =
          state.provider && activeKeys[state.provider]
            ? state.provider
            : available[0]!;
        const result = await clarifyConcern({
          provider: prov,
          apiKey: activeKeys[prov] ?? '',
          concern: text,
          mirror,
        });
        setClarifyQuestions(result.questions);
      } catch {
        toast.info('역질문 생성 실패 — 바로 시작합니다.');
        void handleAnalyze(text);
      } finally {
        setClarifyLoading(false);
      }
    },
    [handleAnalyze],
  );

  /** I-1 — "이대로 토론 시작": answers → composeConcern → analyzing. */
  const handleClarifySubmit = useCallback(
    (answers: { question: string; answer: string }[]) => {
      const composed = composeConcern(concern, answers);
      void handleAnalyze(composed);
    },
    [concern, handleAnalyze],
  );

  const handleRemove = useCallback((memberId: string) => {
    setCast((prev) =>
      prev.filter((m) => m.isFacilitator || m.id !== memberId),
    );
  }, []);

  const handleSwap = useCallback(
    (memberId: string, newArchetypeId: string) => {
      const arch = PERSONA_MAP[newArchetypeId];
      if (!arch) return;
      setCast((prev) =>
        prev.map((m) => {
          if (m.id !== memberId || m.source !== 'archetype') return m;
          return {
            id: newArchetypeId,
            source: 'archetype',
            archetypeId: newArchetypeId,
            name: arch.name,
            role: arch.role,
            trait: arch.trait,
            stance: m.stance, // 입장 유지 (사용자가 그 입장의 다른 캐릭터를 원한다고 가정)
            colorFrom: arch.colorFrom,
            colorTo: arch.colorTo,
          };
        }),
      );
    },
    [],
  );

  const handleAddFromPool = useCallback((archetypeId: string) => {
    const arch = PERSONA_MAP[archetypeId];
    if (!arch) return;
    setCast((prev) => {
      if (prev.some((m) => m.archetypeId === archetypeId)) return prev;
      return [
        ...prev,
        {
          id: archetypeId,
          source: 'archetype',
          archetypeId,
          name: arch.name,
          role: arch.role,
          trait: arch.trait,
          stance: '',
          colorFrom: arch.colorFrom,
          colorTo: arch.colorTo,
        },
      ];
    });
  }, []);

  const handleAddCustom = useCallback((input: CustomPersonaInput) => {
    const colors = LENS_COLORS[input.trait.lens];
    const newMember: CastMember = {
      id:
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      source: 'custom',
      name: input.name,
      role: input.role,
      trait: input.trait,
      stance: input.stance,
      colorFrom: colors.from,
      colorTo: colors.to,
      characterPrompt: synthesizeCharacterPrompt(input),
      voiceCard: synthesizeVoiceCard(input),
    };
    setCast((prev) => [...prev, newMember]);
    toast.success(`${newMember.name} 추가됨`);
  }, []);

  const handleTraitChange = useCallback(
    (memberId: string, axis: keyof Trait, newValue: string) => {
      setCast((prev) =>
        prev.map((m) => {
          if (m.id !== memberId) return m;
          const trait = { ...m.trait, [axis]: newValue };
          const colors =
            axis === 'lens'
              ? LENS_COLORS[newValue as Lens]
              : { from: m.colorFrom, to: m.colorTo };
          return { ...m, trait, colorFrom: colors.from, colorTo: colors.to };
        }),
      );
    },
    [],
  );

  const handleStart = useCallback(() => {
    // 서버 모드면 provider store 가 비어있을 수 있어 서버 공급사로 폴백.
    const activeKeys = resolveKeys();
    const effectiveProvider =
      provider ?? ((Object.keys(activeKeys)[0] as AiProvider | undefined) ?? null);
    if (!effectiveProvider) {
      toast.error('AI 공급사가 선택되지 않았습니다.');
      return;
    }
    if (cast.length < 2) {
      toast.error('최소 2명 이상 참여해야 합니다.');
      return;
    }
    const session = createSession({
      concern,
      cast,
      aiProvider: effectiveProvider,
      domain,
      miContext,
    });
    router.push(`/session/${session.id}`);
  }, [provider, cast, concern, domain, miContext, createSession, router]);

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
      {/* 레벨 1+2 — MI 능동 주제 제안. insight-out 임베드 전용(특화) — 단독 council 엔 안 뜬다.
          클릭 시 그 주제로 바로 토론 시작. */}
      {step === 'input' && isEmbedded() && (
        <TopicSuggestions onPick={(topic) => void handleAnalyze(topic)} />
      )}
      {step === 'input' && embedSources.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
            insight-out MI 컨텍스트 연결됨
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {embedSources.map((s, i) => (
              <li key={i} className="text-sm text-text/90">
                {s.url ? (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline decoration-primary/40 underline-offset-2 hover:text-primary"
                  >
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {step === 'input' && (
        <label className="flex items-center gap-2.5 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text/90">
          <input
            type="checkbox"
            checked={useMi}
            onChange={(e) => setUseMi(e.target.checked)}
            className="size-4 accent-primary"
          />
          <span>
            insight-out 마켓 인텔리전스 근거로 패널 구성·토론
            {miBundle && !isMiBundleEmpty(miBundle) && (
              <span className="ml-1 text-xs text-primary">
                · 콘텐츠 {miBundle.contents.length} · 이슈{' '}
                {miBundle.issues.length} · 경쟁사{' '}
                {miBundle.entities.filter((e) => e.isCompetitor).length} 연결됨
              </span>
            )}
          </span>
        </label>
      )}
      {step === 'input' && (
        <ConcernInput
          busy={false}
          defaultValue={concern}
          onClarify={handleClarify}
          onSubmit={handleAnalyze}
        />
      )}
      {step === 'clarifying' && (
        <ConcernClarify
          rawConcern={concern}
          questions={clarifyQuestions}
          loading={clarifyLoading}
          onSubmit={handleClarifySubmit}
          onSkip={() => void handleAnalyze(concern)}
        />
      )}
      {step === 'analyzing' && (
        <ConcernInput busy={true} defaultValue={concern} onSubmit={() => {}} />
      )}
      {step === 'picking' && (
        <PersonaPicker
          cast={cast}
          reasons={reasons}
          domain={domain}
          onRemove={handleRemove}
          onSwap={handleSwap}
          onAddFromPool={handleAddFromPool}
          onAddCustom={handleAddCustom}
          onTraitChange={handleTraitChange}
          onStart={handleStart}
        />
      )}
    </div>
  );
}
