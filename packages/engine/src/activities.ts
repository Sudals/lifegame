import type { Activity, ContentPack } from '@grad-sim/content';
import { hasFlag } from './flags';
import { applyChoice } from './outcome';
import { log } from './research';
import type { Rng } from './rng';
import { acceptedCount } from './scoring';
import type { GameState } from './state';
import { eventVars, fillTemplate } from './text';
import { dateOf, inSemester } from './time';

export interface ActivityStatus {
  activity: Activity;
  ok: boolean;
  reason?: string;
}

/** 이번 주에 고를 수 있는지 (돈은 계획 전체로 따로 확인) */
export function activityStatus(pack: ContentPack, state: GameState, a: Activity): ActivityStatus {
  const no = (reason: string) => ({ activity: a, ok: false, reason });
  if (a.requireFlags.some((f) => !hasFlag(state, f))) return no(a.requireFlags.includes('relationship') ? '연인이 있어야' : '조건 미충족');
  if (a.notFlags.some((f) => hasFlag(state, f))) return no(a.notFlags.includes('relationship') ? '이미 인연이 있다' : '지금은 불가');
  const last = state.activityLast[a.id];
  if (a.cooldown > 0 && last !== undefined && state.week - last < a.cooldown) return no(`${a.cooldown - (state.week - last)}주 후 가능`);
  if (a.months && !a.months.includes(dateOf(state, state.week).month)) return no('시기가 아님');
  if (a.semester !== undefined && inSemester(state.week) !== a.semester) return no(a.semester ? '학기 중에만' : '방학에만');
  if (a.minAccepted !== undefined && acceptedCount(state) < a.minAccepted) return no(`채택 논문 ${a.minAccepted}편 필요`);
  return { activity: a, ok: true };
}

export function activityList(pack: ContentPack, state: GameState): ActivityStatus[] {
  return pack.activities.map((a) => activityStatus(pack, state, a));
}

/** 계획에 담긴 활동 중 실제로 할 수 있는 것 */
export function plannedActivities(pack: ContentPack, state: GameState, ids: readonly string[]): Activity[] {
  return ids
    .map((id) => pack.activities.find((a) => a.id === id))
    .filter((a): a is Activity => !!a && activityStatus(pack, state, a).ok);
}

/** 주간 진행 중: 활동 비용을 내고 효과·결과를 적용한다 */
export function runActivities(pack: ContentPack, s: GameState, ids: readonly string[], rng: Rng): void {
  const list = plannedActivities(pack, s, ids);
  if (!list.length) return;
  const vars = eventVars(pack, s, rng);
  for (const a of list) {
    s.stats.money -= a.cost;
    s.activityLast[a.id] = s.week;
    const { result, tone } = applyChoice(pack, s, a, rng);
    const earn = a.effects.money ?? 0;
    const money = a.cost ? ` (-${a.cost.toLocaleString()}원)` : earn > 0 ? ` (+${earn.toLocaleString()}원)` : '';
    log(s, `[${a.name}] ${fillTemplate(result, vars)}${money}`, a.outcomes.length ? tone : a.category === 'money' ? 'good' : 'info');
  }
}
