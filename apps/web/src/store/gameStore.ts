import { create } from 'zustand';
import { aiPack as pack } from '@grad-sim/content';
import {
  activePapers,
  advanceWeek,
  dateOf,
  defaultPlan,
  formatDate,
  GAME_VERSION,
  newGame,
  type GameState,
  type NewGameOptions,
  type WeeklyPlan,
} from '@grad-sim/engine';
import { storage } from '../platform/SaveStorage';

export { pack };

export type Screen = 'title' | 'new' | 'game' | 'ranking';

interface Store {
  screen: Screen;
  game: GameState | null;
  plan: WeeklyPlan;
  slot: number;
  toast: string | null;
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

function sanitizePlan(g: GameState, plan: WeeklyPlan): WeeklyPlan {
  const active = activePapers(g);
  return { ...plan, focusPaperId: active.some((p) => p.id === plan.focusPaperId) ? plan.focusPaperId : (active[0]?.id ?? null) };
}

function autosave(g: GameState, slot: number): void {
  const label = `${g.player.name} · ${formatDate(dateOf(g, g.week))}`;
  storage.save(slot, JSON.stringify(g), label).catch((e) => console.warn('autosave failed', e));
}

export const useGame = create<Store>((set, get) => ({
  screen: 'title',
  game: null,
  plan: { sleepPerDay: 7, research: 30, study: 10, rest: 10, focusPaperId: null, counseling: false, attendConferenceId: null },
  slot: 1,
  toast: null,

  go: (screen) => set({ screen }),

  start(opts, slot) {
    const g = newGame(pack, opts);
    set({ game: g, slot, screen: 'game', plan: defaultPlan(g) });
    autosave(g, slot);
  },

  loadState(state, slot) {
    if (state.version !== GAME_VERSION) {
      // 세이브 포맷이 바뀌면 여기서 migrate 함수를 적용
      get().notify(`세이브 버전(${state.version})이 현재 버전(${GAME_VERSION})과 다릅니다.`);
    }
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
    const { plan } = get();
    if (get().run((g) => advanceWeek(pack, g, plan))) {
      set({ plan: { ...get().plan, counseling: false, attendConferenceId: null } });
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
