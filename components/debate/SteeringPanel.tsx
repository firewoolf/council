'use client';

import { useState } from 'react';
import { Flag, MessageSquarePlus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { ChunkMeta } from '@/types/debate';

interface SteeringPanelProps {
  chunk: ChunkMeta;
  onChoose: (label: string, hook?: string) => void;
  onCustom: (text: string) => void;
  onConclude: () => void;
}

/**
 * 트랙 ⑤-1 — 갈림길 패널.
 *
 * 청크가 끝난 직후 등장. 사용자가 다음 방향을 *고른다*. 입력 → 선택 의 전환.
 *
 * 구성:
 *   - nextTopics 카드 2~4개 — label(굵게) + hook(text-muted 한 줄).
 *     isBlindSpot 후보는 "✦" 마커 + 다른 톤(accent 보더).
 *   - 직접 입력 — textarea + 제출 버튼.
 *   - 결론 내기 — secondary.
 *
 * 이 패널이 띄워졌을 때 DebateControls 는 안내 한 줄만 표시한다.
 */
export function SteeringPanel({
  chunk,
  onChoose,
  onCustom,
  onConclude,
}: SteeringPanelProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const [custom, setCustom] = useState('');

  function submitCustom() {
    const trimmed = custom.trim();
    if (trimmed.length < 2) {
      toast.error('소주제가 너무 짧습니다.');
      return;
    }
    onCustom(trimmed);
    setCustom('');
    setCustomOpen(false);
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-text">다음에 파고들 방향</p>
        <p className="font-mono text-[11px] text-text-muted">
          청크 종료 — 갈림길
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {chunk.nextTopics.map((t, i) => (
          <li key={`${i}-${t.label}`}>
            <button
              type="button"
              onClick={() => onChoose(t.label, t.hook)}
              className={cn(
                'flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition-colors',
                t.isBlindSpot
                  ? 'border-accent/50 bg-accent/[0.06] hover:border-accent hover:bg-accent/10'
                  : 'border-border bg-surface-2 hover:border-primary/40 hover:bg-primary/5',
              )}
            >
              <div className="flex items-center gap-2">
                {t.isBlindSpot && (
                  <Sparkles className="size-3.5 shrink-0 text-accent" />
                )}
                <span
                  className={cn(
                    'text-sm font-semibold leading-snug',
                    t.isBlindSpot ? 'text-accent' : 'text-text',
                  )}
                >
                  {t.label}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-text-muted">{t.hook}</p>
            </button>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        {!customOpen ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCustomOpen(true)}
            className="self-start text-text-muted hover:text-text"
          >
            <MessageSquarePlus className="size-3.5" />
            직접 입력
          </Button>
        ) : (
          <div className="space-y-2">
            <Textarea
              rows={2}
              placeholder="패고 싶은 소주제를 직접 적어주세요. (예: '공짜 사용자 이탈 40% 시나리오')"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              className="min-h-[56px]"
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCustomOpen(false);
                  setCustom('');
                }}
              >
                취소
              </Button>
              <Button size="sm" onClick={submitCustom} disabled={!custom.trim()}>
                이 방향으로
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={onConclude}>
            <Flag className="size-3.5" />
            결론 내기
          </Button>
        </div>
      </div>
    </div>
  );
}
