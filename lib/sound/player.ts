/**
 * ⑤-5f-B — 사운드 플레이어.
 *
 * 동작:
 *   1. 모듈 로드 시 모든 ogg 자산을 Audio 객체로 preload.
 *   2. playSound(event) — ogg 있으면 play(), 없으면 synthesizer 폴백.
 *   3. mute 상태는 localStorage('council:sound-muted') 에 persist.
 *   4. prefers-reduced-motion: reduce → 자동 mute.
 *   5. document.hidden → no-op (탭 비활성).
 *   6. 의존성 0 — Web Audio API + 네이티브 Audio 만 사용.
 */

import { SOUND_ASSETS } from './events';
import type { SoundEvent } from './events';
import { synthSound } from './synthesizer';

const STORAGE_KEY = 'council:sound-muted';

// ──────────────── 모듈 상태 ────────────────────────────────────────────────

/** null = 아직 읽지 않음 (lazy init). */
let _muted: boolean | null = null;

/** 이벤트 → HTMLAudioElement 캐시 */
const audioCache = new Map<SoundEvent, HTMLAudioElement>();

/** 로드 실패(404 등)한 이벤트 — synthesizer 폴백으로 고정. */
const failedAssets = new Set<SoundEvent>();

// ──────────────── 내부 헬퍼 ───────────────────────────────────────────────

/** localStorage + prefers-reduced-motion 기반 mute 상태 읽기 (lazy). */
function loadMuted(): boolean {
  if (_muted !== null) return _muted;

  if (typeof window === 'undefined') {
    _muted = true;
    return true;
  }

  // prefers-reduced-motion: reduce → 자동 mute
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    _muted = true;
    return true;
  }

  // localStorage 기본값: muted=true (워크오더 §B.5 — OFF 권장)
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    _muted = stored !== 'false'; // 'false' 만 unmuted, 나머지(null/'true') 는 muted
  } catch {
    _muted = true;
  }

  return _muted;
}

/** Audio 객체 취득 (없으면 생성 + 에러 리스너 등록). */
function getOrCreateAudio(event: SoundEvent): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;

  const cached = audioCache.get(event);
  if (cached) return cached;

  if (failedAssets.has(event)) return null;

  const audio = new Audio(SOUND_ASSETS[event]);
  audio.preload = 'auto';
  audio.volume = 0.7;

  audio.addEventListener(
    'error',
    () => {
      // 자산 로드 실패 → 이 이벤트는 항상 synthesizer 폴백
      failedAssets.add(event);
      audioCache.delete(event);
    },
    { once: true },
  );

  audioCache.set(event, audio);
  return audio;
}

// ──────────────── 모듈 로드 시 preload (브라우저 환경만) ──────────────────

if (typeof window !== 'undefined') {
  const events: SoundEvent[] = [
    'reveal',
    'keypoint',
    'question',
    'intro',
    'direction-send',
    'steering-decide',
    'conclude',
  ];
  for (const ev of events) {
    getOrCreateAudio(ev);
  }
}

// ──────────────── 공개 API ────────────────────────────────────────────────

/** 현재 mute 상태 반환. */
export function isMuted(): boolean {
  return loadMuted();
}

/** mute 상태 설정 + localStorage persist. */
export function setMuted(muted: boolean): void {
  _muted = muted;
  try {
    localStorage.setItem(STORAGE_KEY, String(muted));
  } catch {
    // localStorage 접근 불가 — 메모리 상태만 변경
  }
}

/**
 * 사운드 이벤트 재생.
 *
 * 우선순위: ogg 자산 → synthesizer 폴백.
 * 다음 조건 중 하나라도 해당하면 no-op:
 *   - SSR 환경
 *   - muted
 *   - 탭 비활성 (document.hidden)
 */
export function playSound(event: SoundEvent): void {
  if (typeof window === 'undefined') return;
  if (document.hidden) return;
  if (loadMuted()) return;

  if (failedAssets.has(event)) {
    synthSound(event);
    return;
  }

  const audio = getOrCreateAudio(event);
  if (!audio) {
    synthSound(event);
    return;
  }

  audio.currentTime = 0;
  audio.play().catch(() => {
    // autoplay 정책 또는 재생 실패 → synthesizer 폴백
    synthSound(event);
  });
}
