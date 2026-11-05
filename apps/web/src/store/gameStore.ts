import { create } from 'zustand';
import { aiPack as pack } from '@grad-sim/content';
import {
  activePapers,
  activityStatus,
  advanceWeek,
  checkPlan,
  dateOf,
  defaultPlan,
  formatDate,
  GAME_VERSION,
  migrate,
  newGame,
  normalizePlan,
  PLAN_DEFAULTS,
  type GameState,
  type NewGameOptions,
  type WeeklyPlan,
} from '@grad-sim/engine';
import { storage } from '../platform/SaveStorage';
import { useFx } from '../art/fx';

export { pack };

export type Screen = 'title' | 'new' | 'game' | 'ranking';
export type MainTab = 'research' | 'activity' | 'shop' | 'calendar' | 'log';

interface Store {
  screen: Screen;
  game: GameState | null;
  plan: WeeklyPlan;
  slot: number;
  toast: string | null;
  /** 지난 주 대비 스탯 변화 (HUD 팝업) */
  deltas: { key: string; value: number; at: number }[];
  tab: MainTab;
  setTab(tab: MainTab): void;
  go(screen: Screen): void;
  start(opts: NewGameOptions, slot: number): void;
  loadState(state: GameState, slot: number): void;
  /** 엔진 액션 실행: 실패 시 토스트, 성공 시 자동 저장 */
  run(fn: (g: GameState) => GameState): boolean;
  setPlan(p: Partial<WeeklyPlan>): void;
  advance(): void;
  notify(msg: string): void;
  clearToast(): void;
}

/** 고정 시간이 늘어 배분이 넘치면 휴식 → 공부 → 연구 순으로 줄인다 */
export function fitPlan(g: GameState, plan: WeeklyPlan): WeeklyPlan {
  const p = normalizePlan(pack, plan);
  let over = p.research + p.study + p.rest - Math.max(0, checkPlan(pack, g, p).freeHours);
  for (const k of ['rest', 'study', 'research'] as const) {
    if (over <= 0) break;
    const cut = Math.min(p[k], over);
    p[k] -= cut;
    over -= cut;
  }
  return p;
}

function sanitizePlan(g: GameState, plan: WeeklyPlan): WeeklyPlan {
  const active = activePapers(g);
  const p = normalizePlan(pack, { ...PLAN_DEFAULTS, ...plan });
  const focusPaperId = active.some((x) => x.id === p.focusPaperId) ? p.focusPaperId : (active[0]?.id ?? null);
  const secondFocusPaperId =
    p.secondFocusPaperId && p.secondFocusPaperId !== focusPaperId && active.some((x) => x.id === p.secondFocusPaperId) ? p.secondFocusPaperId : null;
  // 쿨다운·조건이 안 맞게 된 활동은 빼고 (매주 하는 운동 같은 건 그대로 유지)
  const activities = g.phase === 'semester' ? p.activities.filter((id) => activityStatus(pack, g, pack.activities.find((a) => a.id === id)!).ok) : [];
  return fitPlan(g, { ...p, focusPaperId, secondFocusPaperId, activities });
}

/** 주간 진행 후 연출: 달력 넘김, 채택/리젝 도장 */
function directWeek(prev: GameState, next: GameState): void {
  const fx = useFx.getState();
  const d = dateOf(next, next.week);
  fx.play('week', { label: `${d.month}월
${d.weekOfMonth}주차` });
  let delay = 1100;
  for (const p of next.papers) {
    const before = prev.papers.find((x) => x.id === p.id);
    const newReview = p.reviews.length > (before?.reviews.length ?? 0) ? p.reviews.at(-1) : undefined;
    if (p.stage === 'accepted' && before?.stage !== 'accepted') {
      fx.play(p.presentation === 'oral' ? 'oral' : p.kind === 'thesis' ? 'pass' : 'accept', { delay });
      delay += 2200;
    } else if (newReview?.decision === 'reject') {
      fx.play('reject', { delay });
      delay += 2000;
    } else if (newReview?.decision === 'major' || newReview?.decision === 'minor') {
      fx.play(newReview.decision, { delay });
      delay += 1800;
    }
  }
  if (next.phase === 'career') fx.play('firework', { delay });
}

function statDeltas(prev: GameState, next: GameState) {
  const at = Date.now();
  const raw: [string, number][] = [
    ['research', next.stats.research - prev.stats.research],
    ['stress', next.stats.stress - prev.stats.stress],
    ['stamina', next.stats.stamina - prev.stats.stamina],
    ['money', next.stats.money - prev.stats.money],
  ];
  return raw.filter(([k, v]) => Math.abs(v) >= (k === 'money' ? 1 : 0.5)).map(([key, value]) => ({ key, value, at }));
}

function autosave(g: GameState, slot: number): void {
  const label = `${g.player.name} · ${formatDate(dateOf(g, g.week))}`;
  storage.save(slot, JSON.stringify(g), label).catch((e) => console.warn('autosave failed', e));
}

export const useGame = create<Store>((set, get) => ({
  screen: 'title',
  game: null,
  plan: { ...PLAN_DEFAULTS, activities: [], sleepPerDay: 7, research: 30, study: 10, rest: 10, focusPaperId: null, counseling: false, attendConferenceId: null },
  slot: 1,
  toast: null,
  deltas: [],
  tab: 'research',
  setTab: (tab) => set({ tab }),

  go: (screen) => set({ screen }),

  start(opts, slot) {
    const g = newGame(pack, opts);
    set({ game: g, slot, screen: 'game', plan: defaultPlan(g) });
    autosave(g, slot);
  },

  loadState(raw, slot) {
    const state = raw.version === GAME_VERSION ? raw : migrate(raw);
    if (raw.version !== GAME_VERSION) get().notify(`세이브를 ${raw.version} → ${GAME_VERSION} 형식으로 변환했습니다.`);
    set({ game: state, slot, screen: 'game', plan: sanitizePlan(state, defaultPlan(state)) });
  },

  run(fn) {
    const { game, slot } = get();
    if (!game) return false;
    try {
      const next = fn(game);
      set({ game: next, plan: sanitizePlan(next, get().plan) });
      autosave(next, slot);
      return true;
    } catch (e) {
      get().notify(e instanceof Error ? e.message : String(e));
      return false;
    }
  },

  setPlan: (p) => set({ plan: { ...get().plan, ...p } }),

  advance() {
    const { plan, game: prev } = get();
    if (get().run((g) => advanceWeek(pack, g, plan))) {
      const next = get().game!;
      set({ plan: fitPlan(next, { ...get().plan, counseling: false, attendConferenceId: null }), deltas: statDeltas(prev!, next) });
      directWeek(prev!, next);
    }
  },

  notify(msg) {
    set({ toast: msg });
    window.setTimeout(() => {
      if (get().toast === msg) set({ toast: null });
    }, 3500);
  },
  clearToast: () => set({ toast: null }),
}));
