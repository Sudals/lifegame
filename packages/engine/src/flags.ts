import type { ContentPack, FlagDef } from '@grad-sim/content';
import { applyEffects } from './stats';
import { PERMANENT, type GameState } from './state';

export function hasFlag(state: GameState, id: string): boolean {
  return (state.flags?.[id] ?? -1) > state.week;
}

export function setFlag(state: GameState, id: string, weeks?: number): void {
  state.flags[id] = weeks ? state.week + weeks : PERMANENT;
}

export function clearFlag(state: GameState, id: string): void {
  delete state.flags[id];
}

export interface ActiveFlag {
  def: FlagDef;
  weeksLeft: number | null; // null = 영구
}

export function activeFlags(pack: ContentPack, state: GameState): ActiveFlag[] {
  const out: ActiveFlag[] = [];
  for (const def of pack.flags) {
    if (!hasFlag(state, def.id)) continue;
    const exp = state.flags[def.id]!;
    out.push({ def, weeksLeft: exp >= PERMANENT ? null : exp - state.week });
  }
  return out;
}

/** 플래그로 생긴 주당 고정 시간 (조교·과제·외주 등) */
export function flagHours(pack: ContentPack, state: GameState): { name: string; hours: number }[] {
  return activeFlags(pack, state)
    .filter((f) => f.def.weeklyHours !== 0)
    .map((f) => ({ name: f.def.name, hours: f.def.weeklyHours }));
}

export function flagEfficiency(pack: ContentPack, state: GameState): number {
  return activeFlags(pack, state).reduce((m, f) => m * f.def.efficiency, 1);
}

/** 월 고정 수입(+)/지출(-) 내역 */
export function flagMonthly(pack: ContentPack, state: GameState): { name: string; amount: number }[] {
  return activeFlags(pack, state)
    .filter((f) => f.def.monthly !== 0)
    .map((f) => ({ name: f.def.name, amount: f.def.monthly }));
}

export function applyFlagWeekly(pack: ContentPack, state: GameState): void {
  for (const f of activeFlags(pack, state)) if (Object.keys(f.def.weekly).length) applyEffects(state, f.def.weekly);
}

/** 만료된 플래그 정리 + 안내 문구 */
export function expireFlags(pack: ContentPack, state: GameState): string[] {
  const ended: string[] = [];
  for (const [id, exp] of Object.entries(state.flags)) {
    if (exp > state.week) continue;
    delete state.flags[id];
    const def = pack.flags.find((f) => f.id === id);
    if (def && !def.hidden) ended.push(def.name);
  }
  return ended;
}
