/**
 * AiCallError → 사용자 토스트 통합 헬퍼.
 *
 * 호출자가 kind 별로 토스트를 따로 짜지 않도록 한 곳에 모은다.
 * 다른 공급사 키가 있으면 "전환" 액션을 자동 첨부 — 키 한도 막혔을 때
 * 한 번의 클릭으로 우회 가능하게.
 */

import { toast } from 'sonner';

import { PROVIDERS, type AiProvider } from './providers';
import type { AiCallError } from './errors';

export interface ShowAiErrorContext {
  /**
   * 현재 실패한 공급사 외에 사용 가능한 다른 BYOK 공급사.
   * (해당 공급사 키가 store에 저장돼 있어야 의미 있음.)
   * 없으면 null.
   */
  alternateProvider: AiProvider | null;

  /**
   * 사용자가 "전환" 액션 버튼을 눌렀을 때 호출.
   * 보통 setProvider 후 직전 동작을 재시도한다.
   */
  onSwitch?: (provider: AiProvider) => void;
}

export function showAiError(err: AiCallError, ctx: ShowAiErrorContext): void {
  const altName = ctx.alternateProvider
    ? PROVIDERS[ctx.alternateProvider].displayName
    : null;

  // 한도 초과 + 다른 공급사 키 있음 → 1-click 전환 토스트
  if (err.kind === 'quota' && ctx.alternateProvider && ctx.onSwitch && altName) {
    const alt = ctx.alternateProvider;
    const onSwitch = ctx.onSwitch;
    toast.error(err.message, {
      description: `${altName} 키도 등록돼 있습니다. 전환해서 계속할 수 있어요.`,
      action: {
        label: `${altName}로 전환`,
        onClick: () => onSwitch(alt),
      },
      duration: 10_000,
    });
    return;
  }

  // 한도 초과 + 다른 공급사 키 없음 → 설정 페이지 안내
  if (err.kind === 'quota') {
    toast.error(err.message, {
      description:
        '잠시 후 다시 시도하거나, /settings 에서 다른 공급사 키를 등록하세요.',
      duration: 8_000,
    });
    return;
  }

  if (err.kind === 'invalid_key') {
    toast.error(err.message, {
      description: '/settings 에서 키를 다시 확인해주세요.',
      duration: 8_000,
    });
    return;
  }

  if (err.kind === 'network') {
    toast.error(err.message, { duration: 6_000 });
    return;
  }

  toast.error(err.message, { duration: 6_000 });
}
