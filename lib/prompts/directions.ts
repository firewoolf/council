/**
 * 트랙 ③ — 카드별 디렉션 포맷 헬퍼.
 *
 * formatDirection: Opus 박제 본문 (부록 A) — Sonnet 임의 수정 금지.
 * getDirectionLabel: 토스트 텍스트용 한국어 라벨.
 */

import type { DirectionAction } from '@/types/debate';
import type { CastMember } from '@/types/persona';

/**
 * 디렉션 액션을 transcript 주입용 시스템 지시 문자열로 변환.
 *
 * 굴복 금지 가드("인신공격이 아니다" 등)가 본문 안에 포함돼 있어
 * 페르소나가 디렉션을 받아도 *자기 입장* 을 지킨다.
 *
 * ⚠️ 이 본문은 Opus 가 박제한 원문 — 임의 수정 금지.
 */
export function formatDirection(
  action: DirectionAction,
  cast: readonly CastMember[],
): string {
  const find = (id: string) => cast.find((c) => c.id === id)?.name ?? '???';
  const target = find(action.targetMemberId);
  switch (action.kind) {
    case 'tighten':
      return `- "${target}" 에게: 다음 발언을 *더 세게* 만들 것. 에두르지 말고 직설적으로 — 핵심 단언 하나를 박아라.`;
    case 'specify':
      return `- "${target}" 에게: 근거를 *더 구체적* 으로 — 추정치라도 숫자·사례·시나리오 중 최소 하나를 박을 것.`;
    case 'reframe':
      return `- "${target}" 에게: 같은 입장을 *다른 각도* 에서 다시 — 새 프레임으로 같은 결론을 재구성하라.`;
    case 'rebut': {
      const by = find(action.byMemberId);
      return `- "${by}" 가 "${target}" 의 위 발언에 *정면 반박* 하도록 — 가장 약한 지점을 찌른다. 'rebut' 의 본질은 *논리의 공격* 이지 인신공격이 아니다.`;
    }
    case 'ask-user':
      return `- "${target}" 가 사용자에게 *날카로운 질문* 을 던지도록 — 사용자가 못 보았던 가정을 흔드는 한 줄.`;
  }
}

/** 디렉션 전송 시 토스트에 표시할 한국어 라벨. */
export function getDirectionLabel(
  action: DirectionAction,
  cast: readonly CastMember[],
): string {
  const find = (id: string) => cast.find((c) => c.id === id)?.name ?? '???';
  const target = find(action.targetMemberId);
  switch (action.kind) {
    case 'tighten':  return `디렉션 → ${target}: 더 세게`;
    case 'specify':  return `디렉션 → ${target}: 근거 구체적으로`;
    case 'reframe':  return `디렉션 → ${target}: 다른 각도로`;
    case 'rebut': {
      const by = find(action.byMemberId);
      return `디렉션: ${by} 가 ${target} 에 반박`;
    }
    case 'ask-user': return `디렉션 → ${target}: 사용자에게 질문`;
  }
}
