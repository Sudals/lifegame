/**
 * 반신 캐릭터 생성기 — 128x128 프레임, 레이어(뒷머리/몸/목/얼굴/표정/앞머리/소품) 합성.
 * 시트 = 행: 표정 6종 × 열: [기본, 반눈, 눈감음, 반입, 말하기]
 * 다듬기: 선택적 외곽선(sel-out), 머리 깊이 음영·가닥·하이라이트, 앞머리 그림자, 홍채 그라데이션
 */
import { c, shift, tone, type Tone4 } from './palette';
import { PixelCanvas, T } from './lib/canvas';
import { text } from './lib/font';

export const FRAME = 128;
export const EXPRESSIONS = ['normal', 'happy', 'tired', 'frustrated', 'flustered', 'angry'] as const;
export const FRAMES = ['idle', 'blink-half', 'blink', 'talk-half', 'talk'] as const;
export type Expression = (typeof EXPRESSIONS)[number];
export type FrameKind = (typeof FRAMES)[number];

type HairStyle = 'short' | 'messy' | 'slick' | 'bob' | 'long' | 'ponytail' | 'bun' | 'wild' | 'hood';
type Outfit = 'hoodie' | 'suit' | 'cardigan' | 'jacket' | 'sweater' | 'labcoat' | 'tshirt' | 'blouse' | 'cloak';

export interface CharacterSpec {
  id: string;
  name: string;
  skin: 'light' | 'tan';
  hair: HairStyle;
  hairTone: Tone4;
  outfit: Outfit;
  outfitTone: Tone4;
  accent: number; // 넥타이/셔츠/포인트
  glasses?: 'round' | 'square';
  glassesColor?: number;
  beard?: 'stubble' | 'full';
  age?: 'young' | 'mid' | 'old';
  eyeBags?: boolean;
  lanyard?: boolean;
  iris?: number;
  shadowFace?: boolean; // 리뷰어 2
}

const CX = 64;
const EYE_Y = 53;
const EYE_L = 55;
const EYE_R = 73;
const BROW_Y = 46;
const MOUTH_Y = 66;

const INK = c('ink0');
const WHITE = c('gray6');

// ───────────── 마스크 ─────────────
function inHead(x: number, y: number): boolean {
  const a = ((x - CX) / 21.5) ** 2 + ((y - 48) / 22.5) ** 2 <= 1;
  const b = ((x - CX) / 17.5) ** 2 + ((y - 58) / 15.5) ** 2 <= 1;
  return a || b;
}

function inTorso(x: number, y: number): boolean {
  if (y < 82) return false;
  if (x >= 38 && x <= 90 && y >= 84) return true;
  if (y >= 99 && x >= 19 && x <= 109) return true;
  return ((x - 38) / 19) ** 2 + ((y - 99) / 15) ** 2 <= 1 || ((x - 90) / 19) ** 2 + ((y - 99) / 15) ** 2 <= 1;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const dith = (x: number, y: number, density: number) => BAYER4[(y & 3) * 4 + (x & 3)]! < density * 16;

/** 마스크 가장자리까지의 거리(1~4). 1 = 테두리 픽셀 */
function depthMap(mask: (x: number, y: number) => boolean, maxD = 4): Int8Array {
  const d = new Int8Array(FRAME * FRAME);
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      if (!mask(x, y)) continue;
      let k = 1;
      outer: for (; k < maxD; k++) {
        for (let j = -k; j <= k; j++)
          for (let i = -k; i <= k; i++) if ((Math.abs(i) === k || Math.abs(j) === k) && !mask(x + i, y + j)) break outer;
      }
      d[y * FRAME + x] = k;
    }
  return d;
}

/** 선택적 외곽선: 맞닿은 색의 어두운 톤, 빛 반대편(오른쪽·아래)은 더 어둡게 */
function selOutline(cv: PixelCanvas): void {
  const add: [number, number, number][] = [];
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      if (cv.get(x, y) !== T) continue;
      const L = cv.get(x - 1, y);
      const U = cv.get(x, y - 1);
      const R = cv.get(x + 1, y);
      const D = cv.get(x, y + 1);
      if (L === T && U === T && R === T && D === T) continue;
      const shadowSide = L !== T || U !== T; // 바깥 픽셀이 형태의 오른쪽/아래
      const n = L !== T ? L : U !== T ? U : R !== T ? R : D;
      const deep = shift(n, -3);
      add.push([x, y, shadowSide ? (deep === n ? INK : shift(deep, -1)) : shift(n, -2)]);
    }
  for (const [x, y, col] of add) cv.set(x, y, col);
}

const inCap = (x: number, y: number, rx = 24, ry = 18, cy = 40) => ((x - CX) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

interface HairMasks {
  back: (x: number, y: number) => boolean;
  front: (x: number, y: number) => boolean;
}

function hairMasks(style: HairStyle): HairMasks {
  const none = () => false;
  switch (style) {
    case 'short':
      return {
        back: none,
        front: (x, y) =>
          (inCap(x, y) && y < 41 + ((x >> 2) % 2) * 2 + (x > 70 ? 1 : 0)) || (y >= 38 && y <= 55 && ((x >= 42 && x <= 45) || (x >= 83 && x <= 86)) && inCap(x, y, 25, 22, 44)),
      };
    case 'messy': {
      const spikes = (x: number) => [0, 3, 1, 4, 0, 2, 5, 1, 3, 0, 4, 2][Math.abs(x >> 2) % 12]!;
      return {
        back: none,
        front: (x, y) => {
          const top = 40 - Math.sqrt(Math.max(0, 1 - ((x - CX) / 25) ** 2)) * 19 - spikes(x);
          return y >= top && y < 44 + ((x * 7) % 5) - 2 && x >= 39 && x <= 89 && (y < 44 || x < 46 || x > 82);
        },
      };
    }
    case 'slick':
      return {
        back: none,
        front: (x, y) => (inCap(x, y, 23, 17, 40) && y < 35 + Math.max(0, (x - 52) / 6)) || (y >= 34 && y <= 52 && ((x >= 42 && x <= 46) || (x >= 82 && x <= 86)) && inCap(x, y, 24, 22, 44)),
      };
    case 'bob':
      return {
        back: (x, y) => y >= 40 && y <= 74 && ((x - CX) / 26) ** 2 + ((y - 50) / 27) ** 2 <= 1,
        front: (x, y) =>
          (inCap(x, y, 25, 19, 40) && y < 43 + ((x >> 2) % 2)) ||
          (y >= 40 && y <= 73 - Math.abs(x - CX) / 6 && ((x - CX) / 26) ** 2 + ((y - 50) / 27) ** 2 <= 1 && Math.abs(x - CX) >= 18 - Math.max(0, y - 62) / 2),
      };
    case 'long':
      return {
        back: (x, y) => x >= 37 && x <= 91 && y >= 40 && y <= 114 - ((x * 5) % 9) - Math.abs(x - CX) / 6 && (y < 82 || x < 50 || x > 78),
        front: (x, y) => {
          const taper = Math.max(0, (y - 78) / 5);
          const end = 96 - ((x * 7) % 6);
          return (inCap(x, y, 25, 19, 40) && y < 43 + ((x >> 3) % 2)) || (y >= 40 && y <= end && ((x >= 39 + taper / 2 && x <= 46 - taper / 2) || (x >= 82 + taper / 2 && x <= 89 - taper / 2)));
        },
      };
    case 'ponytail':
      return {
        back: (x, y) => ((x - 92) / 7) ** 2 + ((y - 62) / 22) ** 2 <= 1 || ((x - 86) / 6) ** 2 + ((y - 38) / 6) ** 2 <= 1,
        front: (x, y) => (inCap(x, y) && y < 42 + ((x >> 2) % 2)) || (y >= 38 && y <= 54 && ((x >= 42 && x <= 45) || (x >= 83 && x <= 86)) && inCap(x, y, 25, 22, 44)),
      };
    case 'bun':
      return {
        back: (x, y) => ((x - CX) / 10) ** 2 + ((y - 20) / 8) ** 2 <= 1,
        front: (x, y) => (inCap(x, y, 23, 18, 40) && y < 38 + Math.abs(x - CX) / 5) || (y >= 36 && y <= 56 && ((x >= 42 && x <= 45) || (x >= 83 && x <= 86)) && inCap(x, y, 25, 23, 44)),
      };
    case 'wild':
      return {
        back: (x, y) => ((x - 41) / 9) ** 2 + ((y - 44) / 15) ** 2 <= 1 || ((x - 87) / 9) ** 2 + ((y - 44) / 15) ** 2 <= 1,
        front: (x, y) => {
          const tuft = [2, 0, 3, 1, 4, 0, 2][Math.abs((x + 1) >> 2) % 7]!;
          return (inCap(x, y, 25, 17, 39) && y < 33 - tuft + Math.abs(x - CX) / 3) || (y >= 36 && y <= 56 && ((x >= 41 && x <= 46) || (x >= 82 && x <= 87)));
        },
      };
    case 'hood':
      return {
        back: (x, y) => (((x - CX) / 31) ** 2 + ((y - 50) / 32) ** 2 <= 1 && y < 100) || (y >= 70 && y < 96 && Math.abs(x - CX) < 22 + (y - 70) / 2),
        front: (x, y) => ((x - CX) / 29) ** 2 + ((y - 48) / 30) ** 2 <= 1 && !(((x - CX) / 19) ** 2 + ((y - 56) / 22) ** 2 <= 1),
      };
  }
}

function fillHair(cv: PixelCanvas, mask: (x: number, y: number) => boolean, t: Tone4, back: boolean, strands = true): void {
  const D = depthMap(mask);
  const dep = (x: number, y: number) => (x < 0 || y < 0 || x >= FRAME || y >= FRAME ? 0 : D[y * FRAME + x]!);
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      const d = dep(x, y);
      if (!d) continue;
      const side = (x - CX) / 26 + (y - 40) / 90; // 왼쪽 위 광원
      let col = back ? t[1] : t[2];
      if (!back && (side > 0.42 || (side > 0.3 && dith(x, y, (side - 0.3) / 0.12)))) col = t[1];
      if (back && side > 0.35) col = t[0];
      if (back && d >= 2 && (x * 7 + (y >> 3)) % 9 === 0) col = shift(col, -1); // 뒷머리 결
      if (!back && d >= 2 && y > 50 && (x * 5) % 7 === 0) col = t[1]; // 옆머리 결
      if (d === 1) col = !mask(x, y + 1) ? t[0] : back ? t[0] : t[1];
      else if (d === 2 && !mask(x, y + 2)) col = shift(col, -1); // 머리끝 쪽 어둡게
      cv.set(x, y, col);
    }
  if (back) return;
  // 가닥: 정수리에서 앞머리 끝으로 — 간격·길이·휘어짐을 다르게, 중간중간 끊김
  const STRANDS = [
    [-17, 0.9, 1],
    [-10, 0.75, -1],
    [-4, 1, 1],
    [3, 0.6, 1],
    [9, 0.85, -1],
    [15, 0.7, 1],
  ] as const;
  for (const [dx, len, bend] of strands ? STRANDS : []) {
    const n = Math.round(26 * len);
    for (let i = 0; i <= n; i++) {
      const f = i / 26;
      const x = Math.round(CX - 2 + dx * 0.35 + (dx * 0.65 + bend * 3 * Math.sin(f * Math.PI)) * f);
      const y = 21 + i;
      if (i % 7 === 5) continue;
      if (dep(x, y) >= 2) cv.set(x, y, t[1]);
      if (dx < 0 && i % 5 === 1 && dep(x + 1, y) >= 2 && cv.get(x + 1, y) === t[2]) cv.set(x + 1, y, t[3]);
    }
  }
  // 하이라이트 링 — 덩어리로 끊어지게
  for (let y = 20; y < 46; y++)
    for (let x = 36; x < CX + 8; x++) {
      if (dep(x, y) < 2) continue;
      const r = Math.hypot(x - (CX - 3), (y - 41) * 1.3);
      if (Math.abs(r - 18) < 1.1 && (((x + 1) >> 2) + (y >> 3)) % 3 !== 0) cv.set(x, y, t[3]);
      else if (Math.abs(r - 18) < 1.8 && dith(x, y, 0.35)) cv.set(x, y, t[3]);
    }
}

/** 앞머리가 이마에 드리우는 그림자 */
function hairShadow(cv: PixelCanvas, front: (x: number, y: number) => boolean, skinBase: number, skinHi: number): void {
  const todo: [number, number][] = [];
  for (let y = 20; y < 70; y++)
    for (let x = 36; x < 92; x++) {
      if (!front(x, y) || front(x, y + 1) || !inHead(x, y + 1)) continue;
      for (const [dy, p] of [
        [1, 1],
        [2, 0.5],
      ] as const) {
        const v = cv.get(x, y + dy);
        if ((v === skinBase || v === skinHi) && (p === 1 || dith(x, y + dy, p))) todo.push([x, y + dy]);
      }
    }
  for (const [x, y] of todo) cv.set(x, y, shift(skinBase, -1));
}

// ───────────── 몸/의상 ─────────────
function drawOutfit(cv: PixelCanvas, s: CharacterSpec): void {
  const t = s.outfitTone;
  const TD = depthMap(inTorso);
  for (let y = 80; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      if (!inTorso(x, y)) continue;
      const d = TD[y * FRAME + x]!;
      let col = t[2];
      if (x > 87 || (x > 83 && dith(x, y, (x - 83) / 4))) col = t[1];
      if (y > 118 && x > 72 && x <= 87 && dith(x, y, (y - 118) / 8)) col = t[1];
      if (d <= 2 && x < 56 && y < 104 && !inTorso(x, y - d - 1)) col = t[3]; // 왼쪽 어깨 윤곽 하이라이트
      else if (d === 3 && x < 46 && y < 102 && !inTorso(x, y - 4) && dith(x, y, 0.5)) col = t[3];
      if (y < 90 && Math.abs(x - CX) < 15 && dith(x, y, 1 - (y - 82) / 9)) col = shift(col, -1); // 턱·목 그림자
      cv.set(x, y, col);
    }
  // 겨드랑이/팔 접힘선
  cv.line(30, 112, 34, 127, t[0]).line(98, 112, 94, 127, t[0]);
  const shirt = c('gray5');
  switch (s.outfit) {
    case 'hoodie': {
      cv.ellipse(CX, 85, 21, 7, t[1]).ellipse(CX, 84, 15, 4, t[0]);
      cv.line(57, 88, 56, 106, shirt).line(71, 88, 72, 106, shirt);
      cv.rect(55, 106, 3, 2, c('gray4')).rect(71, 106, 3, 2, c('gray4'));
      cv.hline(44, 84, 117, t[1]).line(44, 117, 40, 127, t[1]).line(84, 117, 88, 127, t[1]);
      break;
    }
    case 'suit': {
      cv.poly([[52, 82], [76, 82], [CX, 112]], shirt);
      cv.poly([[61, 85], [67, 85], [69, 106], [CX, 112], [59, 106]], s.accent);
      cv.rect(61, 84, 6, 4, shift(s.accent, -1));
      cv.line(52, 82, 47, 110, t[0]).line(53, 82, CX - 1, 112, t[1]);
      cv.line(76, 82, 81, 110, t[0]).line(75, 82, CX + 1, 112, t[1]);
      cv.rect(CX - 1, 116, 2, 2, t[0]).rect(CX - 1, 123, 2, 2, t[0]);
      cv.rect(78, 98, 8, 2, c('gray5'));
      break;
    }
    case 'cardigan': {
      cv.poly([[50, 82], [78, 82], [72, 127], [56, 127]], s.accent);
      cv.poly([[56, 82], [72, 82], [CX, 92]], shirt);
      cv.line(56, 82, CX, 92, c('gray3')).line(72, 82, CX, 92, c('gray3'));
      cv.line(50, 82, 56, 127, t[0]).line(78, 82, 72, 127, t[0]);
      for (let y = 98; y < 127; y += 8) cv.rect(52 + Math.floor((y - 82) / 8), y, 2, 2, c('gold3'));
      for (let x = 22; x < 50; x += 3) cv.vline(x, 123, 127, t[1]);
      break;
    }
    case 'jacket': {
      cv.poly([[48, 80], [56, 78], [58, 90], [50, 92]], t[3]).poly([[80, 80], [72, 78], [70, 90], [78, 92]], t[1]);
      cv.vline(CX, 88, 127, c('gray3')).rect(CX - 1, 96, 3, 4, c('gray4'));
      cv.frame(72, 100, 12, 9, t[0]);
      break;
    }
    case 'sweater': {
      cv.ellipse(CX, 84, 16, 5, t[1]).ellipse(CX, 83, 11, 3, c('skin2'));
      for (let x = 22; x < 108; x += 3) cv.vline(x, 122, 127, t[1]);
      scatter(cv, 26, 98, 30, 22, c('gray5'), 40, 7, inTorso);
      scatter(cv, 74, 108, 18, 12, c('gray4'), 14, 9, inTorso);
      break;
    }
    case 'labcoat': {
      cv.poly([[54, 82], [74, 82], [CX, 104]], s.accent);
      cv.line(54, 82, 46, 114, t[0]).line(74, 82, 82, 114, t[0]);
      cv.line(54, 82, CX - 1, 104, t[1]).line(74, 82, CX + 1, 104, t[1]);
      cv.frame(74, 102, 12, 10, t[1]).rect(77, 98, 2, 6, c('blue2')).rect(80, 99, 2, 5, c('red2'));
      break;
    }
    case 'tshirt': {
      cv.ellipse(CX, 83, 13, 4, t[0]).ellipse(CX, 82, 11, 3, c('skin2'));
      break;
    }
    case 'blouse': {
      cv.poly([[50, 82], [78, 82], [74, 127], [54, 127]], s.accent);
      cv.poly([[54, 80], [CX, 90], [52, 92]], shirt).poly([[74, 80], [CX, 90], [76, 92]], shirt);
      cv.line(50, 82, 54, 127, t[0]).line(78, 82, 74, 127, t[0]);
      for (let x = 22; x < 50; x += 3) cv.vline(x, 123, 127, t[1]);
      break;
    }
    case 'cloak': {
      cv.rect(56, 98, 16, 14, c('gold2')).frame(56, 98, 16, 14, c('gold0'));
      text(cv, '2', 61, 101, c('ink0'));
      break;
    }
  }
  if (s.lanyard) {
    cv.line(56, 84, 58, 106, c('teal2')).line(72, 84, 70, 106, c('teal2'));
    cv.rect(57, 106, 14, 12, c('gray5')).rect(57, 106, 14, 3, c('teal2')).rect(59, 111, 4, 5, c('skin2')).hline(64, 69, 112, c('gray3')).hline(64, 68, 114, c('gray3'));
  }
}

// ───────────── 얼굴 ─────────────
function drawHead(cv: PixelCanvas, s: CharacterSpec): void {
  const base = s.skin === 'light' ? c('skin3') : c('skin2');
  const dark = shift(base, -1);
  const hi = shift(base, 1);
  // 목 (턱 아래 그림자 → 밝아짐, 오른쪽 그림자)
  for (let y = 66; y < 86; y++)
    for (let x = 57; x < 71; x++) {
      let col = y < 70 || (y < 73 && dith(x, y, 0.5)) ? shift(dark, -1) : dark;
      if (x > 67) col = shift(dark, -1);
      if (x === 57 && y > 74) col = base;
      cv.set(x, y, col);
    }
  // 귀 (안쪽 음영)
  cv.ellipse(43, 54, 3, 5, base).ellipse(85, 54, 3, 5, dark);
  cv.vline(43, 52, 57, dark).set(44, 51, dark).vline(85, 52, 57, shift(dark, -1)).set(84, 51, shift(dark, -1));
  for (let y = 20; y < 80; y++)
    for (let x = 36; x < 92; x++) {
      if (!inHead(x, y)) continue;
      const d = x - CX;
      let col = base;
      if (d > 13 || (d > 11 && dith(x, y, (d - 11) / 2))) col = dark;
      if (y > 70 && d > 2) col = dark; // 턱 아래쪽 그림자
      if (d < -12 && y > 56 && y < 64 && dith(x, y, 0.5)) col = hi; // 왼쪽 볼 반사광
      cv.set(x, y, col);
    }
  // 코: 콧대 하이라이트 + 오른쪽 그림자 + 콧볼
  cv.set(CX - 1, 56, hi).set(CX - 1, 57, hi);
  cv.set(CX + 1, 57, dark).set(CX + 1, 58, dark).set(CX + 2, 59, dark).set(CX + 1, 60, dark).set(CX - 1, 60, dark).set(CX, 61, shift(dark, -1));
  if (s.age === 'old' || s.age === 'mid') {
    cv.set(48, 54, dark).set(48, 55, dark).set(80, 54, dark).set(80, 55, dark);
    if (s.age === 'old') cv.hline(58, 70, 38, dark).set(60, 67, dark).set(68, 67, dark);
  }
  if (s.beard === 'stubble') scatter(cv, 46, 63, 37, 14, shift(base, -2), 70, 3, (x, y) => inHead(x, y) && !(Math.abs(x - CX) < 7 && y < 70));
  if (s.beard === 'full') {
    for (let y = 60; y < 78; y++) for (let x = 40; x < 90; x++) if (inHead(x, y) && y > 63 - (Math.abs(x - CX) > 14 ? 8 : 0) && !(Math.abs(x - CX) < 5 && y > 63 && y < 69)) cv.set(x, y, s.hairTone[2]);
  }
}

function eye(cv: PixelCanvas, cx: number, kind: string, s: CharacterSpec, right: boolean): void {
  const iris = s.iris ?? c('wood1');
  const y = EYE_Y;
  if (s.shadowFace) {
    if (kind === 'closed') return void cv.hline(cx - 3, cx + 3, y, c('red1'));
    cv.hline(cx - 3, cx + 3, y, c('red3')).hline(cx - 2, cx + 2, y - 1, kind === 'wide' ? c('gold3') : c('red2'));
    if (kind === 'angry') cv.hline(cx - 3, cx + 3, y + 1, c('red3'));
    return;
  }
  const outer = right ? cx + 4 : cx - 4;
  const lash = () => cv.hline(cx - 4, cx + 4, y - 3, INK).hline(cx - 3, cx + 3, y - 4, INK).set(right ? cx + 5 : cx - 5, y - 4, INK).set(outer, y - 2, INK);
  switch (kind) {
    case 'open':
    case 'down':
    case 'angry': {
      cv.rect(cx - 3, y - 2, 7, 5, WHITE).hline(cx - 3, cx + 3, y - 2, c('gray4'));
      const iy = kind === 'down' ? y : y - 1;
      cv.rect(cx - 1, iy - 1, 4, 5, iris).rect(cx - 1, iy - 1, 4, 1, INK);
      cv.rect(cx, iy + 1, 2, 2, INK); // 동공
      cv.hline(cx - 1, cx + 2, iy + 3, shift(iris, 1)); // 아래쪽 밝은 홍채
      cv.set(cx - 1, iy, WHITE).set(cx, iy, WHITE).set(cx + 2, iy + 2, c('gray5')); // 하이라이트
      cv.set(outer, y + 2, s.skin === 'light' ? c('skin1') : c('skin0'));
      lash();
      if (kind === 'angry') {
        if (right) cv.line(cx - 4, y - 4, cx + 1, y - 2, INK).rect(cx - 3, y - 3, 3, 1, INK);
        else cv.line(cx + 4, y - 4, cx - 1, y - 2, INK).rect(cx + 1, y - 3, 3, 1, INK);
      }
      break;
    }
    case 'wide': {
      cv.ellipse(cx, y, 3, 3, WHITE);
      cv.hline(cx - 2, cx + 2, y - 4, INK).set(cx - 3, y - 3, INK).set(cx + 3, y - 3, INK).vline(cx - 4, y - 2, y + 1, INK).vline(cx + 4, y - 2, y + 1, INK);
      cv.rect(cx - 1, y - 1, 2, 2, iris);
      break;
    }
    case 'half':
    case 'halfblink': {
      cv.rect(cx - 3, y, 7, 3, WHITE).rect(cx - 1, y, 4, 3, iris).rect(cx, y + 1, 2, 2, INK).set(cx - 1, y, WHITE);
      cv.hline(cx - 4, cx + 4, y - 1, INK).hline(cx - 3, cx + 3, y - 2, kind === 'half' ? INK : s.skin === 'light' ? c('skin2') : c('skin1'));
      cv.set(right ? cx + 5 : cx - 5, y - 2, INK);
      break;
    }
    case 'happy':
      cv.set(cx - 4, y + 1, INK).set(cx - 3, y, INK).set(cx - 2, y - 1, INK).hline(cx - 1, cx + 1, y - 2, INK).set(cx + 2, y - 1, INK).set(cx + 3, y, INK).set(cx + 4, y + 1, INK);
      break;
    case 'closed':
      cv.hline(cx - 3, cx + 3, y + 1, INK).set(cx - 4, y, INK).set(cx + 4, y, INK).set(right ? cx + 5 : cx - 5, y - 1, INK);
      break;
  }
}

function brow(cv: PixelCanvas, cx: number, kind: string, col: number, right: boolean): void {
  const y = BROW_Y;
  const o = right ? -1 : 1; // 안쪽 방향
  const inner = cx + 4 * o;
  const outer = cx - 4 * o;
  const L = (x0: number, y0: number, x1: number, y1: number, thick = 2) => {
    cv.line(x0, y0, x1, y1, col);
    if (thick > 1) {
      // 안쪽 절반만 두껍게 (끝이 가늘어지는 눈썹)
      const mx = Math.round((x0 + x1) / 2);
      const my = Math.round((y0 + y1) / 2);
      cv.line(mx, my + 1, x1, y1 + 1, col);
    }
  };
  switch (kind) {
    case 'angry':
      return L(outer, y - 3, inner, y + 1);
    case 'sad':
      return L(outer, y + 1, inner, y - 3);
    case 'raised':
      return L(outer, y - 2, inner, y - 3);
    case 'relaxed':
      L(outer, y, cx, y - 1);
      return L(cx, y - 1, inner, y);
    case 'tired':
      return L(outer, y + 1, inner, y, 1);
    default:
      return L(outer, y, inner, y);
  }
}

function mouth(cv: PixelCanvas, kind: string, s: CharacterSpec): void {
  const y = MOUTH_Y;
  const line = s.skin === 'light' ? c('skin1') : c('skin0');
  const inside = c('red1');
  if (s.shadowFace) {
    if (kind === 'smile' || kind === 'open-smile' || kind === 'shout' || kind === 'grit') {
      cv.hline(58, 70, y, WHITE).hline(59, 69, y + 1, WHITE).set(58, y - 1, WHITE).set(70, y - 1, WHITE);
      for (let x = 60; x < 69; x += 2) cv.set(x, y + 1, INK);
    }
    return;
  }
  switch (kind) {
    case 'neutral':
      cv.hline(61, 67, y, line).hline(62, 66, y + 2, s.skin === 'light' ? c('skin2') : c('skin1'));
      return;
    case 'open-smile-small':
      cv.rect(60, y, 9, 2, inside).rect(61, y, 7, 1, WHITE).hline(59, 69, y - 1, line).hline(61, 67, y + 2, line);
      return;
    case 'flat':
      return void cv.hline(62, 66, y, line);
    case 'smile':
      return void cv.set(59, y - 1, line).set(60, y, line).hline(61, 67, y + 1, line).set(68, y, line).set(69, y - 1, line);
    case 'open-smile':
      cv.rect(59, y - 1, 11, 4, inside).hline(61, 67, y + 3, inside).rect(60, y - 1, 9, 1, WHITE).hline(62, 66, y + 2, c('red2'));
      cv.hline(58, 70, y - 2, line).set(58, y - 1, line).set(70, y - 1, line);
      return;
    case 'open':
      cv.rect(61, y - 1, 7, 4, inside).hline(62, 66, y + 2, c('red2')).frame(60, y - 2, 9, 6, line);
      return;
    case 'small-open':
      return void cv.rect(62, y, 5, 2, inside).frame(61, y - 1, 7, 4, line);
    case 'frown':
      return void cv.set(59, y + 2, line).set(60, y + 1, line).hline(61, 67, y, line).set(68, y + 1, line).set(69, y + 2, line);
    case 'wavy':
      for (let x = 59; x <= 69; x++) cv.set(x, y + ((x >> 1) % 2), line);
      return;
    case 'sad-open':
      cv.rect(61, y, 7, 3, inside).hline(60, 68, y - 1, line).set(59, y, line).set(69, y, line).hline(61, 67, y + 3, line);
      return;
    case 'o':
      return void cv.rect(63, y - 1, 3, 3, inside).frame(62, y - 2, 5, 5, line);
    case 'o-big':
      return void cv.rect(62, y - 2, 5, 5, inside).frame(61, y - 3, 7, 7, line);
    case 'grit':
      cv.rect(59, y - 1, 11, 4, WHITE).frame(58, y - 2, 13, 6, line).vline(62, y - 1, y + 2, c('gray3')).vline(66, y - 1, y + 2, c('gray3')).hline(59, 69, y + 1, c('gray4'));
      return;
    case 'shout':
      cv.rect(59, y - 2, 11, 7, inside).hline(59, 69, y - 2, WHITE).hline(61, 67, y + 3, c('red2')).frame(58, y - 3, 13, 9, line);
      return;
  }
}

interface FaceDef {
  eyes: string;
  brows: string;
  mouth: string;
  talk: string;
  talkHalf: string;
  blink: string;
  blinkHalf: string;
}

const FACES: Record<Expression, FaceDef> = {
  normal: { eyes: 'open', brows: 'flat', mouth: 'neutral', talk: 'open', talkHalf: 'small-open', blink: 'closed', blinkHalf: 'halfblink' },
  happy: { eyes: 'happy', brows: 'relaxed', mouth: 'smile', talk: 'open-smile', talkHalf: 'open-smile-small', blink: 'happy', blinkHalf: 'happy' },
  tired: { eyes: 'half', brows: 'tired', mouth: 'flat', talk: 'small-open', talkHalf: 'flat', blink: 'closed', blinkHalf: 'closed' },
  frustrated: { eyes: 'down', brows: 'sad', mouth: 'wavy', talk: 'sad-open', talkHalf: 'small-open', blink: 'closed', blinkHalf: 'halfblink' },
  flustered: { eyes: 'wide', brows: 'raised', mouth: 'o', talk: 'o-big', talkHalf: 'o', blink: 'closed', blinkHalf: 'halfblink' },
  angry: { eyes: 'angry', brows: 'angry', mouth: 'grit', talk: 'shout', talkHalf: 'grit', blink: 'closed', blinkHalf: 'halfblink' },
};

function glasses(cv: PixelCanvas, s: CharacterSpec): void {
  if (!s.glasses) return;
  const col = s.glassesColor ?? c('ink1');
  for (const cx of [EYE_L, EYE_R]) {
    if (s.glasses === 'round') {
      for (let a = 0; a < 64; a++) cv.set(cx + Math.round(Math.cos((a / 64) * Math.PI * 2) * 6), EYE_Y + Math.round(Math.sin((a / 64) * Math.PI * 2) * 5.5), col);
    } else cv.frame(cx - 6, EYE_Y - 5, 13, 10, col).hline(cx - 6, cx + 6, EYE_Y - 5, col).hline(cx - 6, cx + 6, EYE_Y - 6, col);
    cv.set(cx + 3, EYE_Y - 3, WHITE).set(cx + 4, EYE_Y - 2, WHITE); // 렌즈 반사
  }
  cv.hline(EYE_L + 6, EYE_R - 6, EYE_Y - 2, col);
  cv.hline(43, EYE_L - 6, EYE_Y - 2, col).hline(EYE_R + 6, 85, EYE_Y - 2, col);
}

function extras(cv: PixelCanvas, expr: Expression, s: CharacterSpec): void {
  const blush = c('red3');
  if (s.shadowFace) return;
  if (expr === 'happy' || expr === 'flustered') {
    for (const bx of [50, 78]) cv.dither(bx - 4, 59, 8, 3, blush, 0.5);
  }
  if (expr === 'tired' || s.eyeBags) {
    const bag = s.skin === 'light' ? c('skin2') : c('skin1');
    cv.hline(EYE_L - 3, EYE_L + 3, EYE_Y + 4, bag).hline(EYE_R - 3, EYE_R + 3, EYE_Y + 4, bag);
    if (expr === 'tired') cv.dither(EYE_L - 3, EYE_Y + 5, 7, 1, c('vio2'), 0.5).dither(EYE_R - 3, EYE_Y + 5, 7, 1, c('vio2'), 0.5);
  }
  if (expr === 'angry') {
    cv.dither(78, 58, 6, 3, c('red3'), 0.5);
  }
}

function overlay(cv: PixelCanvas, expr: Expression, s: CharacterSpec): void {
  if (expr === 'frustrated') {
    for (const gx of [56, 62, 68]) for (let y = 34; y < 46; y += 2) cv.set(gx, y, c('vio1'));
  }
  if (expr === 'flustered') {
    // 땀방울 (오른쪽 관자놀이)
    cv.poly([[89, 33], [86, 41], [92, 41]], c('teal3')).ellipse(89, 42, 3, 3, c('teal3'));
    cv.set(88, 40, WHITE).set(88, 41, c('teal4'));
    cv.line(89, 32, 85, 40, INK).line(89, 32, 93, 40, INK).vline(85, 40, 43, INK).vline(93, 40, 43, INK).hline(86, 92, 46, INK).set(86, 45, INK).set(92, 45, INK);
  }
  if (expr === 'angry' && !s.shadowFace) {
    const v = c('red2');
    const vx = 80;
    const vy = 30;
    cv.rect(vx - 3, vy - 1, 2, 2, v).rect(vx + 2, vy - 1, 2, 2, v).rect(vx - 3, vy + 3, 2, 2, v).rect(vx + 2, vy + 3, 2, 2, v);
    cv.set(vx - 1, vy, v).set(vx + 1, vy, v).set(vx - 1, vy + 3, v).set(vx + 1, vy + 3, v);
  }
}

/** 의상 질감용 산포 (결정적) */
function scatter(cv: PixelCanvas, x: number, y: number, w: number, h: number, col: number, n: number, seed: number, mask: (x: number, y: number) => boolean): void {
  let a = seed * 2654435761;
  for (let i = 0; i < n; i++) {
    a = (a * 1103515245 + 12345) >>> 0;
    const px = x + (a % w);
    a = (a * 1103515245 + 12345) >>> 0;
    const py = y + (a % h);
    if (mask(px, py)) cv.set(px, py, col);
  }
}

export function renderFrame(s: CharacterSpec, expr: Expression, frame: FrameKind): PixelCanvas {
  const cv = new PixelCanvas(FRAME, FRAME);
  const masks = hairMasks(s.hair);
  fillHair(cv, masks.back, s.hairTone, true);
  drawOutfit(cv, s);
  drawHead(cv, s);
  if (s.shadowFace) {
    for (let y = 26; y < 88; y++) for (let x = 36; x < 92; x++) if (inHead(x, y) || (y >= 66 && x >= 57 && x <= 70)) cv.set(x, y, (x + y) % 2 ? c('ink1') : c('ink2'));
  }
  const f = FACES[expr];
  const browCol = s.shadowFace ? T : s.hairTone[0];
  if (browCol !== T) {
    brow(cv, EYE_L, f.brows, browCol, false);
    brow(cv, EYE_R, f.brows, browCol, true);
  }
  const eyeKind = frame === 'blink' ? f.blink : frame === 'blink-half' ? f.blinkHalf : f.eyes;
  eye(cv, EYE_L, eyeKind, s, false);
  eye(cv, EYE_R, eyeKind, s, true);
  mouth(cv, frame === 'talk' ? f.talk : frame === 'talk-half' ? f.talkHalf : f.mouth, s);
  extras(cv, expr, s);
  fillHair(cv, masks.front, s.hairTone, false, s.hair !== 'hood');
  if (!s.shadowFace) {
    const base = s.skin === 'light' ? c('skin3') : c('skin2');
    hairShadow(cv, masks.front, base, shift(base, 1));
  }
  glasses(cv, s);
  selOutline(cv);
  overlay(cv, expr, s);
  return cv;
}

/** 시트: 열 = FRAMES, 행 = EXPRESSIONS */
export function renderSheet(s: CharacterSpec): PixelCanvas {
  const sheet = new PixelCanvas(FRAME * FRAMES.length, FRAME * EXPRESSIONS.length);
  EXPRESSIONS.forEach((e, row) => FRAMES.forEach((f, col) => sheet.blit(renderFrame(s, e, f), col * FRAME, row * FRAME)));
  return sheet;
}

// ───────────── 등장인물 ─────────────
export const CHARACTERS: CharacterSpec[] = [
  { id: 'player', name: '나', skin: 'light', hair: 'messy', hairTone: tone('ink', 0).map((v, i) => (i === 3 ? c('vio1') : v)) as Tone4, outfit: 'hoodie', outfitTone: tone('blue', 1), accent: c('gray5'), lanyard: true, age: 'young' },
  { id: 'prof-llm-kim', name: '강교수', skin: 'light', hair: 'slick', hairTone: [c('ink0'), c('ink2'), c('gray1'), c('gray3')], outfit: 'suit', outfitTone: tone('blue', 0), accent: c('red2'), glasses: 'square', age: 'mid' },
  { id: 'prof-vision-park', name: '박교수', skin: 'light', hair: 'short', hairTone: tone('wood', 0), outfit: 'cardigan', outfitTone: tone('wood', 2), accent: c('blue4'), glasses: 'round', glassesColor: c('wood1'), age: 'mid' },
  { id: 'prof-rl-lee', name: '이교수', skin: 'tan', hair: 'short', hairTone: tone('ink', 0).map((v, i) => (i === 3 ? c('gray2') : v)) as Tone4, outfit: 'jacket', outfitTone: tone('grn', 0), accent: c('gray5'), beard: 'stubble', age: 'mid' },
  { id: 'prof-eff-choi', name: '최교수', skin: 'light', hair: 'bob', hairTone: tone('gray', 2), outfit: 'blouse', outfitTone: tone('vio', 0), accent: c('gray5'), glasses: 'round', glassesColor: c('gold1'), age: 'old' },
  { id: 'prof-new-jung', name: '정교수', skin: 'light', hair: 'ponytail', hairTone: tone('ink', 0).map((v, i) => (i === 3 ? c('blue1') : v)) as Tone4, outfit: 'jacket', outfitTone: tone('teal', 0), accent: c('gray5'), age: 'young', iris: c('wood1') },
  { id: 'prof-ind-han', name: '한교수', skin: 'tan', hair: 'slick', hairTone: tone('wood', 0), outfit: 'suit', outfitTone: tone('gray', 1), accent: c('gold2'), age: 'mid' },
  { id: 'prof-theory-yoon', name: '윤교수', skin: 'light', hair: 'wild', hairTone: tone('gray', 3), outfit: 'sweater', outfitTone: tone('red', 0), accent: c('gray5'), glasses: 'round', beard: 'stubble', age: 'old' },
  // DBI 연구실 — 실존 인물의 외모가 아닌 일반적인 디자인 (비즈니스 캐주얼: 노타이 셔츠 + 재킷)
  { id: 'prof-dbi', name: '김은찬 교수', skin: 'light', hair: 'short', hairTone: tone('ink', 0).map((v, i) => (i === 3 ? c('blue1') : v)) as Tone4, outfit: 'suit', outfitTone: tone('gray', 0), accent: c('blue5'), glasses: 'square', glassesColor: c('ink2'), age: 'young' },
  { id: 'senior', name: '선배', skin: 'light', hair: 'long', hairTone: tone('wood', 0), outfit: 'labcoat', outfitTone: [c('gray3'), c('gray4'), c('gray5'), c('gray6')], accent: c('grn2'), eyeBags: true, age: 'young', iris: c('wood1') },
  { id: 'counselor', name: '상담 선생님', skin: 'light', hair: 'bun', hairTone: tone('wood', 1), outfit: 'cardigan', outfitTone: tone('gold', 1), accent: c('gray5'), age: 'mid', iris: c('wood1') },
  { id: 'reviewer', name: '리뷰어 2', skin: 'light', hair: 'hood', hairTone: tone('vio', 0), outfit: 'cloak', outfitTone: [c('ink0'), c('ink1'), c('ink2'), c('vio0')], accent: c('gold2'), shadowFace: true },
];
