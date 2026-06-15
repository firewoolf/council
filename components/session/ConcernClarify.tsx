'use client';

import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { ClarifyQuestion } from '@/lib/prompts/concern-shaping';

interface ConcernClarifyProps {
  rawConcern: string;
  questions: ClarifyQuestion[];
  loading: boolean;
  onSubmit: (answers: { question: string; answer: string }[]) => void;
  onSkip: () => void;
}

/**
 * I-1 — 역질문 카드 단계.
 * 각 질문에 선택 답변 → "이대로 토론 시작" or "질문 없이 진행".
 */
export function ConcernClarify({
  rawConcern,
  questions,
  loading,
  onSubmit,
  onSkip,
}: ConcernClarifyProps) {
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    Object.fromEntries(questions.map((q) => [q.key, ''])),
  );

  function handleAnswer(key: string, value: string) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit() {
    const pairs = questions.map((q) => ({
      question: q.question,
      answer: answers[q.key] ?? '',
    }));
    onSubmit(pairs);
  }

  return (
    <section className="flex flex-col gap-6">
      <div className="space-y-1">
        <h2 className="font-sans text-2xl font-black leading-tight tracking-tight text-text sm:text-3xl">
          고민을 더 날카롭게
        </h2>
        <p className="text-sm leading-relaxed text-text-muted">
          답하기 어렵거나 모르면 빈 칸으로 두어도 됩니다.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-surface/60 px-4 py-3">
        <p className="text-sm text-text/80 italic">&ldquo;{rawConcern}&rdquo;</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-text-muted">
          <Loader2 className="size-4 animate-spin" />
          사회자가 질문을 고르는 중…
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {questions.map((q, i) => (
            <div key={q.key} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-accent" />
                <div className="flex-1 space-y-0.5">
                  <p className="text-sm font-medium leading-snug text-text">{q.question}</p>
                  <p className="text-xs text-text-muted">{q.why}</p>
                </div>
              </div>
              <div className="space-y-1 pl-5">
                <Label htmlFor={`clarify-${i}`} className="sr-only">
                  {q.question}
                </Label>
                <Textarea
                  id={`clarify-${i}`}
                  rows={2}
                  placeholder={q.placeholder}
                  value={answers[q.key] ?? ''}
                  onChange={(e) => handleAnswer(q.key, e.target.value)}
                  className="min-h-0 resize-none text-sm"
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 sm:flex-none"
        >
          이대로 토론 시작
        </Button>
        <Button
          size="lg"
          variant="ghost"
          onClick={onSkip}
          className="flex-1 sm:flex-none"
        >
          질문 없이 진행
        </Button>
      </div>
    </section>
  );
}
