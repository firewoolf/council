import { CornerDownRight, HelpCircle, Megaphone, User } from 'lucide-react';

import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { TEMPERAMENT_LABEL_KR } from '@/lib/prompts/personas';
import { cn } from '@/lib/utils';
import type { Message } from '@/types/debate';
import type { CastMember } from '@/types/persona';

interface MessageCardProps {
  message: Message;
  /** 페르소나 발언일 때 그 발언자 CastMember. 사용자 발언이면 null. */
  speaker: CastMember | null;
  /** 반박 대상 메시지의 발언자 (페르소나) — replyTo가 있을 때만 */
  replyTarget?: { speakerName: string; preview: string } | null;
}

/**
 * 발언 카드.
 *
 * 두 종류:
 *  - 페르소나 발언: 좌측 색띠 + orb + 이름 + 본문 + (선택) 반박 표시
 *  - 사용자 발언: 우측 정렬 / 다른 톤 (회색 surface-2)
 *
 * CLAUDE.md ⓬: 말풍선 디자인 금지 → "카드" 형태로.
 */
export function MessageCard({ message, speaker, replyTarget }: MessageCardProps) {
  const isUser = speaker === null;
  const isInstruction = message.kind === 'instruction';

  // 사용자 메타 지시 — 중앙 정렬 + 다른 톤. 토론과 별개 채널임을 시각적으로 분리.
  if (isInstruction) {
    return (
      <div className="flex justify-center animate-fade-in">
        <div className="flex max-w-[90%] items-start gap-2 rounded-full border border-dashed border-accent/40 bg-accent/5 px-4 py-2">
          <Megaphone className="mt-0.5 size-3.5 shrink-0 text-accent" />
          <p className="text-xs italic leading-relaxed text-accent">
            <span className="mr-1 font-semibold not-italic">메타 지시</span>
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex flex-col items-end animate-fade-in">
        <div className="flex max-w-[85%] flex-col gap-2 rounded-xl border border-primary/30 bg-primary/10 p-4">
          <div className="flex items-center gap-2 text-xs font-medium text-primary">
            <User className="size-3.5" />
            나
          </div>
          <p className="whitespace-pre-wrap text-base font-normal leading-relaxed text-text">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  if (!speaker) {
    // 안전 가드 — 페르소나 데이터가 사라진 경우
    return null;
  }

  // 트랙 ⑤-2a — 좌측 색띠 두께: 기본 6px, isKeyPoint 8px
  const borderLeftWidth = message.isKeyPoint ? 8 : 6;

  return (
    <div
      className={cn(
        'relative flex flex-col gap-2 rounded-xl border p-4 animate-card-enter',
        message.isKeyPoint
          ? 'border-accent/50'
          : 'border-border',
      )}
      style={{
        borderLeftWidth,
        borderLeftColor: speaker.colorTo,
        // 트랙 ⑤-2a — 페르소나 색 alpha 1.5% 배경 그라디언트
        background: `linear-gradient(135deg, ${speaker.colorFrom}05, transparent 40%), hsl(var(--surface))`,
      }}
    >
      {/* 반박 연결선 */}
      {replyTarget && (
        <div className="flex items-center gap-1.5 text-xs text-accent">
          <CornerDownRight className="size-3.5 shrink-0" />
          <span className="font-medium">{replyTarget.speakerName}</span>
          <span className="text-text-muted">에 반박</span>
          <span className="truncate text-text-muted/70">
            · &ldquo;{replyTarget.preview}&rdquo;
          </span>
        </div>
      )}

      {/* 발언자 */}
      <div className="flex items-center gap-2">
        <PersonaOrb persona={speaker} size={28} glow="soft" />
        <span className="text-sm font-semibold text-text">{speaker.name}</span>
        {/* 트랙 ⑤-2a — temperament 미니 칩 */}
        <span
          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-medium leading-none"
          style={{
            color: speaker.colorTo,
            background: `${speaker.colorTo}22`,
          }}
        >
          {TEMPERAMENT_LABEL_KR[speaker.temperament]}
        </span>
        {message.isQuestion && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-accent">
            <HelpCircle className="size-3" />
            질문
          </span>
        )}
      </div>

      {/* 본문 */}
      <p className="whitespace-pre-wrap text-base font-normal leading-relaxed text-text">
        {message.content}
      </p>
    </div>
  );
}
