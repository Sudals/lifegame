/** 배경 소품 — 모든 함수는 팔레트 인덱스로만 그린다. 광원은 Rect로 반환해 밤 조명 계산·애니메이션 핫스팟에 쓴다. */
import { c, shift } from './palette';
import { PixelCanvas, rng } from './lib/canvas';
import { text } from './lib/font';

export type Time = 'day' | 'dusk' | 'night' | 'dawn';
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const W = 640;
export const H = 360;

// ───────────── 구조 ─────────────
export function wall(cv: PixelCanvas, y0: number, y1: number, base: number, opts: { panel?: number; stripe?: number; pattern?: 'dots' | 'stripes' } = {}): void {
  cv.rect(0, y0, W, y1 - y0, base);
  if (opts.pattern === 'dots') for (let y = y0 + 6; y < y1; y += 12) for (let x = ((y / 12) % 2) * 8; x < W; x += 16) cv.set(x, y, shift(base, -1));
  if (opts.pattern === 'stripes') for (let x = 0; x < W; x += 24) cv.rect(x, y0, 8, y1 - y0, shift(base, -1));
  if (opts.panel !== undefined) for (let x = 0; x < W; x += opts.panel) cv.vline(x, y0, y1, shift(base, -1));
}

export function wainscot(cv: PixelCanvas, y0: number, y1: number, base: number): void {
  cv.rect(0, y0, W, y1 - y0, base).hline(0, W, y0, shift(base, 1)).hline(0, W, y0 + 1, shift(base, -1));
  for (let x = 20; x < W; x += 80) cv.frame(x, y0 + 10, 60, y1 - y0 - 20, shift(base, -1));
}

export function baseboard(cv: PixelCanvas, y: number, col: number): void {
  cv.rect(0, y, W, 6, col).hline(0, W, y, shift(col, 1));
}

export function floorTiles(cv: PixelCanvas, y0: number, base: number, tile = 40): void {
  cv.rect(0, y0, W, H - y0, base);
  for (let y = y0; y < H; y += tile / 2) cv.hline(0, W, y, shift(base, -1));
  for (let row = 0; y0 + row * (tile / 2) < H; row++) for (let x = (row % 2) * (tile / 2); x < W; x += tile) cv.vline(x, y0 + row * (tile / 2), y0 + (row + 1) * (tile / 2), shift(base, -1));
  cv.dither(0, y0, W, 8, shift(base, -1), 0.4);
}

export function floorWood(cv: PixelCanvas, y0: number, base: number): void {
  cv.rect(0, y0, W, H - y0, base);
  const r = rng(7);
  for (let y = y0 + 9; y < H; y += 10) {
    cv.hline(0, W, y, shift(base, -1));
    for (let x = Math.floor(r() * 90); x < W; x += 90 + Math.floor(r() * 60)) cv.vline(x, y - 9, y, shift(base, -1));
  }
  cv.dither(0, y0, W, 6, shift(base, -1), 0.5);
}

export function ceiling(cv: PixelCanvas, h: number, base: number, lights: number[] = []): Rect[] {
  cv.rect(0, 0, W, h, base).hline(0, W, h, shift(base, -2));
  return lights.map((x) => {
    cv.rect(x - 40, h - 2, 80, 6, c('gray3')).rect(x - 38, h + 1, 76, 3, c('gray6'));
    return { x: x - 38, y: h + 1, w: 76, h: 3 };
  });
}

// ───────────── 창문 ─────────────
const SKY: Record<Time, string[]> = {
  day: ['blue3', 'blue4', 'blue4', 'blue5'],
  dusk: ['vio1', 'vio2', 'red3', 'gold3'],
  night: ['ink1', 'blue0', 'blue0', 'blue1'],
  dawn: ['blue1', 'vio2', 'red3', 'gold4'],
};

export function windowView(cv: PixelCanvas, x: number, y: number, w: number, h: number, time: Time, opts: { seed?: number; blinds?: number; city?: boolean; frame?: number } = {}): Rect {
  const r = rng(opts.seed ?? 3);
  const frameCol = opts.frame ?? c('gray5');
  cv.rect(x - 6, y - 6, w + 12, h + 12, frameCol).frame(x - 6, y - 6, w + 12, h + 12, shift(frameCol, -2));
  cv.vgrad(x, y, w, h, SKY[time].map(c));
  if (time === 'night') {
    for (let i = 0; i < w * h * 0.004; i++) cv.set(x + Math.floor(r() * w), y + Math.floor(r() * h * 0.6), r() > 0.7 ? c('gray6') : c('gray3'));
    const mx = x + w * 0.72;
    const my = y + h * 0.22;
    cv.ellipse(mx, my, 9, 9, c('gold4')).ellipse(mx + 4, my - 3, 8, 8, c('ink1'));
  } else if (time === 'day') {
    for (let i = 0; i < 3; i++) {
      const cx = x + 20 + r() * (w - 40);
      const cy = y + 12 + r() * h * 0.3;
      cv.ellipse(cx, cy, 14, 5, c('gray6')).ellipse(cx + 9, cy - 3, 9, 5, c('gray6')).hline(cx - 12, cx + 14, cy + 4, c('blue5'));
    }
  } else {
    cv.ellipse(x + w * 0.3, y + h * 0.78, 12, 12, time === 'dawn' ? c('gold4') : c('gold3'));
  }
  if (opts.city !== false) {
    let bx = x;
    while (bx < x + w) {
      const bw = Math.min(12 + Math.floor(r() * 22), x + w - bx);
      const bh = 18 + Math.floor(r() * h * 0.45);
      const col = time === 'night' ? c('ink2') : time === 'day' ? c('blue2') : c('vio0');
      cv.rect(bx, y + h - bh, bw, bh, col);
      for (let wy = y + h - bh + 4; wy < y + h - 3; wy += 6)
        for (let wx = bx + 3; wx < bx + bw - 3; wx += 5) {
          const lit = time === 'night' ? r() > 0.55 : time === 'day' ? r() > 0.4 : r() > 0.75;
          if (lit) cv.rect(wx, wy, 2, 3, time === 'night' ? c('gold3') : time === 'day' ? c('blue3') : c('gold2'));
        }
      bx += bw + 1;
    }
  }
  if (opts.blinds) {
    const bh = Math.floor(h * opts.blinds);
    for (let yy = y; yy < y + bh; yy += 4) cv.rect(x, yy, w, 3, c('gray5')).hline(x, x + w - 1, yy + 2, c('gray4'));
    cv.rect(x, y + bh, w, 3, c('gray4'));
    cv.vline(x + w - 8, y, y + bh + 14, c('gray3'));
  }
  // 창살
  cv.rect(x + Math.floor(w / 2) - 2, y, 4, h, frameCol).rect(x, y + Math.floor(h * 0.55), w, 3, frameCol);
  cv.rect(x - 10, y + h + 6, w + 20, 6, shift(frameCol, 1)).hline(x - 10, x + w + 9, y + h + 11, shift(frameCol, -2));
  return { x, y, w, h };
}

// ───────────── 가구 ─────────────
export function desk(cv: PixelCanvas, x: number, y: number, w: number, floorY: number, col = c('wood4')): void {
  cv.rect(x, y, w, 7, col).hline(x, x + w - 1, y, shift(col, 1)).rect(x, y + 7, w, 4, shift(col, -2));
  cv.rect(x + 6, y + 11, 6, floorY - y - 11, shift(col, -2)).rect(x + w - 12, y + 11, 6, floorY - y - 11, shift(col, -2));
  cv.rect(x + w - 80, y + 11, 64, 46, shift(col, -1)).hline(x + w - 80, x + w - 17, y + 34, shift(col, -2));
  cv.rect(x + w - 52, y + 20, 10, 2, c('gray4')).rect(x + w - 52, y + 44, 10, 2, c('gray4'));
}

export type ScreenKind = 'code' | 'graph' | 'paper' | 'slides';

export function screenContent(cv: PixelCanvas, s: Rect, kind: ScreenKind, seed = 1): void {
  const r = rng(seed);
  if (kind === 'code') {
    cv.rect(s.x, s.y, s.w, s.h, c('ink1'));
    for (let yy = s.y + 3; yy < s.y + s.h - 2; yy += 4) {
      const indent = Math.floor(r() * 3) * 4;
      let xx = s.x + 3 + indent;
      while (xx < s.x + s.w - 6 && r() > 0.12) {
        const len = 3 + Math.floor(r() * 9);
        cv.hline(xx, Math.min(s.x + s.w - 3, xx + len), yy, [c('teal3'), c('gold3'), c('red3'), c('gray4'), c('grn3')][Math.floor(r() * 5)]!);
        xx += len + 3;
      }
    }
  } else if (kind === 'graph') {
    cv.rect(s.x, s.y, s.w, s.h, c('gray6'));
    cv.vline(s.x + 4, s.y + 3, s.y + s.h - 4, c('gray3')).hline(s.x + 4, s.x + s.w - 4, s.y + s.h - 4, c('gray3'));
    let py = s.y + 4;
    for (let xx = s.x + 5; xx < s.x + s.w - 4; xx++) {
      const ny = s.y + s.h - 6 - Math.floor((s.h - 12) * Math.exp(-(xx - s.x) / (s.w / 4)));
      cv.line(xx - 1, py, xx, ny, c('red2'));
      py = ny;
    }
    for (let xx = s.x + 5; xx < s.x + s.w - 4; xx += 2) cv.set(xx, s.y + s.h - 8 - Math.floor(r() * 3), c('blue2'));
  } else if (kind === 'paper') {
    cv.rect(s.x, s.y, s.w, s.h, c('gray5'));
    cv.rect(s.x + s.w / 2 - 14, s.y + 2, 28, s.h - 4, c('gray6'));
    for (let yy = s.y + 6; yy < s.y + s.h - 4; yy += 3) cv.hline(s.x + s.w / 2 - 11, s.x + s.w / 2 + 11 - Math.floor(r() * 6), yy, c('gray3'));
  } else {
    cv.rect(s.x, s.y, s.w, s.h, c('blue1'));
  }
}

export function monitor(cv: PixelCanvas, x: number, y: number, w: number, h: number, kind: ScreenKind, seed = 1): Rect {
  cv.rect(x, y, w, h, c('ink2')).frame(x, y, w, h, c('ink0')).hline(x + 1, x + w - 2, y + 1, c('gray1'));
  const scr = { x: x + 3, y: y + 3, w: w - 6, h: h - 8 };
  screenContent(cv, scr, kind, seed);
  cv.rect(x + w / 2 - 1, y + h - 4, 2, 1, c('grn3'));
  cv.rect(x + w / 2 - 3, y + h, 6, 7, c('gray1')).rect(x + w / 2 - 12, y + h + 7, 24, 3, c('gray1')).hline(x + w / 2 - 12, x + w / 2 + 11, y + h + 7, c('gray2'));
  return scr;
}

export function laptop(cv: PixelCanvas, x: number, y: number, kind: ScreenKind): Rect {
  cv.poly([[x, y + 30], [x + 48, y + 30], [x + 54, y + 36], [x - 6, y + 36]], c('gray3')).hline(x - 6, x + 54, y + 36, c('gray1'));
  cv.rect(x, y, 48, 30, c('gray2')).frame(x, y, 48, 30, c('ink1'));
  const scr = { x: x + 3, y: y + 3, w: 42, h: 25 };
  screenContent(cv, scr, kind, 9);
  return scr;
}

export function keyboard(cv: PixelCanvas, x: number, y: number, w = 36): void {
  cv.rect(x, y, w, 5, c('gray3')).hline(x, x + w - 1, y + 4, c('gray1'));
  for (let i = x + 2; i < x + w - 2; i += 3) cv.set(i, y + 1, c('gray5')).set(i + 1, y + 3, c('gray5'));
}

export function mug(cv: PixelCanvas, x: number, y: number, col: number): { x: number; y: number } {
  cv.rect(x, y, 9, 10, col).hline(x, x + 8, y, c('wood0')).vline(x + 8, y + 1, y + 9, shift(col, -1)).frame(x + 9, y + 2, 4, 5, col).hline(x, x + 8, y + 10, shift(col, -2));
  return { x: x + 4, y: y - 1 };
}

export function paperStack(cv: PixelCanvas, x: number, y: number, n: number): void {
  for (let i = 0; i < n; i++) cv.rect(x + (i % 2), y - i * 2, 22, 2, i % 2 ? c('gray5') : c('gray6')).set(x + 21 + (i % 2), y - i * 2 + 1, c('gray3'));
}

export function books(cv: PixelCanvas, x: number, yBottom: number, w: number, seed: number, maxH = 26): void {
  const r = rng(seed);
  const cols = ['red1', 'blue2', 'grn1', 'gold2', 'vio1', 'teal1', 'wood1', 'gray2', 'red2', 'blue3'];
  let bx = x;
  while (bx < x + w - 4) {
    const bw = 3 + Math.floor(r() * 5);
    const bh = Math.floor(maxH * 0.65 + r() * maxH * 0.35);
    if (bx + bw > x + w) break;
    const col = c(cols[Math.floor(r() * cols.length)]!);
    cv.rect(bx, yBottom - bh, bw, bh, col).vline(bx + bw - 1, yBottom - bh, yBottom - 1, shift(col, -1)).hline(bx, bx + bw - 2, yBottom - bh + 3, shift(col, 1));
    bx += bw + (r() > 0.85 ? 3 : 0);
  }
}

export function bookshelf(cv: PixelCanvas, x: number, y: number, w: number, h: number, seed: number): void {
  const wood = c('wood2');
  cv.rect(x, y, w, h, c('wood1')).frame(x, y, w, h, c('wood0'));
  cv.rect(x + 4, y + 4, w - 8, h - 8, c('wood0'));
  for (let sy = y + 4, i = 0; sy + 34 <= y + h; sy += 36, i++) {
    books(cv, x + 6, sy + 30, w - 12, seed + i);
    cv.rect(x + 2, sy + 30, w - 4, 6, wood).hline(x + 2, x + w - 3, sy + 30, c('wood3'));
  }
}

export function whiteboard(cv: PixelCanvas, x: number, y: number, w: number, h: number, seed: number): void {
  cv.rect(x - 3, y - 3, w + 6, h + 6, c('gray3')).rect(x, y, w, h, c('gray6')).dither(x, y + h - 14, w, 14, c('gray5'), 0.25);
  text(cv, 'L = -LOG P(Y|X)', x + 10, y + 10, c('blue2'));
  text(cv, 'LR 3E-4 ?', x + 12, y + 24, c('red2'));
  const gx = x + w - 70;
  const gy = y + 12;
  cv.vline(gx, gy, gy + 40, c('ink2')).hline(gx, gx + 56, gy + 40, c('ink2'));
  let py = gy + 2;
  for (let i = 1; i < 56; i++) {
    const ny = gy + 38 - Math.floor(34 * (1 - Math.exp(-i / 12))) + (i % 7 === 0 ? 2 : 0);
    cv.line(gx + i - 1, py, gx + i, ny, c('grn1'));
    py = ny;
  }
  cv.line(x + 14, y + 44, x + 60, y + 44, c('ink2')).line(x + 56, y + 41, x + 60, y + 44, c('ink2')).line(x + 56, y + 47, x + 60, y + 44, c('ink2'));
  text(cv, 'SOTA!', x + 66, y + 41, c('grn1'));
  const r = rng(seed);
  for (let i = 0; i < 5; i++) cv.hline(x + 10, x + 30 + Math.floor(r() * 50), y + 58 + i * 6, c('gray3'));
  cv.rect(x + 10, y + h + 3, w - 20, 4, c('gray3')).rect(x + 20, y + h + 1, 10, 2, c('red2')).rect(x + 34, y + h + 1, 10, 2, c('blue2'));
}

export function chalkboard(cv: PixelCanvas, x: number, y: number, w: number, h: number): void {
  cv.rect(x - 5, y - 5, w + 10, h + 10, c('wood2')).rect(x, y, w, h, c('grn0')).dither(x, y, w, h, c('grn1'), 0.15);
  text(cv, 'ATTENTION(Q,K,V)', x + 14, y + 14, c('gray5'));
  text(cv, '= SOFTMAX(QK/D)V', x + 20, y + 28, c('gray5'));
  text(cv, 'MIDTERM: WEEK 8', x + 14, y + h - 22, c('gold3'));
  cv.rect(x + 4, y + h + 5, w - 8, 4, c('wood3')).rect(x + 30, y + h + 3, 8, 2, c('gray6'));
}

export function clock(cv: PixelCanvas, cx: number, cy: number, r = 9): void {
  cv.ellipse(cx, cy, r + 2, r + 2, c('ink2')).ellipse(cx, cy, r, r, c('gray6'));
  for (let i = 0; i < 12; i++) cv.set(cx + Math.round(Math.cos((i / 12) * Math.PI * 2) * (r - 2)), cy + Math.round(Math.sin((i / 12) * Math.PI * 2) * (r - 2)), c('gray3'));
  cv.line(cx, cy, cx, cy - r + 3, c('ink1')).line(cx, cy, cx + 4, cy + 2, c('ink1')).set(cx, cy, c('red2'));
}

export function serverRack(cv: PixelCanvas, x: number, y: number, w: number, h: number): Rect {
  cv.rect(x, y, w, h, c('ink2')).frame(x, y, w, h, c('ink0')).vline(x + 1, y + 1, y + h - 2, c('gray0'));
  for (let yy = y + 6; yy < y + h - 8; yy += 14) {
    cv.rect(x + 4, yy, w - 8, 11, c('ink1')).hline(x + 4, x + w - 5, yy, c('gray0'));
    for (let xx = x + 8; xx < x + w - 16; xx += 3) cv.vline(xx, yy + 3, yy + 8, c('ink0'));
  }
  return { x: x + w - 12, y: y + 8, w: 6, h: h - 20 };
}

export function chairBack(cv: PixelCanvas, cx: number, y: number, col = c('ink2')): void {
  cv.rect(cx - 2, y + 44, 4, 16, c('gray1'));
  cv.ellipse(cx, y + 22, 21, 24, col).rect(cx - 21, y + 22, 42, 22, col).ellipse(cx, y + 44, 21, 4, col);
  cv.dither(cx - 16, y + 4, 10, 34, shift(col, 1), 0.3);
  cv.rect(cx - 30, y + 58, 60, 4, c('gray1'));
}

export function plant(cv: PixelCanvas, x: number, yBottom: number, size = 1): void {
  const pw = Math.round(18 * size);
  const ph = Math.round(16 * size);
  const leaf = [c('grn1'), c('grn2'), c('grn3')];
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.36;
    const len = (22 + (i % 3) * 6) * size;
    const lx = x + Math.cos(a) * len;
    const ly = yBottom - ph + Math.sin(a) * len;
    cv.line(x, yBottom - ph, lx, ly, c('grn0'));
    cv.ellipse(lx, ly, 5 * size, 3 * size, leaf[i % 3]!).set(lx - 1, ly - 1, c('grn4'));
  }
  cv.poly([[x - pw / 2, yBottom - ph], [x + pw / 2, yBottom - ph], [x + pw / 2 - 3, yBottom], [x - pw / 2 + 3, yBottom]], c('red1'));
  cv.rect(x - pw / 2 - 1, yBottom - ph, pw + 2, 3, c('red2')).vline(x + pw / 2 - 4, yBottom - ph + 3, yBottom - 1, c('red0'));
}

export function deskLamp(cv: PixelCanvas, x: number, yBase: number): Rect {
  cv.rect(x - 8, yBase - 3, 16, 3, c('ink2'));
  cv.line(x, yBase - 3, x + 8, yBase - 26, c('gray2')).line(x + 1, yBase - 3, x + 9, yBase - 26, c('gray2'));
  cv.line(x + 8, yBase - 26, x - 6, yBase - 38, c('gray2'));
  cv.poly([[x - 14, yBase - 42], [x - 2, yBase - 40], [x - 6, yBase - 30], [x - 18, yBase - 32]], c('gold2'));
  return { x: x - 20, y: yBase - 32, w: 22, h: 4 };
}

export function poster(cv: PixelCanvas, x: number, y: number, w: number, h: number, title: string, col: number): void {
  cv.rect(x, y, w, h, c('gray6')).frame(x, y, w, h, c('gray3')).rect(x, y, w, 12, col);
  text(cv, title, x + 3, y + 3, c('gray6'));
  cv.rect(x + 4, y + 16, w / 2 - 6, h / 3, c('gray4')).rect(x + w / 2 + 2, y + 16, w / 2 - 6, h / 3, c('blue4'));
  for (let yy = y + 20 + h / 3; yy < y + h - 4; yy += 4) cv.hline(x + 4, x + w - 6, yy, c('gray4'));
  cv.set(x + w / 2, y + 1, c('red2'));
}

export function framePicture(cv: PixelCanvas, x: number, y: number, w: number, h: number, kind: 'landscape' | 'diploma'): void {
  cv.rect(x - 3, y - 3, w + 6, h + 6, c('gold1')).frame(x - 3, y - 3, w + 6, h + 6, c('gold0'));
  if (kind === 'landscape') {
    cv.vgrad(x, y, w, h, [c('blue4'), c('blue5'), c('gold4')]);
    cv.poly([[x, y + h], [x + w * 0.35, y + h * 0.45], [x + w * 0.6, y + h]], c('grn2')).poly([[x + w * 0.4, y + h], [x + w * 0.75, y + h * 0.35], [x + w, y + h * 0.8], [x + w, y + h]], c('grn1'));
    cv.ellipse(x + w * 0.8, y + h * 0.25, 4, 4, c('gold4'));
  } else {
    cv.rect(x, y, w, h, c('gray6')).frame(x + 2, y + 2, w - 4, h - 4, c('gold3'));
    for (let yy = y + 8; yy < y + h - 8; yy += 4) cv.hline(x + 8, x + w - 9, yy, c('gray4'));
    cv.ellipse(x + w - 10, y + h - 9, 4, 4, c('red2'));
  }
}

export function door(cv: PixelCanvas, x: number, y: number, w: number, h: number, col = c('wood3')): void {
  cv.rect(x - 4, y - 4, w + 8, h + 4, c('gray3')).rect(x, y, w, h, col);
  cv.frame(x + 6, y + 8, w - 12, h / 2 - 12, shift(col, -1)).frame(x + 6, y + h / 2 + 4, w - 12, h / 2 - 12, shift(col, -1));
  cv.rect(x + w - 12, y + h / 2, 6, 3, c('gold3'));
}

export function bed(cv: PixelCanvas, x: number, y: number, w: number, floorY: number): void {
  cv.rect(x, y - 30, 10, floorY - y + 30, c('wood2')).rect(x, y, w, floorY - y - 6, c('wood2'));
  cv.rect(x + 10, y - 8, w - 10, 14, c('gray6')).rect(x + 12, y - 14, 34, 10, c('gray5'));
  cv.poly([[x + 40, y - 10], [x + w, y - 6], [x + w, y + 14], [x + 30, y + 14]], c('blue3'));
  for (let xx = x + 44; xx < x + w; xx += 10) cv.line(xx, y - 8, xx - 6, y + 13, c('blue2'));
  cv.rect(x + w - 6, y - 16, 6, floorY - y + 16, c('wood2'));
}

export function sofa(cv: PixelCanvas, x: number, y: number, w: number, col: number): void {
  cv.rect(x, y, w, 30, col).rect(x - 10, y + 10, 16, 40, shift(col, -1)).rect(x + w - 6, y + 10, 16, 40, shift(col, -1));
  cv.rect(x, y + 28, w, 22, shift(col, 1)).hline(x, x + w - 1, y + 28, shift(col, 2));
  cv.vline(x + w / 2, y + 30, y + 49, shift(col, -1)).rect(x + 4, y + 50, 6, 8, c('wood1')).rect(x + w - 10, y + 50, 6, 8, c('wood1'));
  cv.rect(x + 14, y + 12, 26, 18, c('red3')).rect(x + 16, y + 14, 22, 2, c('red4'));
}

export function counter(cv: PixelCanvas, x: number, y: number, w: number, floorY: number, top: number, front: number): void {
  cv.rect(x, y, w, 8, top).hline(x, x + w - 1, y, shift(top, 1)).rect(x, y + 8, w, floorY - y - 8, front);
  for (let xx = x + 10; xx < x + w; xx += 40) cv.vline(xx, y + 12, floorY - 4, shift(front, -1));
}

export function productShelf(cv: PixelCanvas, x: number, y: number, w: number, h: number, seed: number): void {
  const r = rng(seed);
  cv.rect(x, y, w, h, c('gray4')).frame(x, y, w, h, c('gray2'));
  const cols = ['red2', 'gold3', 'teal3', 'grn3', 'blue3', 'vio2', 'red3', 'gold2'];
  for (let sy = y + 6; sy + 22 <= y + h; sy += 26) {
    let px = x + 4;
    while (px < x + w - 10) {
      const pw = 6 + Math.floor(r() * 6);
      const ph = 10 + Math.floor(r() * 10);
      const col = c(cols[Math.floor(r() * cols.length)]!);
      cv.rect(px, sy + 20 - ph, pw, ph, col).hline(px, px + pw - 1, sy + 20 - ph, shift(col, 1)).vline(px + pw - 1, sy + 20 - ph, sy + 19, shift(col, -1));
      px += pw + 1;
    }
    cv.rect(x + 2, sy + 20, w - 4, 4, c('gray5')).rect(x + 6, sy + 21, 8, 2, c('gold3'));
  }
}

export function fridge(cv: PixelCanvas, x: number, y: number, w: number, h: number, seed: number): Rect {
  const r = rng(seed);
  cv.rect(x, y, w, h, c('gray2')).frame(x, y, w, h, c('ink2'));
  const inner = { x: x + 4, y: y + 4, w: w - 8, h: h - 8 };
  cv.rect(inner.x, inner.y, inner.w, inner.h, c('teal4'));
  for (let sy = inner.y + 4; sy < inner.y + inner.h - 20; sy += 24) {
    for (let bx = inner.x + 3; bx < inner.x + inner.w - 6; bx += 7) {
      const col = c(['red2', 'grn2', 'gold2', 'blue2', 'teal1'][Math.floor(r() * 5)]!);
      cv.rect(bx, sy + 6, 5, 14, col).rect(bx + 1, sy + 3, 3, 3, c('gray5')).set(bx + 1, sy + 8, c('gray6'));
    }
    cv.hline(inner.x, inner.x + inner.w - 1, sy + 20, c('gray4'));
  }
  for (let dx = x + w / 3; dx < x + w - 2; dx += w / 3) cv.vline(Math.round(dx), y, y + h - 1, c('gray3'));
  cv.dither(inner.x, inner.y, inner.w, inner.h, c('gray6'), 0.08);
  return inner;
}

export function pendantLamp(cv: PixelCanvas, x: number, y: number): Rect {
  cv.vline(x, 0, y, c('ink2'));
  cv.poly([[x - 12, y + 12], [x + 12, y + 12], [x + 6, y], [x - 6, y]], c('ink2'));
  cv.rect(x - 4, y + 12, 8, 3, c('gold4'));
  return { x: x - 6, y: y + 12, w: 12, h: 3 };
}

export function audience(cv: PixelCanvas, y: number, seed: number, col = c('ink1')): void {
  const r = rng(seed);
  for (let row = 0; row < 2; row++) {
    const yy = y + row * 26;
    for (let x = -10 + row * 14 + Math.floor(r() * 8); x < W + 20; x += 26 + Math.floor(r() * 6)) {
      const tone = row === 0 ? shift(col, 1) : col;
      cv.ellipse(x, yy, 9, 10, tone).ellipse(x, yy + 22, 15, 12, tone);
      if (r() > 0.6) cv.ellipse(x, yy - 4, 9, 6, shift(tone, -1));
    }
  }
}

// ───────────── 조명 ─────────────
/** 밤: 모든 픽셀을 어둡게, 광원(keep) 영역은 유지 */
export function nightify(cv: PixelCanvas, keep: Rect[], amount = -2): void {
  const inKeep = (x: number, y: number) => keep.some((k) => x >= k.x && x < k.x + k.w && y >= k.y && y < k.y + k.h);
  cv.map((v, x, y) => (inKeep(x, y) ? v : shift(v, amount)));
}

/** 광원 주변에 디더로 빛 웅덩이 */
export function lightPool(cv: PixelCanvas, cx: number, cy: number, rx: number, ry: number, strength = 1): void {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
    for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d > 1) continue;
      const v = cv.get(x, y);
      if (v < 0) continue;
      const steps = d < 0.25 * strength ? 2 : d < 0.6 ? 1 : (x + y) % 2 === 0 ? 1 : 0;
      if (steps) cv.set(x, y, shift(v, steps));
    }
}
