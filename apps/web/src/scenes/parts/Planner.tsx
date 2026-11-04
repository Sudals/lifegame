import { useState } from 'react';
import { activePapers, attendCost, canDualTask, checkPlan, normalizePlan, ongoingConferences, type GameState, type WeeklyPlan } from '@grad-sim/engine';
import { Panel, won } from '../../components/ui';
import { pack, useGame } from '../../store/gameStore';

function Slider({
  label,
  value,
  min = 0,
  max,
  cap,
  step = 1,
  onChange,
  unit = 'h',
  format,
}: {
  label: string;
  value: number;
  min?: number;
  max: number;
  /** 남은 시간 때문에 실제로 올릴 수 있는 한계 (슬라이더 범위는 max 유지) */
  cap?: number;
  step?: number;
  onChange: (v: number) => void;
  unit?: string;
  format?: (v: number) => string;
}) {
  return (
    <label className="slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Math.min(Number(e.target.value), cap ?? Infinity))} />
      <span className="slider-value">{format ? format(value) : `${value}${unit}`}</span>
    </label>
  );
}

const PRESETS: Record<string, { label: string; sleep: number; research: number; study: number }> = {
  diligent: { label: '성실', sleep: 7, research: 0.6, study: 0.25 },
  balanced: { label: '워라밸', sleep: 7.5, research: 0.45, study: 0.2 },
  crunch: { label: '밤샘', sleep: 5, research: 0.8, study: 0.12 },
};

export function Planner({ game }: { game: GameState }) {
  const { plan: rawPlan, setPlan, advance } = useGame();
  const plan = normalizePlan(pack, rawPlan);
  const [openFixed, setOpenFixed] = useState(false);
  const check = checkPlan(pack, game, plan);
  const active = activePapers(game);
  const conferences = ongoingConferences(pack, game).filter((d) => game.attendedConference?.venueId !== d.venueId);
  const remaining = check.freeHours - check.allocated;
  const f = check.forced;
  const blocked = game.inbox.length > 0;
  const dual = canDualTask(pack, game);
  const b = pack.balance;

  /** 고정 일정이 바뀌어 넘치면 휴식 → 공부 → 연구 순으로 줄인다 */
  const fit = (next: Partial<WeeklyPlan>) => {
    const p = normalizePlan(pack, { ...plan, ...next });
    let over = p.research + p.study + p.rest - checkPlan(pack, game, p).freeHours;
    for (const k of ['rest', 'study', 'research'] as const) {
      if (over <= 0) break;
      const cut = Math.min(p[k], over);
      p[k] -= cut;
      over -= cut;
    }
    setPlan(p);
  };

  const preset = (key: keyof typeof PRESETS) => {
    const pr = PRESETS[key]!;
    const p = normalizePlan(pack, { ...plan, sleepPerDay: pr.sleep, research: 0, study: 0, rest: 0 });
    const free = Math.max(0, checkPlan(pack, game, p).freeHours);
    p.research = Math.floor(free * pr.research);
    p.study = Math.floor(free * pr.study);
    p.rest = Math.max(0, free - p.research - p.study);
    setPlan(p);
  };

  const fillRest = () => setPlan({ rest: plan.rest + Math.max(0, remaining) });

  return (
    <Panel title="주간 플래너 (168h)" className="planner">
      <div className="hours-bar" aria-label="시간 배분">
        {[
          ['수면', check.sleepHours, 'var(--c-sleep)'],
          ['생활', f.living, '#6c757d'],
          ['수업', f.class, '#8d99ae'],
          ['과제', f.project, '#e76f51'],
          ['잡무', f.chores, '#f4a261'],
          ['기타', check.extraHours, '#b5838d'],
          ['연구', plan.research, 'var(--c-research)'],
          ['공부', plan.study, '#43aa8b'],
          ['휴식', plan.rest, 'var(--c-stamina)'],
          ['남음', Math.max(0, remaining), '#2b2a4c'],
        ]
          .filter(([, h]) => (h as number) > 0)
          .map(([name, h, c]) => (
            <span key={name as string} style={{ flexGrow: h as number, background: c as string }} title={`${name} ${h}h`} />
          ))}
      </div>

      <div className="preset-row">
        {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((k) => (
          <button key={k} className="btn small" onClick={() => preset(k)}>
            {PRESETS[k]!.label}
          </button>
        ))}
        <button className="btn small ghost" disabled={remaining <= 0} onClick={fillRest} title="남은 시간을 휴식에">
          남은 {Math.max(0, remaining)}h → 휴식
        </button>
      </div>

      <Slider label="수면/일" value={plan.sleepPerDay} min={4} max={10} step={0.5} unit="h" onChange={(v) => fit({ sleepPerDay: v })} />
      <Slider label="연구" value={plan.research} max={100} cap={plan.research + Math.max(0, remaining)} onChange={(v) => setPlan({ research: v })} />
      <Slider label="공부" value={plan.study} max={60} cap={plan.study + Math.max(0, remaining)} onChange={(v) => setPlan({ study: v })} />
      <Slider label="휴식" value={plan.rest} max={60} cap={plan.rest + Math.max(0, remaining)} onChange={(v) => setPlan({ rest: v })} />
      <p className={`remaining ${remaining < 0 ? 'bad' : ''}`}>
        남은 시간 {remaining}h / 배분 가능 {check.freeHours}h
      </p>

      <button className="fixed-toggle" onClick={() => setOpenFixed((o) => !o)}>
        {openFixed ? '▾' : '▸'} 고정 일정 조정 — 생활 {f.living}h · 수업 {f.class}h · 과제 {f.project}h · 잡무 {f.chores}h
        {f.extra.length > 0 && ` · ${f.extra.map((x) => `${x.name} ${x.hours}h`).join(' · ')}`}
      </button>
      {openFixed && (
        <div className="fixed-box">
          <Slider
            label="생활"
            value={plan.living}
            min={b.livingMin}
            max={b.livingMax}
            onChange={(v) => fit({ living: v })}
            format={(v) => `${v}h`}
          />
          <small className="dim">식사·이동·씻기. 줄이면 체력↓ 스트레스↑ (기본 {b.livingHoursPerWeek}h)</small>
          {f.projectBase > 0 && (
            <>
              <Slider
                label="과제"
                value={plan.projectRatio}
                min={b.projectRatioMin}
                max={b.projectRatioMax}
                step={0.25}
                onChange={(v) => fit({ projectRatio: v })}
                format={(v) => `${Math.round(f.projectBase * v)}h`}
              />
              <small className="dim">기준 {f.projectBase}h. 덜 하면 교수 신뢰↓, 더 하면 신뢰↑</small>
            </>
          )}
          {f.choresBase > 0 && (
            <>
              <Slider label="잡무" value={plan.choreRatio} min={0} max={1} step={0.25} onChange={(v) => fit({ choreRatio: v })} format={(v) => `${Math.round(f.choresBase * v)}h`} />
              <small className="dim">기준 {f.choresBase}h. 미루면 랩 관계·신뢰↓</small>
            </>
          )}
        </div>
      )}

      <label className="field">
        <span>연구 집중 대상</span>
        <select value={plan.focusPaperId ?? ''} onChange={(e) => setPlan({ focusPaperId: e.target.value || null })}>
          <option value="">(없음)</option>
          {active.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} — {p.stage === 'experiment' ? '실험' : p.stage === 'writing' ? '작성' : '리비전'} {Math.round(p.progress)}%
            </option>
          ))}
        </select>
      </label>

      {dual ? (
        <>
          <label className="field">
            <span>✦ 두 번째 작업 (연구력 {b.dualTaskResearch}+ · 전환 비용 {Math.round((1 - b.multitaskEfficiency) * 100)}%)</span>
            <select value={plan.secondFocusPaperId ?? ''} onChange={(e) => setPlan({ secondFocusPaperId: e.target.value || null })}>
              <option value="">(한 가지에 집중)</option>
              {active
                .filter((p) => p.id !== plan.focusPaperId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} — {Math.round(p.progress)}%
                  </option>
                ))}
            </select>
          </label>
          {plan.secondFocusPaperId && (
            <Slider
              label="시간 비율"
              value={plan.split}
              min={0.2}
              max={0.8}
              step={0.1}
              onChange={(v) => setPlan({ split: v })}
              format={(v) => `${Math.round(plan.research * v)}:${Math.round(plan.research * (1 - v))}`}
            />
          )}
        </>
      ) : (
        <p className="dim small">🔒 연구력 {b.dualTaskResearch} 이상이면 두 작업을 동시에 진행할 수 있다 (현재 {Math.floor(game.stats.research)})</p>
      )}

      <label className="check">
        <input type="checkbox" checked={plan.counseling} onChange={(e) => fit({ counseling: e.target.checked })} />
        상담/정신건강의학과 ({b.counselingHours}h, {won(b.counselingCost)}) — 스트레스↓
      </label>

      {conferences.length > 0 && (
        <label className="field">
          <span>🌏 개최 중인 학회 참석 (20h)</span>
          <select value={plan.attendConferenceId ?? ''} onChange={(e) => fit({ attendConferenceId: e.target.value || null })}>
            <option value="">참석 안 함</option>
            {conferences.map((c) => {
              const v = pack.venues.find((x) => x.id === c.venueId)!;
              const cost = attendCost(pack, game, v.id);
              return (
                <option key={c.venueId} value={c.venueId}>
                  {v.displayName} — {cost === 0 ? '연구실 지원' : won(cost)}
                </option>
              );
            })}
          </select>
        </label>
      )}

      {check.errors.map((e) => (
        <p key={e} className="bad small">
          {e}
        </p>
      ))}
      <button className="btn primary big" disabled={!check.ok || blocked} onClick={advance}>
        {blocked ? '먼저 이벤트를 처리하세요' : '한 주 보내기 ▶'}
      </button>
    </Panel>
  );
}
