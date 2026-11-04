import { rgb, shift } from '../palette';
import { encodePNG } from './png';

export const T = -1; // 투명

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** 결정적 RNG (에셋 생성은 항상 같은 결과) */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 팔레트 인덱스 픽셀 버퍼. 팔레트 밖 색은 저장 자체가 불가능. */
export class PixelCanvas {
  readonly px: Int16Array;
  constructor(
    readonly w: number,
    readonly h: number,
    fill = T,
  ) {
    this.px = new Int16Array(w * h).fill(fill);
  }

  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return T;
    return this.px[y * this.w + x]!;
  }

  set(x: number, y: number, col: number): this {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    this.px[y * this.w + x] = col;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, col: number): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, col);
    return this;
  }

  frame(x: number, y: number, w: number, h: number, col: number): this {
    this.hline(x, x + w - 1, y, col).hline(x, x + w - 1, y + h - 1, col);
    this.vline(x, y, y + h - 1, col).vline(x + w - 1, y, y + h - 1, col);
    return this;
  }

  hline(x0: number, x1: number, y: number, col: number): this {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, col);
    return this;
  }

  vline(x: number, y0: number, y1: number, col: number): this {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, col);
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, col: number): this {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, col: number): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / (rx + 0.5);
        const dy = (y - cy) / (ry + 0.5);
        if (dx * dx + dy * dy <= 1) this.set(x, y, col);
      }
    return this;
  }

  /** 다각형 채우기 (스캔라인) */
  poly(points: [number, number][], col: number): this {
    const ys = points.map((p) => p[1]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i]!;
        const [x1, y1] = points[(i + 1) % points.length]!;
        if (y0 === y1) continue;
        if ((y >= Math.min(y0, y1) && y < Math.max(y0, y1)) || (y === Math.max(y0, y1) && y === Math.max(...ys))) {
          xs.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) this.hline(Math.round(xs[k]!), Math.round(xs[k + 1]!), y, col);
    }
    return this;
  }

  /** 4x4 베이어 디더: density(0~1)만큼 col로 칠한다 */
  dither(x: number, y: number, w: number, h: number, col: number, density: number, mask?: (x: number, y: number) => boolean): this {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const X = x + i;
        const Y = y + j;
        if (mask && !mask(X, Y)) continue;
        if (BAYER4[((Y % 4) + 4) % 4]![((X % 4) + 4) % 4]! < density * 16) this.set(X, Y, col);
      }
    return this;
  }

  /** 세로 그라데이션: 색 띠 사이를 디더로 이음 */
  vgrad(x: number, y: number, w: number, h: number, cols: number[]): this {
    const n = cols.length;
    for (let j = 0; j < h; j++) {
      const t = (j / Math.max(1, h - 1)) * (n - 1);
      const i0 = Math.min(n - 1, Math.floor(t));
      const f = t - i0;
      for (let i = 0; i < w; i++) {
        const X = x + i;
        const Y = y + j;
        const useNext = i0 < n - 1 && BAYER4[Y % 4]![X % 4]! < f * 16;
        this.set(X, Y, cols[useNext ? i0 + 1 : i0]!);
      }
    }
    return this;
  }

  /** 기존 픽셀을 함수로 치환 (팔레트 스왑, 그림자 등) */
  map(fn: (col: number, x: number, y: number) => number, x = 0, y = 0, w = this.w, h = this.h): this {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) {
        const v = this.get(i, j);
        if (v !== T) this.set(i, j, fn(v, i, j));
      }
    return this;
  }

  /** 영역을 n단계 어둡게 (그림자/밤) */
  shade(x: number, y: number, w: number, h: number, n = -1): this {
    return this.map((v) => shift(v, n), x, y, w, h);
  }

  blit(src: PixelCanvas, dx: number, dy: number, opts: { flipX?: boolean; sx?: number; sy?: number; sw?: number; sh?: number } = {}): this {
    const sx = opts.sx ?? 0;
    const sy = opts.sy ?? 0;
    const sw = opts.sw ?? src.w;
    const sh = opts.sh ?? src.h;
    for (let j = 0; j < sh; j++)
      for (let i = 0; i < sw; i++) {
        const v = src.get(sx + (opts.flipX ? sw - 1 - i : i), sy + j);
        if (v !== T) this.set(dx + i, dy + j, v);
      }
    return this;
  }

  /** 실루엣 바깥쪽에 외곽선 */
  outline(col: number): this {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) !== T) continue;
        if (this.get(x - 1, y) !== T || this.get(x + 1, y) !== T || this.get(x, y - 1) !== T || this.get(x, y + 1) !== T) add.push(y * this.w + x);
      }
    for (const i of add) this.px[i] = col;
    return this;
  }

  clone(): PixelCanvas {
    const c = new PixelCanvas(this.w, this.h);
    c.px.set(this.px);
    return c;
  }

  toPNG(): Buffer {
    const out = new Uint8Array(this.w * this.h * 4);
    for (let i = 0; i < this.px.length; i++) {
      const v = this.px[i]!;
      if (v === T) continue;
      const [r, g, b] = rgb(v);
      out[i * 4] = r;
      out[i * 4 + 1] = g;
      out[i * 4 + 2] = b;
      out[i * 4 + 3] = 255;
    }
    return encodePNG(this.w, this.h, out);
  }
}
