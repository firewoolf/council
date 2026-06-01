import type { CastMember } from '@/types/persona';

/**
 * ⑤-5e — 사회자 모두 발언 텍스트 생성.
 *
 * concern 을 그대로 활용 + 템플릿 박제. LLM 호출 0.
 * 굴복 금지 톤 — '안심시키는 인사' 가 아닌 '의제를 박제하는 사회자'.
 *
 * ⚠️  부록 A Opus 박제 — 본문 임의 수정 금지.
 *     "직답을 주는 게 아니라" 한 줄이 굴복 금지 톤의 핵심.
 */
export function generateIntroStatement(
  concern: string,
  facilitator: CastMember | null,
): string {
  const name = facilitator?.name ?? '사회자';
  // concern 길이별 분기 — 짧은 고민은 그대로 인용, 긴 고민은 첫 한 문장만.
  const firstSentence =
    concern.length <= 80
      ? concern.trim()
      : concern
          .split(/[.!?。\n]/)
          .map((s) => s.trim())
          .filter(Boolean)[0]
          ?.slice(0, 80) ?? concern.slice(0, 80);

  return `오늘 ${name} 가 진행을 맡습니다. 사용자가 들고 온 고민은 이겁니다 — "${firstSentence}". 이 자리에서 패널이 *직답을 주는 게 아니라*, 무엇이 진짜 결정해야 할 지점인지 함께 갈라봅니다. 시작합니다.`;
}
