/**
 * 고정 팔레트 (51색). 모든 에셋은 이 색만 사용한다 — PixelCanvas가 팔레트 인덱스만 저장하므로 구조적으로 보장.
 * 램프는 어두운 → 밝은 순서. darken()은 램프 안에서 한 단계 내린다(밤 조명).
 */
export const RAMPS = {
  ink: ['#0d0b1e', '#1b1a33', '#2b2a4c'],
  blue: ['#1a2140', '#283b6e', '#3a5a9b', '#5b84c4', '#8fb4e3', '#cfe3f5'],
  vio: ['#3b2a52', '#5a4178', '#7f63a3', '#b59bd6'],
  wood: ['#2e1b12', '#4a2d1e', '#6b4129', '#8f5c38', '#b47e4f', '#d8a875'],
  skin: ['#6e4232', '#9c6449', '#c98d69', '#e8b98f', '#f8dcc0'],
  grn: ['#183b2e', '#24604a', '#36895e', '#5cb874', '#a6e3a1'],
  red: ['#4d1626', '#8a2639', '#c43d52', '#ef6b7f', '#ffb3bd'],
  gold: ['#5e3c10', '#9a6420', '#d69a2d', '#ffd166', '#fff0b3'],
  teal: ['#0f3d45', '#17676f', '#2a9d8f', '#4cc9f0', '#b8f2ff'],
  gray: ['#2f3142', '#4a4d62', '#6c7088', '#9498b0', '#c2c6d8', '#e6e8f1', '#ffffff'],
} as const;

export type RampName = keyof typeof RAMPS;
export type ColorName = `${RampName}${number}`;

export const PALETTE: string[] = [];
const INDEX = new Map<string, number>();
const RAMP_OF: { ramp: RampName; step: number }[] = [];
for (const [ramp, colors] of Object.entries(RAMPS) as [RampName, readonly string[]][]) {
  colors.forEach((hex, step) => {
    INDEX.set(`${ramp}${step}`, PALETTE.length);
    RAMP_OF.push({ ramp, step });
    PALETTE.push(hex);
  });
}

/** 색 이름('wood3') → 팔레트 인덱스 */
export function c(name: string): number {
  const i = INDEX.get(name);
  if (i === undefined) throw new Error(`팔레트에 없는 색: ${name}`);
  return i;
}

/** 같은 램프에서 n단계 어둡게/밝게 */
export function shift(index: number, n: number): number {
  const r = RAMP_OF[index];
  if (!r) return index;
  const len = RAMPS[r.ramp].length;
  const step = Math.max(0, Math.min(len - 1, r.step + n));
  return INDEX.get(`${r.ramp}${step}`)!;
}

export function rgb(index: number): [number, number, number] {
  const hex = PALETTE[index]!;
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

/** 캐릭터 헤어/옷 등에서 쓰는 4톤 램프 묶음 */
export type Tone4 = [number, number, number, number];
export function tone(ramp: RampName, from: number): Tone4 {
  return [0, 1, 2, 3].map((i) => c(`${ramp}${Math.min(RAMPS[ramp].length - 1, from + i)}`)) as Tone4;
}
