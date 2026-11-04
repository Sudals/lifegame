import { activePapers, attendCost, checkPlan, ongoingConferences, type GameState } from '@grad-sim/engine';
import { Panel, won } from '../../components/ui';
import { pack, useGame } from '../../store/gameStore';

function Slider({ label, value, max, step = 1, onChange, unit = 'h' }: { label: string; value: number; max: number; step?: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <label className="slider">
      <span>{label}</span>
      <input type="range" min={0} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="slider-value">
        {value}
        {unit}
      </span>
    </label>
  );
}

export function Planner({ game }: { game: GameState }) {
  const { plan, setPlan, advance } = useGame();
  const check = checkPlan(pack, game, plan);
  const active = activePapers(game);
  const conferences = ongoingConferences(pack, game).filter((d) => game.attendedConference?.venueId !== d.venueId);
  const remaining = check.freeHours - check.allocated;
  const f = check.forced;
  const blocked = game.inbox.length > 0;

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
        ]
          .filter(([, h]) => (h as number) > 0)
          .map(([name, h, c]) => (
            <span key={name as string} style={{ flexGrow: h as number, background: c as string }} title={`${name} ${h}h`} />
          ))}
      </div>
      <p className="dim small">
        강제: 생활 {f.living}h · 수업 {f.class}h · 과제 {f.project}h · 잡무 {f.chores}h
      </p>

      <Slider label="수면/일" value={plan.sleepPerDay} max={10} step={0.5} unit="h" onChange={(v) => setPlan({ sleepPerDay: Math.max(4, v) })} />
      <Slider label="연구" value={plan.research} max={100} onChange={(v) => setPlan({ research: v })} />
      <Slider label="공부" value={plan.study} max={60} onChange={(v) => setPlan({ study: v })} />
      <Slider label="휴식" value={plan.rest} max={60} onChange={(v) => setPlan({ rest: v })} />
      <p className={`remaining ${remaining < 0 ? 'bad' : ''}`}>
        남은 시간 {remaining}h / 배분 가능 {check.freeHours}h
      </p>

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

      <label className="check">
        <input type="checkbox" checked={plan.counseling} onChange={(e) => setPlan({ counseling: e.target.checked })} />
        상담/정신건강의학과 ({pack.balance.counselingHours}h, {won(pack.balance.counselingCost)}) — 스트레스↓
      </label>

      {conferences.length > 0 && (
        <label className="field">
          <span>🌏 개최 중인 학회 참석 (20h)</span>
          <select value={plan.attendConferenceId ?? ''} onChange={(e) => setPlan({ attendConferenceId: e.target.value || null })}>
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
