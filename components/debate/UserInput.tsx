'use client';

import { useState } from 'react';
import { Megaphone, MessageSquarePlus, UserPlus } from 'lucide-react';
import { toast } from 'sonner';

import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PERSONAS } from '@/lib/prompts/personas';
import { cn } from '@/lib/utils';
import type { Persona } from '@/types/persona';

type Tab = 'speak' | 'instruct' | 'add';

interface UserInputProps {
  activePersonaIds: string[];
  domain: string | null;
  disabled?: boolean;
  onSpeak: (content: string) => void;
  onInstruct: (content: string) => void;
  onAddPersona: (personaId: string) => void;
}

/**
 * 사용자 개입 UI — 회의실 하단 컨트롤 바 위에 위치.
 *
 * 3탭:
 *   1. 발언   — textarea, 사용자 메시지로 추가, 페르소나들이 반응
 *   2. 지시   — textarea + 프리셋 칩 ("더 짧게", "다른 관점", ...)
 *   3. +     — 풀에서 페르소나 추가
 *
 * 모바일 우선: 탭 헤더는 작은 칩으로, 패널은 인라인 확장.
 */
const INSTRUCTION_PRESETS = [
  '더 짧게 말해주세요',
  '다른 관점도 보여주세요',
  '구체적 숫자로 설명해주세요',
  '리스크에 집중해주세요',
  '결정을 강요하지 마세요',
] as const;

export function UserInput({
  activePersonaIds,
  domain,
  disabled,
  onSpeak,
  onInstruct,
  onAddPersona,
}: UserInputProps) {
  const [tab, setTab] = useState<Tab>('speak');
  const [speakText, setSpeakText] = useState('');
  const [instructText, setInstructText] = useState('');

  const availablePersonas = PERSONAS.filter(
    (p) => !activePersonaIds.includes(p.id),
  );

  function handleSpeak() {
    const trimmed = speakText.trim();
    if (trimmed.length < 2) {
      toast.error('너무 짧습니다.');
      return;
    }
    onSpeak(trimmed);
    setSpeakText('');
    toast.success('발언이 추가되었습니다.');
  }

  function handleInstruct(preset?: string) {
    const text = (preset ?? instructText).trim();
    if (!text) {
      toast.error('지시 내용을 입력해주세요.');
      return;
    }
    onInstruct(text);
    setInstructText('');
    toast.success('지시가 반영됩니다.');
  }

  function handleAdd(p: Persona) {
    onAddPersona(p.id);
    toast.success(`${p.name} 합류`);
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      {/* 탭 헤더 */}
      <div className="flex gap-1 border-b border-border p-1.5">
        <TabButton
          active={tab === 'speak'}
          onClick={() => setTab('speak')}
          icon={<MessageSquarePlus className="size-3.5" />}
          label="발언"
        />
        <TabButton
          active={tab === 'instruct'}
          onClick={() => setTab('instruct')}
          icon={<Megaphone className="size-3.5" />}
          label="지시"
        />
        <TabButton
          active={tab === 'add'}
          onClick={() => setTab('add')}
          icon={<UserPlus className="size-3.5" />}
          label={`페르소나+ (${availablePersonas.length})`}
        />
      </div>

      <div className="p-3">
        {/* 발언 탭 */}
        {tab === 'speak' && (
          <div className="space-y-2">
            <Textarea
              rows={2}
              placeholder="페르소나들에게 직접 말해보세요. 그들이 반응합니다."
              value={speakText}
              onChange={(e) => setSpeakText(e.target.value)}
              disabled={disabled}
              className="min-h-[64px]"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSpeak}
                disabled={disabled || speakText.trim().length < 2}
              >
                내 발언 추가
              </Button>
            </div>
          </div>
        )}

        {/* 지시 탭 */}
        {tab === 'instruct' && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {INSTRUCTION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleInstruct(preset)}
                  className="rounded-full border border-accent/30 bg-accent/5 px-2.5 py-1 text-xs text-accent transition-colors hover:bg-accent/15 disabled:opacity-50"
                >
                  {preset}
                </button>
              ))}
            </div>
            <Textarea
              rows={2}
              placeholder="메타 지시 (톤·길이·관점 변경). 다음 페르소나 발언부터 반영됩니다."
              value={instructText}
              onChange={(e) => setInstructText(e.target.value)}
              disabled={disabled}
              className="min-h-[64px]"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => handleInstruct()}
                disabled={disabled || !instructText.trim()}
              >
                <Megaphone className="size-3.5" />
                지시 보내기
              </Button>
            </div>
          </div>
        )}

        {/* 페르소나+ 탭 */}
        {tab === 'add' && (
          <div className="space-y-2">
            {availablePersonas.length === 0 ? (
              <p className="rounded-md bg-surface-2 p-3 text-center text-xs text-text-muted">
                추가할 수 있는 페르소나가 없습니다. (모두 참여 중)
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {availablePersonas.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleAdd(p)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-md border border-border bg-surface-2 p-2 text-left transition-colors',
                        'hover:border-primary/40 hover:bg-primary/5',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                      )}
                    >
                      <PersonaOrb persona={p} size={28} glow="none" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-text">
                          {p.dynamic && domain ? `${p.name} (${domain})` : p.name}
                        </p>
                        <p className="truncate text-[10px] text-text-muted">
                          {p.role}
                        </p>
                      </div>
                      <UserPlus className="size-3.5 text-text-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'bg-primary/15 text-primary'
          : 'text-text-muted hover:bg-surface-2 hover:text-text',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
