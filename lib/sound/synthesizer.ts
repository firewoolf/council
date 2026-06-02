/**
 * ⑤-5f-B — Web Audio API 합성음 폴백.
 *
 * ogg 자산 없거나 로드 실패 시 synthesizer 가 대신 소리를 생성.
 * 의존성 0 — Web Audio API 는 모든 주요 브라우저 지원.
 *
 * ⚠️  SOUND_PARAMS — 부록 B Opus 박제. 임의 수정 금지.
 */

import type { SoundEvent } from './events';

type SoundParams = {
  freq: number;         // Hz
  type: OscillatorType; // 'sine' | 'triangle' | 'square' | 'sawtooth'
  volume: number;       // 0~1 (peak gain)
  duration: number;     // seconds
};

// ⚠️  부록 B Opus 박제 — 임의 수정 금지.
const SOUND_PARAMS: Record<SoundEvent, SoundParams> = {
  // 짧고 부드러운 tick — 가장 자주 발화하므로 가장 가벼움
  reveal:            { freq: 880,  type: 'sine',     volume: 0.06, duration: 0.08 },

  // 밝은 chime (Aha) — 3차 화음 느낌은 단순 sine 으로는 어려우므로 약간 길게
  keypoint:          { freq: 1320, type: 'sine',     volume: 0.10, duration: 0.35 },

  // 상승 톤 (질문 끝) — freq.linearRampToValueAtTime 으로 상승 구현
  question:          { freq: 660,  type: 'triangle', volume: 0.08, duration: 0.22 },

  // 낮은 gong (모두 발언 의식의 시작)
  intro:             { freq: 220,  type: 'sine',     volume: 0.12, duration: 0.55 },

  // confirm switch (디렉션 전송)
  'direction-send':  { freq: 1100, type: 'square',   volume: 0.05, duration: 0.07 },

  // 결정의 북 (steering 후보 선택)
  'steering-decide': { freq: 165,  type: 'triangle', volume: 0.14, duration: 0.28 },

  // fanfare (마침의 무게) — mp3 자산이 강하게 권장, 여기선 단음 근사
  conclude:          { freq: 523,  type: 'triangle', volume: 0.12, duration: 0.70 },
};

let ctx: AudioContext | null = null;

/**
 * Web Audio API 합성음 재생.
 * AudioContext 가 suspended 상태면 resume 후 재생 (autoplay 정책 우회).
 */
export function synthSound(event: SoundEvent): void {
  if (typeof window === 'undefined') return;

  try {
    if (!ctx) ctx = new AudioContext();

    const params = SOUND_PARAMS[event];

    const play = () => {
      const audioCtx = ctx!;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.frequency.value = params.freq;
      osc.type = params.type;

      const t = audioCtx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(params.volume, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + params.duration);

      // question 이벤트 — 주파수 상승 (부록 B §Sonnet 구현 지시)
      if (event === 'question') {
        osc.frequency.linearRampToValueAtTime(880, t + 0.18);
      }

      osc.start(t);
      osc.stop(t + params.duration);
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(play).catch(() => {});
    } else {
      play();
    }
  } catch {
    // AudioContext 미지원 또는 예외 — 무음 처리 (graceful)
  }
}
