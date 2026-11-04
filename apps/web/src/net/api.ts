import { aiPack as pack } from '@grad-sim/content';
import { findVenue, GAME_VERSION, paperTierKey, type GameState } from '@grad-sim/engine';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api';
const PLAYER_KEY = 'grad-sim:player';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body;
}

export interface Health {
  ok: boolean;
  db: string;
  postgres: string;
  latencyMs: number;
}
export const health = () => call<Health>('/health');

interface Player {
  id: string;
  nickname: string;
}

/** 익명 플레이어 ID (v0.1): 최초 클라우드 기능 사용 시 발급, localStorage 보관 */
export async function ensurePlayer(nickname: string): Promise<Player> {
  const raw = localStorage.getItem(PLAYER_KEY);
  if (raw) return JSON.parse(raw) as Player;
  const p = await call<Player>('/players', { method: 'POST', body: JSON.stringify({ nickname }) });
  localStorage.setItem(PLAYER_KEY, JSON.stringify(p));
  return p;
}

export function currentPlayer(): Player | null {
  const raw = localStorage.getItem(PLAYER_KEY);
  return raw ? (JSON.parse(raw) as Player) : null;
}

export async function cloudSave(slot: number, state: GameState): Promise<{ updatedAt: string }> {
  const p = await ensurePlayer(state.player.name);
  return call('/saves', {
    method: 'PUT',
    body: JSON.stringify({ playerId: p.id, slot, gameVersion: GAME_VERSION, data: state }),
  });
}

export interface CloudSaveMeta {
  slot: number;
  gameVersion: string;
  updatedAt: string;
}

export async function cloudList(): Promise<CloudSaveMeta[]> {
  const p = currentPlayer();
  if (!p) return [];
  return call(`/saves?playerId=${p.id}`);
}

export async function cloudLoad(slot: number): Promise<GameState> {
  const p = currentPlayer();
  if (!p) throw new Error('클라우드 세이브 기록이 없습니다.');
  const r = await call<{ data: GameState }>(`/saves?playerId=${p.id}&slot=${slot}`);
  return r.data;
}

export interface RankRow {
  id: string;
  nickname: string;
  labId: string;
  career: string;
  score: number;
  grade: string;
  finishedAt: string;
}

export const ranking = () => call<RankRow[]>('/runs?major=ai&limit=20');

export async function submitRun(state: GameState, nickname: string): Promise<{ id: string; score: number }> {
  if (!state.ending) throw new Error('엔딩에 도달하지 않았습니다.');
  const p = await ensurePlayer(nickname);
  const papers = state.papers
    .filter((x) => x.kind === 'paper' && x.stage === 'accepted' && x.venueId)
    .map((x) => ({ venue: findVenue(pack, x.venueId!)?.displayName ?? x.venueId!, tier: paperTierKey(pack, x) ?? '', authorOrder: x.authorOrder }));
  return call('/runs', {
    method: 'POST',
    body: JSON.stringify({
      playerId: p.id,
      nickname,
      major: state.major,
      labId: state.labId ?? 'none',
      career: state.ending.careerId ?? 'dropout',
      score: state.ending.score,
      grade: state.ending.grade,
      papers,
      seed: state.seed,
    }),
  });
}
