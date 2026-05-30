'use client';

import { useMemo, useState } from 'react';
import { ChevronDown, Users, X } from 'lucide-react';

import { PersonaCard } from '@/components/persona/PersonaCard';
import { PersonaOrb } from '@/components/persona/PersonaOrb';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PERSONAS, LENS_LABEL_KR, STANCE_LABEL_KR } from '@/lib/prompts/personas';
import { LENS_COLORS } from '@/lib/persona-safety';
import { cn } from '@/lib/utils';
import type { CastMember, Expression, Lens, StanceAxis, Trait } from '@/types/persona';

const FACILITATOR_ID = 'facilitator';
const DOMAIN_EXPERT_ID = 'domain-expert';

/** 커스텀 페르소나 입력 (자유 프롬프트 없음 — 4필드만). Phase E: trait 3축. */
export interface CustomPersonaInput {
  name: string;
  role: string;
  trait: Trait;
  stance: string;
}

interface PersonaPickerProps {
  /** 현재 패널의 모든 멤버 (archetype + generated + custom + 사회자). */
  cast: CastMember[];
  /** archetype 멤버용 추천 사유 맵 (archetypeId → reason). */
  reasons: Record<string, string>;
  /** 추천기가 감지한 도메인 표시용. */
  domain: string | null;
  onRemove: (memberId: string) => void;
  /** archetype 멤버 swap — onSwapStart 단계는 picker 내부에서 처리. */
  onSwap: (memberId: string, newArchetypeId: string) => void;
  onAddFromPool: (archetypeId: string) => void;
  onAddCustom: (input: CustomPersonaInput) => void;
  onStart: () => void;
  /** trait 3축 인터랙티브 칩 변경 — PersonaCard 에 직접 전달. */
  onTraitChange?: (memberId: string, axis: keyof Trait, newValue: string) => void;
  busy?: boolean;
}

/**
 * picking 화면 — cast 단일 prop 기반.
 *
 * 구조:
 *   - 헤더 + 감지된 분야 칩
 *   - 패널 통합 리스트 (archetype/generated/custom 한 줄, 사회자 별도 카드)
 *   - "다른 페르소나 추가" 접힘 (아키타입 풀)
 *   - "직접 만들기" 접힘 (커스텀 폼 — 자유 프롬프트 입력 없음)
 *   - 사회자 자동 포함 안내
 *   - sticky 하단: orb 미리보기 + 회의 시작
 */
export function PersonaPicker({
  cast,
  reasons,
  domain,
  onRemove,
  onSwap,
  onAddFromPool,
  onAddCustom,
  onStart,
  onTraitChange,
  busy,
}: PersonaPickerProps) {
  const [poolOpen, setPoolOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  // swap 후보 모달 상태 — 어떤 멤버를 교체 중인지
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);

  // 패널에 보이는 멤버 — 사회자는 별도 카드로
  const panelMembers = useMemo(
    () => cast.filter((m) => !m.isFacilitator),
    [cast],
  );

  const facilitator = useMemo(
    () => cast.find((m) => m.isFacilitator) ?? null,
    [cast],
  );

  // 풀에서 보여줄 아키타입 — 이미 cast 에 있는 archetypeId 와 facilitator/domain-expert 제외
  const usedArchetypeIds = useMemo(
    () => new Set(cast.map((m) => m.archetypeId).filter(Boolean) as string[]),
    [cast],
  );

  const poolArchetypes = useMemo(
    () =>
      PERSONAS.filter(
        (p) =>
          !usedArchetypeIds.has(p.id) &&
          p.id !== FACILITATOR_ID &&
          p.id !== DOMAIN_EXPERT_ID,
      ),
    [usedArchetypeIds],
  );

  // swap 후보 — 풀과 동일하지만 swap 대상 자신의 archetypeId 는 후보에서 빠지지 않게
  const swapCandidates = useMemo(() => {
    if (!swapTargetId) return [];
    const target = cast.find((m) => m.id === swapTargetId);
    const targetArchId = target?.archetypeId;
    return PERSONAS.filter(
      (p) =>
        p.id !== FACILITATOR_ID &&
        p.id !== DOMAIN_EXPERT_ID &&
        (p.id === targetArchId || !usedArchetypeIds.has(p.id)),
    );
  }, [swapTargetId, cast, usedArchetypeIds]);

  const previewOrbs = cast.map((m) => ({
    name: m.name,
    colorFrom: m.colorFrom,
    colorTo: m.colorTo,
  }));
  const previewCount = cast.length;

  function handleSwapStart(memberId: string) {
    setSwapTargetId(memberId);
  }
  function handleSwapPick(archetypeId: string) {
    if (!swapTargetId) return;
    onSwap(swapTargetId, archetypeId);
    setSwapTargetId(null);
  }

  return (
    <section className="flex flex-col gap-6 pb-32">
      {/* 헤더 */}
      <div className="space-y-2">
        <h1 className="font-sans text-3xl font-black leading-tight tracking-tight text-text sm:text-4xl">
          이 사람들이 토론할 거예요.
        </h1>
        <p className="text-sm leading-relaxed text-text-muted sm:text-base">
          AI 가 당신의 고민에 맞춰 패널을 설계했습니다. 카드의 ⋯ 메뉴로 교체·제거,
          또는 아키타입에서 추가하거나 직접 만들 수도 있습니다.
        </p>
        {domain && (
          <p className="text-xs text-text-muted">
            <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px]">
              감지된 분야
            </span>{' '}
            <span className="font-medium text-text/90">{domain}</span>
          </p>
        )}
      </div>

      {/* 패널 — 통합 단일 리스트 */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">
          패널 ({panelMembers.length}명)
        </h2>
        <div className="flex flex-col gap-3">
          {panelMembers.map((m) => (
            <PersonaCard
              key={m.id}
              member={m}
              recommendReason={
                m.archetypeId ? reasons[m.archetypeId] : undefined
              }
              showActions
              onRemove={onRemove}
              onSwapStart={
                m.source === 'archetype' ? handleSwapStart : undefined
              }
              onTraitChange={onTraitChange}
            />
          ))}
          {panelMembers.length === 0 && (
            <p className="rounded-md border border-dashed border-border bg-surface/40 p-6 text-center text-xs text-text-muted">
              패널이 비어있습니다. 아래에서 페르소나를 추가하세요.
            </p>
          )}
        </div>
      </div>

      {/* 사회자 자동 포함 안내 */}
      {facilitator && (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface/60 p-4">
          <PersonaOrb persona={facilitator} size={40} glow="soft" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-text">
              사회자는 자동으로 참여합니다
            </p>
            <p className="text-xs text-text-muted">
              토론 진행과 결론 정리를 담당합니다.
            </p>
          </div>
        </div>
      )}

      {/* 다른 페르소나 추가 (아키타입 풀) */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setPoolOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-md px-1 py-2 text-sm font-semibold uppercase tracking-wider text-text-muted hover:text-text"
        >
          <span>다른 페르소나 추가 ({poolArchetypes.length})</span>
          <ChevronDown
            className={cn(
              'size-4 transition-transform',
              poolOpen && 'rotate-180',
            )}
          />
        </button>
        {poolOpen && (
          <div className="flex flex-col gap-3 animate-fade-in">
            {poolArchetypes.length === 0 ? (
              <p className="rounded-md bg-surface-2 p-3 text-center text-xs text-text-muted">
                추가 가능한 아키타입이 없습니다 (모두 패널에 포함됨).
              </p>
            ) : (
              poolArchetypes.map((p) => {
                const poolMember: CastMember = {
                  id: p.id,
                  source: 'archetype',
                  archetypeId: p.id,
                  name: p.name,
                  role: p.role,
                  trait: p.trait,
                  stance: '',
                  colorFrom: p.colorFrom,
                  colorTo: p.colorTo,
                };
                return (
                  <PersonaCard
                    key={p.id}
                    member={poolMember}
                    showActions={false}
                    onPick={onAddFromPool}
                  />
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 직접 만들기 (커스텀 폼) */}
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setCustomOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-md px-1 py-2 text-sm font-semibold uppercase tracking-wider text-text-muted hover:text-text"
        >
          <span>직접 만들기</span>
          <ChevronDown
            className={cn(
              'size-4 transition-transform',
              customOpen && 'rotate-180',
            )}
          />
        </button>
        {customOpen && (
          <CustomPersonaForm
            onSubmit={(input) => {
              onAddCustom(input);
              setCustomOpen(false);
            }}
            onCancel={() => setCustomOpen(false)}
          />
        )}
      </div>

      {/* swap 후보 모달 */}
      {swapTargetId && (
        <div
          className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => setSwapTargetId(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl border border-border bg-surface p-4 sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-text">
                교체할 아키타입 선택
              </h3>
              <button
                type="button"
                onClick={() => setSwapTargetId(null)}
                aria-label="닫기"
                className="text-text-muted hover:text-text"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
              {swapCandidates.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSwapPick(p.id)}
                  className="flex items-center gap-3 rounded-md border border-border bg-surface-2 p-2.5 text-left transition-colors hover:border-primary/40"
                >
                  <PersonaOrb persona={p} size={36} glow="none" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text">
                      {p.name}
                    </p>
                    <p className="truncate text-xs text-text-muted">
                      {p.role}
                    </p>
                  </div>
                  <span className="rounded-full bg-surface px-2 py-0.5 font-mono text-[10px] text-text-muted">
                    {LENS_LABEL_KR[p.trait.lens]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* sticky 하단 */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 sm:px-6">
          <div className="flex -space-x-2">
            {previewOrbs.slice(0, 5).map((p, i) => (
              <PersonaOrb
                key={`${p.name}-${i}`}
                persona={p}
                size={32}
                glow="none"
                className="ring-2 ring-background"
              />
            ))}
            {previewCount > 5 && (
              <div className="flex size-8 items-center justify-center rounded-full bg-surface-2 text-xs font-medium text-text-muted ring-2 ring-background">
                +{previewCount - 5}
              </div>
            )}
          </div>

          <span className="flex-1 truncate text-xs text-text-muted">
            <Users className="mr-1 inline size-3.5" />
            {previewCount}명 참여
          </span>

          <Button
            size="default"
            onClick={onStart}
            disabled={busy || previewCount < 2}
          >
            회의 시작
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── 커스텀 폼 ──────────────────────────────────────────────────────────────

interface CustomPersonaFormProps {
  onSubmit: (input: CustomPersonaInput) => void;
  onCancel: () => void;
}

const STANCE_OPTIONS: Array<{ value: StanceAxis; label: string }> = [
  { value: 'advocate', label: '옹호자' },
  { value: 'critic',   label: '비판자' },
  { value: 'agnostic', label: '회의자' },
];

const LENS_OPTIONS: Array<{ value: Lens; label: string }> = [
  { value: 'analyst',    label: '분석가' },
  { value: 'empath',     label: '공감가' },
  { value: 'pragmatist', label: '실용가' },
];

const EXPRESSION_OPTIONS: Array<{ value: Expression; label: string }> = [
  { value: 'measured',    label: '측정자' },
  { value: 'provocateur', label: '도발가' },
];

function CustomPersonaForm({ onSubmit, onCancel }: CustomPersonaFormProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [stanceAxis, setStanceAxis] = useState<StanceAxis | null>(null);
  const [lens, setLens] = useState<Lens | null>(null);
  const [expression, setExpression] = useState<Expression>('measured');
  const [stance, setStance] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'name' | 'role' | 'stanceAxis' | 'lens' | 'stance', string>>>({});

  function validate(): typeof errors {
    const err: typeof errors = {};
    const trimmedName = name.trim();
    const trimmedRole = role.trim();
    const trimmedStance = stance.trim();
    if (trimmedName.length < 1 || trimmedName.length > 20) {
      err.name = '이름은 1~20자 사이';
    }
    if (trimmedRole.length < 1 || trimmedRole.length > 40) {
      err.role = '역할은 1~40자 사이';
    }
    if (!stanceAxis) {
      err.stanceAxis = '입장을 선택해주세요';
    }
    if (!lens) {
      err.lens = '관점을 선택해주세요';
    }
    if (trimmedStance.length < 1 || trimmedStance.length > 120) {
      err.stance = '이 고민에서의 주장은 1~120자 사이';
    }
    return err;
  }

  function handleSubmit() {
    const err = validate();
    setErrors(err);
    if (Object.keys(err).length > 0) return;
    onSubmit({
      name: name.trim(),
      role: role.trim(),
      trait: { stanceAxis: stanceAxis!, lens: lens!, expression },
      stance: stance.trim(),
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface/60 p-4 animate-fade-in">
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-text-muted">이름</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 베테랑 수의사"
          maxLength={30}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary/60"
        />
        {errors.name && (
          <p className="text-[11px] text-rose-300">{errors.name}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-text-muted">한 줄 역할</label>
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="예: 동물병원 10년차 원장"
          maxLength={60}
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary/60"
        />
        {errors.role && (
          <p className="text-[11px] text-rose-300">{errors.role}</p>
        )}
      </div>

      {/* 입장 (stanceAxis) */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-text-muted">입장</label>
        <div className="flex flex-wrap gap-1.5">
          {STANCE_OPTIONS.map((s) => {
            const active = stanceAxis === s.value;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setStanceAxis(s.value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                  active
                    ? 'border-transparent bg-primary text-white'
                    : 'border-border text-text-muted hover:text-text',
                )}
              >
                {STANCE_LABEL_KR[s.value]}
              </button>
            );
          })}
        </div>
        {errors.stanceAxis && (
          <p className="text-[11px] text-rose-300">{errors.stanceAxis}</p>
        )}
      </div>

      {/* 관점 (lens) */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-text-muted">관점</label>
        <div className="flex flex-wrap gap-1.5">
          {LENS_OPTIONS.map((l) => {
            const active = lens === l.value;
            const colors = LENS_COLORS[l.value];
            return (
              <button
                key={l.value}
                type="button"
                onClick={() => setLens(l.value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                  active
                    ? 'border-transparent text-white'
                    : 'border-border text-text-muted hover:text-text',
                )}
                style={
                  active
                    ? { background: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }
                    : { borderColor: `${colors.to}55` }
                }
              >
                {LENS_LABEL_KR[l.value]}
              </button>
            );
          })}
        </div>
        {errors.lens && (
          <p className="text-[11px] text-rose-300">{errors.lens}</p>
        )}
      </div>

      {/* 표현 (expression) */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-text-muted">표현 방식</label>
        <div className="flex flex-wrap gap-1.5">
          {EXPRESSION_OPTIONS.map((e) => {
            const active = expression === e.value;
            return (
              <button
                key={e.value}
                type="button"
                onClick={() => setExpression(e.value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                  active
                    ? 'border-transparent bg-accent text-white'
                    : 'border-border text-text-muted hover:text-text',
                )}
              >
                {e.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-text-muted">
          이 고민에서의 입장
        </label>
        <Textarea
          rows={2}
          value={stance}
          onChange={(e) => setStance(e.target.value)}
          placeholder='예: "SaaS 보다 종이 차트가 낫다고 주장한다 — 도입 비용보다 운영 부담이 크다"'
          maxLength={160}
          className="min-h-[64px]"
        />
        <p className="text-[10px] text-text-muted">
          성향이 아니라 *주장* 으로 — &ldquo;비판적이다&rdquo; ✗ / &ldquo;X 하지 말라&rdquo; ✓
        </p>
        {errors.stance && (
          <p className="text-[11px] text-rose-300">{errors.stance}</p>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>
          취소
        </Button>
        <Button size="sm" onClick={handleSubmit}>
          추가
        </Button>
      </div>
    </div>
  );
}
