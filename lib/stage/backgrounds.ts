export interface StageBackground {
  id: string;
  label: string;
  path: string;
}

/** ⑤-5h — 무대 배경 카탈로그. 에셋: public/stages/backgrounds/{id}.webp */
export const STAGE_BACKGROUNDS: StageBackground[] = [
  { id: 'meeting-room', label: '회의실',   path: '/stages/backgrounds/meeting-room.webp' },
  { id: 'office',       label: '사무실',   path: '/stages/backgrounds/office.webp' },
  { id: 'study',        label: '서재',     path: '/stages/backgrounds/study.webp' },
  { id: 'courtroom',    label: '법정',     path: '/stages/backgrounds/courtroom.webp' },
  { id: 'cafe',         label: '카페',     path: '/stages/backgrounds/cafe.webp' },
  { id: 'studio',       label: '중립 무대', path: '/stages/backgrounds/studio.webp' },
];

export const DEFAULT_BACKGROUND_ID = 'studio';

export function backgroundById(id: string | undefined): StageBackground {
  return (
    STAGE_BACKGROUNDS.find((b) => b.id === id) ??
    STAGE_BACKGROUNDS.find((b) => b.id === DEFAULT_BACKGROUND_ID)!
  );
}
