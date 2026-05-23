'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check, ExternalLink, Loader2, ShieldCheck, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BYOK_PROVIDERS,
  PROVIDERS,
  validateKeyFormat,
  type AiProvider,
} from '@/lib/ai/providers';
import { testApiKey } from '@/lib/ai/client';
import { AiCallError } from '@/lib/ai/errors';
import { showAiError } from '@/lib/ai/showAiError';
import { useApiKeyStore } from '@/store/api-key';
import { useHasMounted } from '@/hooks/useHasMounted';
import { cn } from '@/lib/utils';

/**
 * BYOK 키 입력 + 즉시 검증 폼.
 * 사용자 카드별로 키 발급 직링크, 가이드, 입력, 테스트, 삭제까지 한 화면에.
 *
 * UX 원칙 (CLAUDE.md ❿ BYOK UX 필수 요소):
 * - 키 발급 직링크
 * - "키는 이 기기에만 저장됩니다. 서버 전송 없음." 명시
 * - 키 입력 즉시 연결 테스트 → 성공/실패 피드백
 */

export function ApiKeyForm() {
  const mounted = useHasMounted();
  const { provider, keys, lastTestedAt, setProvider, setKey, clearKey, markTested } =
    useApiKeyStore();

  // 하이드레이션 전: null 반환 (CLAUDE.md ⓬ — 스켈레톤 로딩 금지).
  if (!mounted) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* 보안 안내 */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-2 p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-text">
            키는 이 기기에만 저장됩니다. 서버로 전송하지 않습니다.
          </p>
          <p className="text-xs leading-relaxed text-text-muted">
            모든 AI 호출은 브라우저에서 직접 공급사로 이루어집니다. COUNCIL 서버는
            당신의 키를 보지도, 저장하지도 않습니다.
          </p>
        </div>
      </div>

      {/* 공급사 카드 — 추천 순으로 */}
      {BYOK_PROVIDERS.map((p) => {
        // 이 카드 실패 시 fallback 후보: 다른 BYOK 공급사 중 키가 있는 첫 번째
        const alternate =
          BYOK_PROVIDERS.find((other) => other !== p && !!keys[other]) ?? null;
        return (
          <ProviderCard
            key={p}
            provider={p}
            selected={provider === p}
            savedKey={keys[p] ?? ''}
            testedAt={lastTestedAt[p]}
            alternateProvider={alternate}
            onSelect={() => setProvider(p)}
            onSave={(key) => {
              setKey(p, key);
              setProvider(p);
            }}
            onClear={() => clearKey(p)}
            onTested={() => markTested(p)}
            onSwitchProvider={(target) => setProvider(target)}
          />
        );
      })}
    </div>
  );
}

interface ProviderCardProps {
  provider: AiProvider;
  selected: boolean;
  savedKey: string;
  testedAt: string | undefined;
  /** quota 에러 시 1-click 전환 후보 (다른 공급사 키 등록돼 있을 때만 non-null) */
  alternateProvider: AiProvider | null;
  onSelect: () => void;
  onSave: (key: string) => void;
  onClear: () => void;
  onTested: () => void;
  onSwitchProvider: (target: AiProvider) => void;
}

function ProviderCard({
  provider,
  selected,
  savedKey,
  testedAt,
  alternateProvider,
  onSelect,
  onSave,
  onClear,
  onTested,
  onSwitchProvider,
}: ProviderCardProps) {
  const config = PROVIDERS[provider];
  const [draft, setDraft] = useState(savedKey);
  const [testing, setTesting] = useState(false);

  const hasKey = !!savedKey;
  const formatOk = validateKeyFormat(provider, draft);
  const dirty = draft !== savedKey;

  async function handleSave() {
    if (!formatOk) {
      toast.error('키 형식이 올바르지 않습니다. 다시 확인해주세요.');
      return;
    }
    setTesting(true);
    try {
      const result = await testApiKey(provider, draft);
      onSave(draft);
      onTested();
      const cachedNote = result.cached ? ' (캐시)' : '';
      toast.success(
        `${config.displayName} 연결 성공 (${result.latencyMs}ms${cachedNote}). BYOK 모드 활성화.`,
      );
    } catch (err) {
      if (err instanceof AiCallError) {
        showAiError(err, {
          alternateProvider,
          onSwitch: onSwitchProvider,
        });
      } else {
        toast.error(err instanceof Error ? err.message : '알 수 없는 오류');
      }
    } finally {
      setTesting(false);
    }
  }

  function handleClear() {
    onClear();
    setDraft('');
    toast.success(`${config.displayName} 키를 삭제했습니다.`);
  }

  return (
    <section
      className={cn(
        'rounded-xl border bg-surface p-5 transition-colors',
        selected && hasKey
          ? 'border-primary/60 glow-primary'
          : 'border-border',
      )}
      onClick={onSelect}
    >
      {/* 헤더 */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-text">{config.displayName}</h3>
          <p className="mt-1 text-xs text-text-muted">{config.freeTier}</p>
        </div>
        {hasKey && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary">
            <Check className="size-3.5" />
            연결됨
          </span>
        )}
      </div>

      {/* 가이드 + 발급 링크 */}
      <div className="mb-4 rounded-md border border-border bg-surface-2 p-3">
        <p className="text-xs leading-relaxed text-text-muted">
          {config.signupGuide}
        </p>
        <a
          href={config.signupUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          키 발급 페이지 열기
          <ExternalLink className="size-3.5" />
        </a>
      </div>

      {/* 입력 + 액션 */}
      <div className="space-y-2">
        <Label htmlFor={`apikey-${provider}`}>API 키</Label>
        <div className="flex gap-2">
          <Input
            id={`apikey-${provider}`}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={
              provider === 'gemini' ? 'AIzaSy...' : 'gsk_...'
            }
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={cn(
              'font-mono text-sm',
              draft.length > 0 && !formatOk && 'border-destructive focus-visible:border-destructive',
            )}
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            type="button"
            variant={dirty || !hasKey ? 'default' : 'secondary'}
            size="default"
            disabled={testing || !draft || (!dirty && hasKey)}
            onClick={(e) => {
              e.stopPropagation();
              void handleSave();
            }}
          >
            {testing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : hasKey && !dirty ? (
              '저장됨'
            ) : (
              '저장 + 테스트'
            )}
          </Button>
          {hasKey && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="키 삭제"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            >
              <Trash2 className="size-4 text-text-muted" />
            </Button>
          )}
        </div>

        {draft.length > 0 && !formatOk && (
          <p className="text-xs text-destructive">
            키 형식이 맞지 않습니다. ({provider === 'gemini' ? 'AIzaSy로 시작' : 'gsk_로 시작'})
          </p>
        )}
        {hasKey && testedAt && !dirty && (
          <p className="font-mono text-xs text-text-muted">
            마지막 연결 테스트: {new Date(testedAt).toLocaleString('ko-KR')}
          </p>
        )}
      </div>
    </section>
  );
}
