/**
 * ⑤-5f-B — 사운드 이벤트 목록 + 자산 경로 매핑.
 *
 * 자산이 없으면 player 가 synthesizer 폴백 사용.
 * 자산 배치: public/sounds/{event}.ogg
 */

export type SoundEvent =
  | 'reveal'          // 새 발언 카드 등장 — 짧은 tick (가장 자주 발화)
  | 'keypoint'        // isKeyPoint 발언 — 밝은 chime (Aha 모먼트)
  | 'question'        // isQuestion 발언 — 상승 톤
  | 'intro'           // 모두 발언 등장 — 낮은 gong (의식의 시작)
  | 'direction-send'  // 카드 디렉션 전송 — confirm switch
  | 'steering-decide' // SteeringPanel 후보 선택 — 결정의 북
  | 'conclude';       // summary 화면 진입 — fanfare

/** 이벤트별 ogg 자산 경로. 파일 없으면 Audio onError → synthesizer 폴백. */
export const SOUND_ASSETS: Record<SoundEvent, string> = {
  reveal:            '/sounds/reveal.ogg',
  keypoint:          '/sounds/keypoint.ogg',
  question:          '/sounds/question.ogg',
  intro:             '/sounds/intro.ogg',
  'direction-send':  '/sounds/direction-send.ogg',
  'steering-decide': '/sounds/steering-decide.ogg',
  conclude:          '/sounds/conclude.ogg',
};
