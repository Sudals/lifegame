import type { CSSProperties } from 'react';
import manifest from './manifest.json';

/** art/build.ts가 생성한 에셋 매니페스트 (도트 PNG는 public/art) */
export type Expression = 'normal' | 'happy' | 'tired' | 'frustrated' | 'flustered' | 'angry';
export type SceneId = keyof typeof manifest.scenes;
export type CharacterId = keyof typeof manifest.characters;
export type SheetId = keyof typeof manifest.sheets;
export type IconName = (typeof manifest.icons)[number];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Hotspots {
  screens: Rect[];
  code: Rect[];
  steam: { x: number; y: number }[];
  leds: Rect[];
  window?: Rect;
  lamps: Rect[];
  glow: { x: number; y: number; r: number }[];
}

export const STAGE_W = manifest.scene.w;
export const STAGE_H = manifest.scene.h;
export const FRAME = 128;
export const EXPRESSIONS = manifest.expressions as Expression[];

export function scene(id: SceneId) {
  return manifest.scenes[id] as { name: string; time: string; file: string; hotspots: Hotspots };
}

export function sheet(id: SheetId) {
  return manifest.sheets[id];
}

export function character(id: CharacterId) {
  return manifest.characters[id];
}

export function isCharacter(id: string): id is CharacterId {
  return id in manifest.characters;
}

export function professorSprite(labId: string | null): CharacterId {
  const id = `prof-${labId}`;
  return isCharacter(id) ? id : 'prof-vision-park';
}

export function rectStyle(r: Rect): CSSProperties {
  return { left: r.x, top: r.y, width: r.w, height: r.h };
}

/** 모든 PNG를 미리 로드 (첫 장면 전환 시 깜빡임 방지) */
export function preloadArt(): void {
  const files = [
    ...Object.values(manifest.scenes).map((s) => s.file),
    ...Object.values(manifest.characters).map((c) => c.file),
    ...Object.values(manifest.sheets).map((s) => s.file),
  ];
  for (const f of files) {
    const img = new Image();
    img.src = f;
  }
}

export const PALETTE = manifest.palette;
