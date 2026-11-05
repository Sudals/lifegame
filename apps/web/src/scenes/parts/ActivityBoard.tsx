import { ACTIVITY_CATEGORY_LABELS, type Activity } from '@grad-sim/content';
import { activityList, checkPlan, hasFlag, normalizePlan, type GameState } from '@grad-sim/engine';
import { Icon } from '../../art/Sprite';
import { ACTIVITY_ICONS, effectText, manwon } from '../../components/effects';
import { fitPlan, pack, useGame } from '../../store/gameStore';

function hint(a: Activity): string {
  const parts = [effectText(a.effects)];
  if (a.outcomes.length) parts.push(a.outcomes.some((o) => o.skill) ? '결과는 실력·운에 따라' : '결과는 운에 따라');
  if (a.cooldown) parts.push(`한 번 하면 ${a.cooldown}주 뒤 다시`);
  return parts.filter(Boolean).join(' · ');
}

/** 이번 주 활동 고르기: 시간과 돈을 써서 체력·스트레스·연애·인맥·수입을 관리 */
export function ActivityBoard({ game }: { game: GameState }) {
  const { plan: raw, setPlan } = useGame();
  const plan = normalizePlan(pack, raw);
  const check = checkPlan(pack, game, plan);
  const list = activityList(pack, game);
  const inLove = hasFlag(game, 'relationship');
  const selected = new Set(plan.activities);

  const toggle = (a: Activity) => {
    const next = selected.has(a.id) ? plan.activities.filter((x) => x !== a.id) : [...plan.activities, a.id];
    setPlan(fitPlan(game, { ...plan, activities: next }));
  };

  const cats = Object.keys(ACTIVITY_CATEGORY_LABELS).filter((c) => c !== 'date' || inLove);
  // 남은 시간: 활동을 더하면 휴식→공부→연구 순으로 자동 조정된다
  const freeAfter = (a: Activity) => check.freeHours - a.hours;

  return (
    <div className="activity-board">
      <p className="dim small">
        고른 활동은 「한 주 보내기」 때 실행됩니다. 시간이 모자라면 휴식 → 공부 → 연구 순으로 줄어요. 선택 {selected.size}개 · {check.activityHours}h · 비용 {manwon(check.activityCost)}
        {inLove && (
          <>
            {' '}
            · <Icon name="love" size={12} /> 애정 {Math.round(game.hidden.affection)} (매주 -{pack.balance.affectionDecay})
          </>
        )}
      </p>
      {!inLove && (
        <p className="dim small">
          <Icon name="love" size={12} /> 연인이 생기면 데이트 활동이 열립니다. (사람 → 소개팅 나가기)
        </p>
      )}
      {cats.map((cat) => (
        <section key={cat}>
          <h3>
            <Icon name={ACTIVITY_ICONS[cat]!} /> {ACTIVITY_CATEGORY_LABELS[cat]}
          </h3>
          <div className="act-grid">
            {list
              .filter((x) => x.activity.category === cat)
              .map(({ activity: a, ok, reason }) => {
                const on = selected.has(a.id);
                const tooLong = !on && freeAfter(a) < 0;
                const broke = !on && a.cost > 0 && check.activityCost + a.cost > game.stats.money;
                const disabled = !on && (!ok || tooLong || broke);
                const earn = a.effects.money ?? 0;
                return (
                  <button key={a.id} className={`act-card ${on ? 'selected' : ''}`} disabled={disabled} onClick={() => toggle(a)} title={a.description}>
                    <strong>
                      {on ? '✔ ' : ''}
                      {a.name}
                    </strong>
                    <small className="act-meta">
                      {a.hours}h{a.cost ? ` · ${manwon(a.cost)}` : ''}
                      {earn > 0 && <span className="good"> · +{manwon(earn)}</span>}
                    </small>
                    <small className="dim">{hint(a)}</small>
                    {!ok && <small className="bad">{reason}</small>}
                    {ok && tooLong && <small className="bad">시간 부족</small>}
                    {ok && !tooLong && broke && <small className="bad">잔고 부족</small>}
                  </button>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
