'use client';

import Link from 'next/link';
import { ArrowRight, KeyRound } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { useApiKeyStore } from '@/store/api-key';
import { PROVIDERS } from '@/lib/ai/providers';
import { useHasMounted } from '@/hooks/useHasMounted';

/**
 * 홈 히어로.
 * - API 키가 있으면: "새 회의 시작" CTA → /session/new
 * - API 키가 없으면: "API 키 먼저 설정" CTA → /settings
 *
 * 클라이언트 컴포넌트인 이유: useApiKeyStore가 LocalStorage 의존.
 * useHasMounted 가드로 SSR/Client 하이드레이션 불일치 방지.
 */

export function HomeHero() {
  const mounted = useHasMounted();
  const { provider, getActiveKey } = useApiKeyStore();
  const hasKey = mounted && !!getActiveKey();
  const providerName =
    mounted && provider ? PROVIDERS[provider].displayName : null;

  return (
    <section className="flex flex-col gap-8 pt-6 sm:pt-12">
      <div className="space-y-4">
        <h1 className="font-sans text-4xl font-black leading-[1.1] tracking-tight text-text sm:text-6xl">
          가장 단단한 결론은,
          <br />
          <span className="text-primary">서로 다른 시각의 충돌에서 나옵니다.</span>
        </h1>
        <p className="max-w-prose text-base leading-relaxed text-text-muted sm:text-lg">
          냉정한 투자자, 독설가 개발자, 잡스형 디자이너 — 그리고 당신이 부르는 레전드까지.
          전문가 패널이 서로 다른 관점으로 당신의 고민을 검증하고 결론을 함께 만듭니다.
          아부 대신, 팩트와 직설로.
        </p>
      </div>

      {hasKey ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link href="/session/new">
              새 회의 시작하기
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          {providerName && (
            <span className="font-mono text-xs text-text-muted sm:ml-2">
              현재 공급사: {providerName}
            </span>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-accent/40 bg-accent/5 p-5">
          <div className="flex items-start gap-3">
            <KeyRound className="mt-0.5 size-5 shrink-0 text-accent" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-text">
                먼저 API 키를 설정해야 합니다.
              </p>
              <p className="text-xs leading-relaxed text-text-muted">
                COUNCIL은 당신의 키로 AI를 직접 호출합니다. Gemini 또는 Groq 무료
                키로 시작할 수 있습니다 (30초).
              </p>
            </div>
          </div>
          <Button asChild size="default" variant="default" className="self-start">
            <Link href="/settings">
              키 설정 페이지로 가기
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
