/**
 * 토론 오케스트레이터 — 트랙 ⑤-1 청크 엔진.
 *
 * 변경 (트랙 ⑤-1):
 *   - per-turn 루프(decideNextSpeaker + buildDebateContext) 은퇴.
 *   - 한 호출 = 한 청크(3~5턴짜리 미니 장면) 생성.
 *   - 발언 순서·반박 연결은 청크 프롬프트 안에서 모델이 연출한다.
 *
 * 잔존:
 *   - conclusionSchema · buildConclusionPrompt — 결론 생성은 그대로.
 *     messages 를 평면으로 받으므로 청크 도입 후에도 동작.
 */

import { z } from 'zod';

import type { Message } from '@/types/debate';
import type { CastMember } from '@/types/persona';

/**
 * 트랙 ② — 결정 지도 갈림 지점.
 * 패널이 끝내 합의하지 못한 핵심 분기. 각 입장마다 어느 멤버인지 명시.
 */
export interface DividedPoint {
  /** 갈린 지점의 주제 한 줄 */
  topic: string;
  /** 각 입장 — 어느 멤버가 어느 쪽인지 */
  positions: { side: string; memberIds: string[] }[];
}

/**
 * 결론 통합 타입.
 *
 * v1 (옛 4섹션) — 기존 세션 호환을 위해 옵셔널 유지.
 * v2 (트랙 ② 결정 지도) — consensus / divided / openQuestions.
 *
 * 판별 규칙: `conclusion.consensus !== undefined` → v2, 아니면 v1.
 */
export interface Conclusion {
  // ── v1 (옛 4섹션 — 기존 세션 호환) ──────────────────────────────────
  keyConclusion?: string;
  risks?: string[];
  personaPositions?: { personaId: string; position: string }[];
  recommendedActions?: string[];
  // ── v2 (트랙 ②: 결정 지도) ──────────────────────────────────────────
  consensus?: string[];
  divided?: DividedPoint[];
  openQuestions?: string[];
}

/**
 * 결론 schema — v2 결정 지도 전용. generateObject 출력 강제.
 *
 * 트랙 ② §4-B (워크오더 박제):
 *   consensus:     패널 공통 합의 사실 (2~6개)
 *   divided:       패널이 끝내 못 합의한 핵심 분기 (1~4개) ★ 가장 값짐
 *   openQuestions: 사용자에게 되돌린 분기 조건 질문 (2~4개)
 *
 * z.infer 결과({ consensus: string[], ... })는 Conclusion 인터페이스에
 * 그대로 assignable — v2 필드가 required 여도 optional 을 만족한다.
 */
export const conclusionSchema = z.object({
  consensus: z
    .array(z.string())
    .min(2)
    .max(6)
    .describe('패널이 *공통적으로* 짚은 사실·제약. 사용자가 전제로 깔아도 안전한 것.'),
  divided: z
    .array(
      z.object({
        topic: z.string().describe('갈린 지점 한 줄. *합의된 척 포장 금지*.'),
        positions: z
          .array(
            z.object({
              side: z.string().describe('이 쪽 입장 한 줄'),
              memberIds: z.array(z.string()).describe('이 입장의 멤버 id 들'),
            }),
          )
          .min(2)
          .max(4)
          .describe('각 갈린 지점은 최소 2개 입장으로 분리. 합의로 위장 금지.'),
      }),
    )
    .min(1)
    .max(4)
    .describe(
      '★ 가장 값진 영역. 패널이 끝내 못 합의한 핵심 분기. ' +
        '강제 수렴 금지 — 갈렸으면 갈렸다고 박제. 사용자가 직접 결정할 재료.',
    ),
  openQuestions: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe('패널이 사용자에게 되돌린 질문. 답에 따라 결론이 바뀌는 분기 조건.'),
});

/**
 * 트랙 ⑤-1 부록 B — 청크 시스템 프롬프트.
 *
 * 워크오더에 박제된 본문 — 임의 수정 금지. 이 프롬프트 품질이 제품의 성패다.
 */
export const CHUNK_SYSTEM_PROMPT = `당신은 COUNCIL의 토론 장면을 연출하는 작가입니다.
한 번의 호출로, 전문가 패널이 벌이는 3~5턴짜리 토론 미니 장면 하나를 완성합니다.
패널 전원의 목소리를 당신이 씁니다 — 각자 자기 캐릭터와 입장에 충실하게.

[연출 원칙]
1. 진짜 충돌. 턴들은 서로를 향한다. 뒤 턴은 앞 턴의 구체적인 표현을 집어서
   받아치거나, 보완하거나, 되묻는다. 허공에 대고 하는 독백을 쓰지 않는다.
2. 한 방. 발언은 한국어 200자 이내, 두세 문장. 늘어놓지 말고 가장 날카로운
   한 문장을 남긴다. "여러 측면이 있습니다" 식의 펼치기는 발언이 아니다.
3. 입장 견지. 각 패널은 배정된 입장(stance)을 장면 내내 지킨다. 반박에
   논리적으로 밀리면 "그 부분은 인정합니다"까지는 가능하나, 핵심 입장은
   양보하지 않는다.
4. 굴복 금지. 패널은 고민 당사자를 안심시키러 온 것이 아니라, 당사자가 보지
   못한 것을 들이대러 왔다. "맞습니다", "좋은 지적입니다", "대표님 말씀이
   옳습니다" 같은 표현은 절대 쓰지 않는다.
5. 벙벙함 금지. "상황에 따라 다르다", "신중히 검토하라"는 발언이 아니다.
   모든 발언은 구체적인 주장·근거·반례 중 하나를 들고 있어야 한다.

[핵심 라인]
이 장면에서 가장 날카롭거나 결정적인 발언 1~2개에만 isKeyPoint: true 를 단다.
전부 true이거나 전부 false이면 잘못 판단한 것이다.

[발언자]
speakerName 은 제공된 패널 명단의 이름과 정확히 일치해야 한다.
명단에 없는 인물을 등장시키지 않는다. 패널 전원이 매 장면 등장할 필요는 없다 —
이 소주제에 할 말이 있는 사람만. 단, 한 사람이 3턴 연속으로 말하지 않는다.

[다음 갈림길]
장면을 다 쓴 뒤, 사용자가 이어서 파고들 소주제 후보(nextTopics)를 제안한다.
이 규칙은 이어지는 지시(buildChunkPrompt)를 따른다.`;

/**
 * 트랙 ⑤-1 부록 C·D — 청크 user 프롬프트.
 *
 * 워크오더 부록 C 의 본문 + 부록 D 의 nextTopics 지시 를 그대로 조립.
 * 임의 수정 금지.
 */
export function buildChunkPrompt(args: {
  concern: string;
  panel: { name: string; role: string; stance: string; voiceCard: string }[];
  topic: string;
  transcript: string;
  isFirst: boolean;
}): string {
  const { concern, panel, topic, transcript, isFirst } = args;

  const panelLines = panel
    .map((p) => {
      const card = p.voiceCard
        ? '\n' + p.voiceCard.split('\n').map((l) => `  ${l.trim()}`).join('\n')
        : '';
      return `- ${p.name} (${p.role}) — 입장: ${p.stance || '특정 입장 없음(중립)'}${card}`;
    })
    .join('\n');

  const topicLine = isFirst
    ? '이 고민의 핵심 결정 그 자체. 패널이 처음으로 정면 충돌하는 장면이다.'
    : topic;

  const transcriptBlock = transcript
    ? `\n[지금까지의 토론 요약]\n${transcript}\n`
    : '';

  return `[고민 당사자가 들고 온 문제]
${concern}

[패널]
${panelLines}

[이번 장면의 소주제]
${topicLine}
${transcriptBlock}
[작업]
위 소주제에 대해 패널이 벌이는 3~5턴짜리 토론 장면을 연출하라.
- 직전 턴에 반박하면 replyToIndex 에 그 턴의 인덱스(이 청크 안에서 0부터)를
  넣는다. 새 논점을 열면 null.
- 사회자가 패널에 있으면, 장면을 열거나(첫 청크) 가장 날카로운 질문을 던지는
  역할로 쓴다. 사회자는 중재하되 무르지 않는다.
- 가장 날카로운 1~2개 발언에 isKeyPoint: true.

[다음 갈림길 — nextTopics]
장면이 끝났으면, 사용자가 다음에 파고들 소주제 후보를 2~4개 제안한다.
이게 이 제품의 핵심이다 — 후보가 뻔하면 사용자는 메뉴를 무시하고, 조향 경험이
죽는다.

규칙:
- 후보는 *방금 이 장면에서* 길어 올린다. 패널이 끝내 갈라선 지점, 한쪽이
  던졌지만 반대쪽이 아직 제대로 답하지 못한 질문, 모두가 슬쩍 피해 간 불편한
  전제 — 거기서 뽑는다.
- 일반론 금지. "마케팅 전략", "리스크 관리", "비용 검토" 같은 교과서 목차는
  후보가 아니다. 어떤 고민에도 붙는 말이라 아무 방향도 가리키지 못한다.
- 검증법: 그 후보를 *다른 고민의 장면*에 그대로 복사해도 말이 되면, 너무
  막연한 것이다. 버려라. 이 고민에만 들어맞아야 한다.
- label 은 짧은 제목(15자 내외). hook 은 "왜 지금 이걸 파야 하는지" 한 줄 —
  방금 장면의 어떤 충돌을 가리키며 쓴다.

좋은 예 (고민: "지금 유료 전환을 할까"):
- label: "공짜 사용자 이탈을 감당할 수 있나"
  hook: "투자자는 전환을 밀었지만, 개발자가 말한 '이탈 40%'에 아무도 답하지 않았다"
- label: "가격을 얼마로 잡을 것인가"
  hook: "전환 여부만 다퉜을 뿐, 정작 숫자는 한 번도 나오지 않았다"

나쁜 예 (방향을 가리키지 못함):
- "수익성 분석"          ← 막연함
- "사용자 피드백 수렴"    ← 교과서 목차
- "장단점 비교"          ← 아무것도 안 가리킴

[✦ 못 본 각도 — 반드시 1개]
nextTopics 가 4개 일 때 그중 1개는 반드시 *사용자가 생각도 못 했을 트레이드오프* 다.
3개 이하일 때도 1개는 이 자리에 두려고 노력한다 (불가능하면 생략 가능).

"못 본 각도" 의 정의:
- 패널 발언에서 *함의되었지만 명시되지 않은* 결론.
- 두 사람의 주장을 합치면 자연스럽게 도출되는데 본인들은 아직 꺼내지 않은 결론.
- 사용자의 원 고민이 *전제로 깔고 있던 가정* 자체에 의문을 던지는 각도.

이 항목은 출력의 다른 후보와 시각적으로 차별화될 수 있도록 label 앞에 마커 "✦ "
를 박제한다. 예시: "✦ 가격 책정이 아니라 가격 *철회* 가 진짜 문제 아닌가".

0개면 청크가 ChatGPT 다. 2개 이상이면 사용자가 길을 잃는다. **정확히 1개.**
`;
}

/**
 * 트랙 ② — 결정 지도형 결론 프롬프트.
 *
 * ⚠️ Opus 박제 — 부록 A 원문 그대로. Sonnet 임의 수정 금지.
 * 굴복 금지·강제 수렴 금지 가드가 본문 안에 포함돼 있다.
 */
export function buildConclusionPrompt(
  concern: string,
  messages: readonly Message[],
  cast: readonly CastMember[],
): string {
  const personaMap = Object.fromEntries(cast.map((m) => [m.id, m]));
  const fullHistory = messages
    .map((m) => {
      if (m.speakerId === null) return `[사용자] ${m.content}`;
      const persona = personaMap[m.speakerId];
      return `[${persona?.name ?? '???'} (id:${m.speakerId})] ${m.content}`;
    })
    .join('\n');

  // 멤버 id ↔ 이름 매핑을 명시 — divided.positions.memberIds 가 정확한 id 를 채우도록.
  const memberDirectory = cast
    .map((m) => `- id: "${m.id}" / 이름: "${m.name}"`)
    .join('\n');

  return `[원본 고민]
${concern}

[패널 명단 — divided.positions.memberIds 는 반드시 아래 id 사용]
${memberDirectory}

[전체 토론 내용]
${fullHistory}

[작업 — 결정 지도형 결론]
당신은 사회자입니다. 이 토론을 정리하되, *판결* 이 아니라 *결정 지도* 를 만듭니다.
사용자가 직접 결정할 수 있도록 *재료* 를 분류해 제시하세요.

세 가지 분류:

(1) consensus — *합의된 것*
   패널이 공통적으로 짚은 사실·제약. 누구도 반박하지 않은 지점.
   사용자가 *전제로 깔아도 안전한 것*.
   2~6개. 한 줄씩.

(2) divided — *끝내 갈린 것* ★ 가장 값진 영역
   패널이 마지막까지 못 합의한 핵심 분기.
   각 분기점마다 *어느 멤버가 어느 쪽인지* memberIds 로 명시.
   1~4개. *합의된 척 포장 금지* — 갈렸으면 갈렸다고 박제.
   각 분기점은 최소 2개 입장으로 분리. 입장 1개만 있으면 갈림이 아님.

   예시 형식:
   {
     topic: "수의사 친구 1명을 자산으로 볼까 부채로 볼까",
     positions: [
       { side: "현장 검증 채널 (자산)", memberIds: ["domain-vet"] },
       { side: "1명은 표본이 아닌 친밀감 함정", memberIds: ["jobs-designer", "realist"] }
     ]
   }

(3) openQuestions — *당신이 답해야 할 질문*
   패널이 사용자에게 되돌린 질문. 답에 따라 결론이 바뀌는 *분기 조건*.
   2~4개. 교과서적 일반론 금지 — *이 고민에만 들어맞는* 질문.

[금지 사항]
- 강제 수렴 금지. divided 가 0개면 안 된다. 갈린 지점이 *반드시 있다*.
- 일반론 금지. "신중히 검토하라" 식 결론은 결론이 아니다.
- 굴복 금지. 사용자에게 맞춰주는 안전 모드 절대 금물.
- 입장 1개 의 divided 금지. 갈렸으면 양쪽 모두 박제.
`;
}
