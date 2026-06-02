/**
 * ⑤-5f-B — 사운드 시스템 공개 API.
 *
 * import { playSound, setMuted, isMuted } from '@/lib/sound';
 * import type { SoundEvent } from '@/lib/sound';
 */

export { playSound, setMuted, isMuted } from './player';
export type { SoundEvent } from './events';
