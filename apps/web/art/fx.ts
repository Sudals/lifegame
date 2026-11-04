/** 이펙트 스프라이트 시트 · 도장 · 아이콘 · UI 9-slice 프레임 */
import { c, shift } from './palette';
import { PixelCanvas, rng, T } from './lib/canvas';
import { text, textWidth } from './lib/font';

export interface Sheet {
  id: string;
  canvas: PixelCanvas;
  frameW: number;
  frameH: number;
  frames: number;
}

const sheet = (id: string, fw: number, fh: number, n: number, draw: (cv: PixelCanvas, i: number, ox: number) => void): Sheet => {
  const cv = new PixelCanvas(fw * n, fh);
  for (let i = 0; i < n; i++) draw(cv, i, i * fw);
  return { id, canvas: cv, frameW: fw, frameH: fh, frames: n };
};

/** 김: 위로 흔들리며 사라지는 3가닥 */
const steam = sheet('fx-steam', 12, 22, 6, (cv, i, ox) => {
  for (let k = 0; k < 3; k++) {
    const phase = (i + k * 2) % 6;
    const y = 20 - phase * 3;
    const x = ox + 3 + k * 3 + Math.round(Math.sin((phase + k) * 1.3) * 1.5);
    const col = phase < 3 ? c('gray6') : c('gray4');
    if (phase < 5) cv.rect(x, y, 2, 3 - (phase > 3 ? 1 : 0), col);
  }
});

/** 코드 스크롤 타일 (모니터 화면 위에서 위로 흐름) */
const code = (() => {
  const cv = new PixelCanvas(64, 64, c('ink1'));
  const r = rng(77);
  for (let y = 2; y < 64; y += 4) {
    let x = 2 + Math.floor(r() * 3) * 4;
    while (x < 58 && r() > 0.15) {
      const len = 3 + Math.floor(r() * 9);
      cv.hline(x, Math.min(61, x + len), y, [c('teal3'), c('gold3'), c('red3'), c('gray4'), c('grn3')][Math.floor(r() * 5)]!);
      x += len + 3;
    }
  }
  return { id: 'fx-code', canvas: cv, frameW: 64, frameH: 64, frames: 1 } as Sheet;
})();

/** 비 타일 (창문 안쪽) */
const rain = (() => {
  const cv = new PixelCanvas(32, 32);
  const r = rng(5);
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(r() * 32);
    const y = Math.floor(r() * 32);
    for (let k = 0; k < 4; k++) cv.set((x - k + 32) % 32, (y + k * 2) % 32, k === 0 ? c('gray5') : c('blue4'));
  }
  return { id: 'fx-rain', canvas: cv, frameW: 32, frameH: 32, frames: 1 } as Sheet;
})();

const zzz = sheet('fx-zzz', 20, 20, 4, (cv, i, ox) => {
  const draw = (x: number, y: number, s: number, col: number) => {
    cv.hline(x, x + s, y, col).hline(x, x + s, y + s, col);
    for (let k = 0; k <= s; k++) cv.set(x + s - k, y + k, col);
  };
  draw(ox + 2, 12 - i, 4, c('gray6'));
  if (i >= 1) draw(ox + 8, 8 - i, 3, c('gray5'));
  if (i >= 2) draw(ox + 13, 4 - (i - 2), 2, c('gray4'));
});

const sparkle = sheet('fx-sparkle', 13, 13, 4, (cv, i, ox) => {
  const s = [1, 3, 5, 2][i]!;
  const col = i === 2 ? c('gray6') : c('gold4');
  cv.hline(ox + 6 - s, ox + 6 + s, 6, col).vline(ox + 6, 6 - s, 6 + s, col);
  if (i === 2) cv.set(ox + 4, 4, c('gold3')).set(ox + 8, 4, c('gold3')).set(ox + 4, 8, c('gold3')).set(ox + 8, 8, c('gold3'));
  cv.set(ox + 6, 6, c('gray6'));
});

const firework = sheet('fx-firework', 48, 48, 6, (cv, i, ox) => {
  const cols = [c('gold4'), c('red3'), c('teal3'), c('gold3'), c('vio3'), c('grn4')];
  if (i === 0) return void cv.rect(ox + 23, 30, 2, 6, c('gold4'));
  const rad = i * 4;
  for (let a = 0; a < 16; a++) {
    const ang = (a / 16) * Math.PI * 2;
    const x = ox + 24 + Math.cos(ang) * rad;
    const y = 24 + Math.sin(ang) * rad + (i > 3 ? i - 3 : 0);
    const col = i > 4 ? c('gray4') : cols[a % cols.length]!;
    cv.rect(x, y, i < 4 ? 2 : 1, i < 4 ? 2 : 1, col);
    if (i >= 2 && i < 5) cv.set(ox + 24 + Math.cos(ang) * (rad - 3), 24 + Math.sin(ang) * (rad - 3), shift(col, -1));
  }
});

/** 리젝 먹구름 */
const cloud = sheet('fx-cloud', 40, 30, 4, (cv, i, ox) => {
  cv.ellipse(ox + 14, 10, 9, 6, c('gray2')).ellipse(ox + 24, 8, 10, 7, c('gray2')).ellipse(ox + 30, 12, 7, 5, c('gray2')).rect(ox + 8, 11, 26, 6, c('gray2'));
  cv.hline(ox + 8, ox + 33, 16, c('gray1')).ellipse(ox + 20, 6, 5, 3, c('gray3'));
  for (let k = 0; k < 5; k++) {
    const y = 19 + ((i * 3 + k * 5) % 10);
    cv.vline(ox + 11 + k * 5, y, y + 2, c('blue4'));
  }
});

const mail = sheet('fx-mail', 24, 18, 2, (cv, i, ox) => {
  cv.rect(ox + 2, 3, 20, 13, c('gray6')).frame(ox + 2, 3, 20, 13, c('gray3'));
  cv.line(ox + 2, 3, ox + 12, 10, c('gray3')).line(ox + 21, 3, ox + 12, 10, c('gray3'));
  cv.rect(ox + 10, 9, 4, 3, c('red2'));
  if (i === 1) cv.rect(ox + 18, 0, 6, 6, c('red2')).set(ox + 21, 2, c('gray6')).vline(ox + 21, 1, 3, c('gray6'));
});

/** 디더 화면 전환 타일: fx-wipe-0(투명) ~ fx-wipe-8(검정). CSS에서 반복 타일로 사용 */
const wipes: Sheet[] = Array.from({ length: 9 }, (_, f) => {
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const cv = new PixelCanvas(4, 4);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (BAYER[y * 4 + x]! < f * 2) cv.set(x, y, c('ink0'));
  return { id: `fx-wipe-${f}`, canvas: cv, frameW: 4, frameH: 4, frames: 1 };
});

/** 디더 빛 (램프 맥동) */
const glow = (() => {
  const cv = new PixelCanvas(64, 64);
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++) {
      const d = Math.hypot(x - 32, y - 32) / 32;
      if (d < 1 && BAYER[(y % 4) * 4 + (x % 4)]! < (1 - d) * 9) cv.set(x, y, c('gold4'));
    }
  return { id: 'fx-glow', canvas: cv, frameW: 64, frameH: 64, frames: 1 } as Sheet;
})();

/** 달력 페이지 (주간 전환) */
const calendar = (() => {
  const cv = new PixelCanvas(72, 80);
  cv.rect(2, 8, 68, 70, c('gray6')).frame(2, 8, 68, 70, c('gray3')).rect(2, 8, 68, 18, c('red2')).hline(2, 69, 25, c('red1'));
  for (const x of [16, 36, 56]) cv.rect(x - 2, 2, 4, 10, c('gray2')).rect(x - 1, 3, 2, 8, c('gray4'));
  for (let r = 0; r < 4; r++) for (let k = 0; k < 7; k++) cv.rect(8 + k * 8, 50 + r * 6, 5, 3, c('gray5'));
  cv.rect(2, 76, 68, 2, c('gray4'));
  return { id: 'fx-calendar', canvas: cv, frameW: 72, frameH: 80, frames: 1 } as Sheet;
})();

/** 도장: 잉크 번짐 질감 */
function stamp(id: string, label: string, col: number): Sheet {
  const tw = textWidth(label, 2);
  const w = tw + 20;
  const h = 34;
  const cv = new PixelCanvas(w, h);
  cv.frame(1, 1, w - 2, h - 2, col).frame(2, 2, w - 4, h - 4, col).frame(5, 5, w - 10, h - 10, col);
  text(cv, label, 10, 10, col, 2);
  const r = rng(label.length * 31);
  cv.map((v) => (r() < 0.1 ? T : v));
  return { id, canvas: cv, frameW: w, frameH: h, frames: 1 };
}

// ───────────── 아이콘 16x16 ─────────────
export const ICONS = ['research', 'stress', 'stamina', 'luck', 'money', 'trust', 'relation', 'network', 'calendar', 'mail', 'paper', 'gpu', 'trophy', 'coffee', 'sleep', 'brain'] as const;

function drawIcon(cv: PixelCanvas, name: (typeof ICONS)[number], ox: number): void {
  const o = c('ink0');
  switch (name) {
    case 'research': // 책
      cv.rect(ox + 2, 3, 12, 10, c('blue2')).rect(ox + 3, 4, 5, 8, c('gray6')).rect(ox + 8, 4, 5, 8, c('gray5')).vline(ox + 8, 3, 13, c('blue1'));
      cv.hline(ox + 4, ox + 6, 6, c('gray3')).hline(ox + 9, ox + 11, 6, c('gray3')).hline(ox + 4, ox + 6, 8, c('gray3')).hline(ox + 9, ox + 11, 8, c('gray3'));
      break;
    case 'stress': // 번개
      cv.poly([[ox + 9, 1], [ox + 3, 9], [ox + 8, 9], [ox + 6, 15], [ox + 13, 6], [ox + 8, 6], [ox + 11, 1]], c('red3'));
      cv.set(ox + 8, 3, c('red4'));
      break;
    case 'stamina': // 하트
      cv.ellipse(ox + 5, 6, 3, 3, c('red2')).ellipse(ox + 10, 6, 3, 3, c('red2')).poly([[ox + 2, 7], [ox + 13, 7], [ox + 8, 13]], c('red2')).set(ox + 4, 5, c('red4'));
      break;
    case 'luck': // 클로버
      for (const [dx, dy] of [[0, -3], [3, 0], [0, 3], [-3, 0]]) cv.ellipse(ox + 8 + dx!, 7 + dy!, 2.5, 2.5, c('grn3'));
      cv.line(ox + 8, 9, ox + 11, 14, c('grn1')).set(ox + 7, 4, c('grn4'));
      break;
    case 'money': // 동전
      cv.ellipse(ox + 8, 8, 6, 6, c('gold2')).ellipse(ox + 8, 8, 4, 4, c('gold3')).vline(ox + 8, 5, 11, c('gold1')).hline(ox + 6, ox + 10, 6, c('gold1')).hline(ox + 6, ox + 10, 10, c('gold1')).set(ox + 5, 5, c('gold4'));
      break;
    case 'trust': // 별
      cv.poly([[ox + 8, 1], [ox + 10, 6], [ox + 15, 6], [ox + 11, 9], [ox + 13, 14], [ox + 8, 11], [ox + 3, 14], [ox + 5, 9], [ox + 1, 6], [ox + 6, 6]], c('gold3')).set(ox + 7, 4, c('gold4'));
      break;
    case 'relation': // 두 사람
      cv.ellipse(ox + 5, 5, 2.5, 2.5, c('teal3')).ellipse(ox + 5, 12, 4, 3, c('teal3')).ellipse(ox + 11, 5, 2.5, 2.5, c('vio3')).ellipse(ox + 11, 12, 4, 3, c('vio3'));
      break;
    case 'network': // 지구
      cv.ellipse(ox + 8, 8, 6, 6, c('blue3')).ellipse(ox + 6, 6, 2, 2, c('grn3')).ellipse(ox + 10, 10, 3, 2, c('grn3')).vline(ox + 8, 2, 14, c('blue4')).hline(ox + 2, ox + 14, 8, c('blue4'));
      break;
    case 'calendar':
      cv.rect(ox + 2, 3, 12, 11, c('gray6')).rect(ox + 2, 3, 12, 3, c('red2')).rect(ox + 5, 9, 2, 2, c('red2')).set(ox + 5, 2, o).set(ox + 10, 2, o);
      break;
    case 'mail':
      cv.rect(ox + 1, 4, 14, 9, c('gray6')).line(ox + 1, 4, ox + 8, 9, c('gray3')).line(ox + 14, 4, ox + 8, 9, c('gray3'));
      break;
    case 'paper':
      cv.rect(ox + 3, 1, 10, 14, c('gray6')).poly([[ox + 10, 1], [ox + 13, 4], [ox + 10, 4]], c('gray4'));
      for (let y = 6; y < 13; y += 2) cv.hline(ox + 5, ox + 11, y, c('gray3'));
      break;
    case 'gpu':
      cv.rect(ox + 3, 3, 10, 10, c('grn1')).rect(ox + 5, 5, 6, 6, c('ink2')).set(ox + 6, 6, c('teal3'));
      for (let k = 4; k < 13; k += 2) cv.set(ox + k, 1, c('gold3')).set(ox + k, 14, c('gold3')).set(ox + 1, k, c('gold3')).set(ox + 14, k, c('gold3'));
      break;
    case 'trophy':
      cv.rect(ox + 4, 2, 8, 6, c('gold3')).ellipse(ox + 8, 8, 4, 3, c('gold3')).frame(ox + 1, 3, 3, 4, c('gold2')).frame(ox + 12, 3, 3, 4, c('gold2'));
      cv.rect(ox + 7, 11, 2, 2, c('gold2')).rect(ox + 5, 13, 6, 2, c('wood2')).set(ox + 6, 3, c('gold4'));
      break;
    case 'coffee':
      cv.rect(ox + 3, 6, 8, 8, c('gray6')).frame(ox + 11, 8, 3, 4, c('gray6')).hline(ox + 3, ox + 10, 6, c('wood1'));
      cv.set(ox + 5, 3, c('gray4')).set(ox + 6, 2, c('gray4')).set(ox + 8, 3, c('gray4')).set(ox + 9, 2, c('gray4'));
      break;
    case 'sleep':
      cv.ellipse(ox + 8, 8, 6, 6, c('gold3')).ellipse(ox + 11, 6, 5, 5, T);
      for (let y = 0; y < 16; y++) for (let x = ox; x < ox + 16; x++) if (cv.get(x, y) === T && Math.hypot(x - ox - 8, y - 8) <= 6 && Math.hypot(x - ox - 11, y - 6) <= 5) cv.set(x, y, T);
      break;
    case 'brain':
      cv.ellipse(ox + 6, 8, 4, 5, c('red4')).ellipse(ox + 10, 8, 4, 5, c('red4')).vline(ox + 8, 4, 12, c('red3')).set(ox + 5, 6, c('red3')).set(ox + 11, 9, c('red3'));
      break;
  }
}

function icons(): Sheet {
  const cv = new PixelCanvas(16 * ICONS.length, 16);
  ICONS.forEach((n, i) => {
    const tile = new PixelCanvas(16, 16);
    drawIcon(tile, n, 0);
    tile.outline(c('ink0'));
    cv.blit(tile, i * 16, 0);
  });
  return { id: 'icons', canvas: cv, frameW: 16, frameH: 16, frames: ICONS.length };
}

/** 9-slice UI 프레임 24x24 (모서리 8px) */
function uiFrame(id: string, fill: number, border: number, hi: number): Sheet {
  const cv = new PixelCanvas(24, 24);
  cv.rect(1, 1, 22, 22, fill);
  cv.hline(3, 20, 0, c('ink0')).hline(3, 20, 23, c('ink0')).vline(0, 3, 20, c('ink0')).vline(23, 3, 20, c('ink0'));
  cv.set(1, 2, c('ink0')).set(2, 1, c('ink0')).set(21, 1, c('ink0')).set(22, 2, c('ink0')).set(1, 21, c('ink0')).set(2, 22, c('ink0')).set(21, 22, c('ink0')).set(22, 21, c('ink0'));
  cv.hline(3, 20, 1, border).hline(3, 20, 22, shift(border, -1)).vline(1, 3, 20, border).vline(22, 3, 20, shift(border, -1));
  cv.set(2, 2, border).set(21, 2, border).set(2, 21, shift(border, -1)).set(21, 21, shift(border, -1));
  cv.hline(3, 20, 2, hi).vline(2, 3, 20, hi);
  cv.set(0, 1, T).set(1, 0, T);
  return { id, canvas: cv, frameW: 24, frameH: 24, frames: 1 };
}

export function renderFx(): Sheet[] {
  return [
    steam,
    code,
    rain,
    zzz,
    sparkle,
    firework,
    cloud,
    mail,
    ...wipes,
    glow,
    calendar,
    stamp('stamp-accept', 'ACCEPT', c('red2')),
    stamp('stamp-reject', 'REJECT', c('blue2')),
    stamp('stamp-oral', 'ORAL!', c('gold2')),
    stamp('stamp-major', 'MAJOR REV', c('vio2')),
    stamp('stamp-minor', 'MINOR REV', c('grn2')),
    stamp('stamp-pass', 'PASS', c('red2')),
    icons(),
    uiFrame('ui-dialog', c('ink1'), c('gray4'), c('gray6')),
    uiFrame('ui-panel', c('ink2'), c('vio1'), c('vio2')),
    uiFrame('ui-paper', c('gray6'), c('gold2'), c('gold4')),
    uiFrame('ui-button', c('gold3'), c('gold1'), c('gold4')),
  ];
}
