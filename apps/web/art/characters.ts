/**
 * 반신 캐릭터 생성기 — 128x128 프레임, 레이어(뒷머리/몸/목/얼굴/표정/앞머리/소품) 합성.
 * 시트 = 행: 표정 6종 × 열: [기본, 눈깜빡, 말하기]
 */
import { c, shift, tone, type Tone4 } from './palette';
import { PixelCanvas, T } from './lib/canvas';
import { text } from './lib/font';

export const FRAME = 128;
export const EXPRESSIONS = ['normal', 'happy', 'tired', 'frustrated', 'flustered', 'angry'] as const;
export const FRAMES = ['idle', 'blink', 'talk'] as const;
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
        back: (x, y) => x >= 37 && x <= 91 && y >= 40 && y <= 116 && (y < 82 || x < 50 || x > 78),
        front: (x, y) => (inCap(x, y, 25, 19, 40) && y < 43 + ((x >> 3) % 2)) || (y >= 40 && y <= 96 && ((x >= 39 && x <= 46) || (x >= 82 && x <= 89))),
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

function fillHair(cv: PixelCanvas, mask: (x: number, y: number) => boolean, t: Tone4, back: boolean): void {
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      if (!mask(x, y)) continue;
      let col = back ? t[1] : t[2];
      const r = Math.hypot(x - CX + 6, y - 36);
      if (!back && x < CX + 4 && r > 12 && r < 15.5 && y < 42) col = t[3]; // 엔젤링 하이라이트
      if (x > CX + 10 + (y - 30) / 3) col = shift(col, -1); // 오른쪽 그림자
      if ((x * 3 + y * 5) % 17 === 0 && !back && y < 40) col = t[1]; // 머리결
      cv.set(x, y, col);
    }
  // 머리카락 끝 안쪽 경계선
  const edges: [number, number][] = [];
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      if (!mask(x, y)) continue;
      if (!mask(x, y + 1) || !mask(x - 1, y) || !mask(x + 1, y)) edges.push([x, y]);
    }
  for (const [x, y] of edges) cv.set(x, y, t[0]);
}

// ───────────── 몸/의상 ─────────────
function drawOutfit(cv: PixelCanvas, s: CharacterSpec): void {
  const t = s.outfitTone;
  for (let y = 80; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) {
      if (!inTorso(x, y)) continue;
      let col = t[2];
      if (x > 84 || (x > 70 && y > 112)) col = t[1];
      if (x < 34 && y < 104) col = t[3];
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
  // 목
  cv.rect(57, 66, 14, 20, dark).rect(57, 66, 14, 5, shift(dark, -1));
  // 귀
  cv.ellipse(43, 54, 3, 5, base).ellipse(85, 54, 3, 5, dark);
  cv.vline(43, 52, 56, dark).vline(85, 52, 56, shift(dark, -1));
  for (let y = 20; y < 80; y++)
    for (let x = 36; x < 92; x++) {
      if (!inHead(x, y)) continue;
      const d = x - CX;
      let col = base;
      if (d > 12 || (d > 10 && (x + y) % 2 === 0)) col = dark;
      if (d === -11 && (y === 58 || y === 59)) col = hi; // 왼쪽 볼 하이라이트
      cv.set(x, y, col);
    }
  // 코
  cv.set(CX + 1, 58, dark).set(CX + 1, 59, dark).set(CX + 1, 60, dark).set(CX, 61, dark).set(CX - 1, 58, hi);
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
  const iris = s.iris ?? c('ink1');
  const y = EYE_Y;
  if (s.shadowFace) {
    if (kind === 'closed') return void cv.hline(cx - 3, cx + 3, y, c('red1'));
    cv.hline(cx - 3, cx + 3, y, c('red3')).hline(cx - 2, cx + 2, y - 1, kind === 'wide' ? c('gold3') : c('red2'));
    if (kind === 'angry') cv.hline(cx - 3, cx + 3, y + 1, c('red3'));
    return;
  }
  switch (kind) {
    case 'open':
    case 'down':
    case 'angry': {
      cv.rect(cx - 3, y - 2, 7, 5, WHITE);
      const iy = kind === 'down' ? y : y - 1;
      cv.rect(cx - 1, iy - 1, 4, 5, iris).rect(cx - 1, iy - 1, 4, 1, INK);
      cv.set(cx, iy, WHITE);
      cv.hline(cx - 4, cx + 4, y - 3, INK).set(right ? cx + 4 : cx - 4, y - 2, INK);
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
    case 'half': {
      cv.rect(cx - 3, y, 7, 3, WHITE).rect(cx - 1, y, 4, 3, iris).set(cx, y + 1, WHITE);
      cv.hline(cx - 4, cx + 4, y - 1, INK).hline(cx - 3, cx + 3, y - 2, INK);
      break;
    }
    case 'happy':
      cv.set(cx - 4, y + 1, INK).set(cx - 3, y, INK).set(cx - 2, y - 1, INK).hline(cx - 1, cx + 1, y - 2, INK).set(cx + 2, y - 1, INK).set(cx + 3, y, INK).set(cx + 4, y + 1, INK);
      break;
    case 'closed':
      cv.hline(cx - 3, cx + 3, y + 1, INK).set(cx - 4, y, INK).set(cx + 4, y, INK);
      break;
  }
}

function brow(cv: PixelCanvas, cx: number, kind: string, col: number, right: boolean): void {
  const y = BROW_Y;
  const o = right ? -1 : 1; // 안쪽 방향
  const inner = cx + 4 * o;
  const outer = cx - 4 * o;
  const L = (x0: number, y0: number, x1: number, y1: number, thick = 2) => {
    for (let k = 0; k < thick; k++) cv.line(x0, y0 + k, x1, y1 + k, col);
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
      return void cv.hline(61, 67, y, line);
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
  blink: string;
}

const FACES: Record<Expression, FaceDef> = {
  normal: { eyes: 'open', brows: 'flat', mouth: 'neutral', talk: 'open', blink: 'closed' },
  happy: { eyes: 'happy', brows: 'relaxed', mouth: 'smile', talk: 'open-smile', blink: 'happy' },
  tired: { eyes: 'half', brows: 'tired', mouth: 'flat', talk: 'small-open', blink: 'closed' },
  frustrated: { eyes: 'down', brows: 'sad', mouth: 'wavy', talk: 'sad-open', blink: 'closed' },
  flustered: { eyes: 'wide', brows: 'raised', mouth: 'o', talk: 'o-big', blink: 'closed' },
  angry: { eyes: 'angry', brows: 'angry', mouth: 'grit', talk: 'shout', blink: 'closed' },
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
  const eyeKind = frame === 'blink' ? f.blink : f.eyes;
  eye(cv, EYE_L, eyeKind, s, false);
  eye(cv, EYE_R, eyeKind, s, true);
  mouth(cv, frame === 'talk' ? f.talk : f.mouth, s);
  extras(cv, expr, s);
  fillHair(cv, masks.front, s.hairTone, false);
  glasses(cv, s);
  cv.outline(INK);
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
  { id: 'prof-llm-kim', name: '김교수', skin: 'light', hair: 'slick', hairTone: [c('ink0'), c('ink2'), c('gray1'), c('gray3')], outfit: 'suit', outfitTone: tone('blue', 0), accent: c('red2'), glasses: 'square', age: 'mid' },
  { id: 'prof-vision-park', name: '박교수', skin: 'light', hair: 'short', hairTone: tone('wood', 0), outfit: 'cardigan', outfitTone: tone('wood', 2), accent: c('blue4'), glasses: 'round', glassesColor: c('wood1'), age: 'mid' },
  { id: 'prof-rl-lee', name: '이교수', skin: 'tan', hair: 'short', hairTone: tone('ink', 0).map((v, i) => (i === 3 ? c('gray2') : v)) as Tone4, outfit: 'jacket', outfitTone: tone('grn', 0), accent: c('gray5'), beard: 'stubble', age: 'mid' },
  { id: 'prof-eff-choi', name: '최교수', skin: 'light', hair: 'bob', hairTone: tone('gray', 2), outfit: 'blouse', outfitTone: tone('vio', 0), accent: c('gray5'), glasses: 'round', glassesColor: c('gold1'), age: 'old' },
  { id: 'prof-new-jung', name: '정교수', skin: 'light', hair: 'ponytail', hairTone: tone('ink', 0).map((v, i) => (i === 3 ? c('blue1') : v)) as Tone4, outfit: 'jacket', outfitTone: tone('teal', 0), accent: c('gray5'), age: 'young', iris: c('wood1') },
  { id: 'prof-ind-han', name: '한교수', skin: 'tan', hair: 'slick', hairTone: tone('wood', 0), outfit: 'suit', outfitTone: tone('gray', 1), accent: c('gold2'), age: 'mid' },
  { id: 'prof-theory-yoon', name: '윤교수', skin: 'light', hair: 'wild', hairTone: tone('gray', 3), outfit: 'sweater', outfitTone: tone('red', 0), accent: c('gray5'), glasses: 'round', beard: 'stubble', age: 'old' },
  { id: 'senior', name: '선배', skin: 'light', hair: 'long', hairTone: tone('wood', 0), outfit: 'labcoat', outfitTone: [c('gray3'), c('gray4'), c('gray5'), c('gray6')], accent: c('grn2'), eyeBags: true, age: 'young', iris: c('wood1') },
  { id: 'counselor', name: '상담 선생님', skin: 'light', hair: 'bun', hairTone: tone('wood', 1), outfit: 'cardigan', outfitTone: tone('gold', 1), accent: c('gray5'), age: 'mid', iris: c('wood1') },
  { id: 'reviewer', name: '리뷰어 2', skin: 'light', hair: 'hood', hairTone: tone('vio', 0), outfit: 'cloak', outfitTone: [c('ink0'), c('ink1'), c('ink2'), c('vio0')], accent: c('gold2'), shadowFace: true },
];
