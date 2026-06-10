'use client';

import { useState } from 'react';
import { ChevronUp, Send } from 'lucide-react';
import { toast } from 'sonner';

import { SpeechComposer } from './SpeechComposer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { DebatePhase } from '@/hooks/useDebate';

interface ChatInputBarProps {
  phase: DebatePhase;
  onSubmitSpeech: (
    text: string,
    opts: { asUtterance: boolean },
  ) => void;
  onSubmitCustomTopic: (text: string) => void;
  onOpenDirections: () => void;
}

export function ChatInputBar({
  phase,
  onSubmitSpeech,
  onSubmitCustomTopic,
  onOpenDirections,
}: ChatInputBarProps) {
  const [customTopic, setCustomTopic] = useState('');
  const isDiscussionActive =
    phase === 'generating' || phase === 'playing' || phase === 'concluding';

  if (phase === 'steering') {
    const submitCustom = () => {
      const trimmed = customTopic.trim();
      if (trimmed.length < 2) {
        toast.error('소주제가 너무 짧습니다.');
        return;
      }
      onSubmitCustomTopic(trimmed);
      setCustomTopic('');
    };

    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={onOpenDirections}
          className="flex w-fit items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent"
        >
          다음 방향 고르기
          <ChevronUp className="size-3.5" />
        </button>
        <div className="flex items-end gap-2">
          <Textarea
            rows={1}
            value={customTopic}
            onChange={(event) => setCustomTopic(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                submitCustom();
              }
            }}
            placeholder="직접 주제를 입력하거나, 방향을 고르세요"
            className="min-h-10 max-h-24 py-2.5 text-sm"
          />
          <Button
            size="icon"
            onClick={submitCustom}
            disabled={customTopic.trim().length < 2}
            aria-label="직접 주제 보내기"
            className="shrink-0"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (isDiscussionActive) {
    return (
      <SpeechComposer
        compact
        onSubmit={onSubmitSpeech}
        placeholder="패널에게 한마디 (발언/시그널)"
      />
    );
  }

  return (
    <Textarea
      rows={1}
      disabled
      value=""
      placeholder={
        phase === 'concluded'
          ? '토론이 종결되었습니다'
          : phase === 'error'
            ? '오류로 입력이 중단되었습니다'
            : '토론을 시작하면 입력할 수 있습니다'
      }
      className="min-h-10 py-2.5 text-sm"
    />
  );
}
