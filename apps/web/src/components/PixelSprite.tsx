import { memo, type ReactElement } from 'react';

/**
 * 코드 기반 HD 도트: 문자 그리드 → SVG rect (crispEdges).
 * 추후 Aseprite 보정 PNG로 교체 가능하도록 이름(kind) 단위로 관리.
 */
const PORTRAIT = [
  '....kkkkkkkk....',
  '...khhhhhhhhk...',
  '..khhhhhhhhhhk..',
  '..khhsssssshhk..',
  '..khsssssssshk..',
  '..ksseesseessk..',
  '..ksseesseessk..',
  '..kssssssssssk..',
  '..kssssmmssssk..',
  '...kssssssssk...',
  '....kksssskk....',
  '..kcccssssccck..',
  '.kcccccwwccccck.',
  '.kcccccwwccccck.',
  'kcccccccccccccck',
  'kkkkkkkkkkkkkkkk',
];

/** 표정 변형: 눈/입 행 교체 */
const MOODS: Record<string, Partial<Record<number, string>>> = {
  normal: {},
  happy: { 5: '..kssssssssssk..', 8: '..ksssmmmmsssk..' },
  tired: { 5: '..kssssssssssk..', 6: '..kskkksskkksk..', 8: '..kssskkkksssk..' },
  angry: { 4: '..khskksskkshk..', 8: '..kssskkkksssk..' },
};

export interface SpritePalette {
  h: string; // 머리
  s: string; // 피부
  c: string; // 옷
  w?: string; // 셔츠/넥타이
}

const BASE: Record<string, string> = { k: '#1b1b2f', e: '#1b1b2f', m: '#b4574a', w: '#f4f1de' };

export const PALETTES: Record<string, SpritePalette> = {
  player: { h: '#3d2c2e', s: '#f2c9a0', c: '#3a6ea5' },
  professor: { h: '#9a9a9a', s: '#e8b98f', c: '#5b3a29', w: '#c0392b' },
  senior: { h: '#2b2b44', s: '#f2c9a0', c: '#2a9d8f' },
  counselor: { h: '#7a4e2d', s: '#f6d5b5', c: '#e9c46a' },
  reviewer: { h: '#1b1b2f', s: '#d8c3a5', c: '#6d597a', w: '#1b1b2f' },
  system: { h: '#444466', s: '#c9d6df', c: '#444466' },
};

export const PixelSprite = memo(function PixelSprite({
  kind = 'player',
  mood = 'normal',
  size = 96,
}: {
  kind?: keyof typeof PALETTES | string;
  mood?: keyof typeof MOODS | string;
  size?: number;
}) {
  const pal = { ...BASE, ...(PALETTES[kind] ?? PALETTES.player) } as Record<string, string>;
  const rows = PORTRAIT.map((r, i) => (MOODS[mood]?.[i] ?? r).padEnd(16, '.').slice(0, 16));
  const rects: ReactElement[] = [];
  rows.forEach((row, y) => {
    let x = 0;
    while (x < 16) {
      const ch = row[x]!;
      let run = 1;
      while (x + run < 16 && row[x + run] === ch) run++;
      const fill = pal[ch];
      if (ch !== '.' && fill) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={run} height={1} fill={fill} />);
      x += run;
    }
  });
  return (
    <svg className="sprite" viewBox="0 0 16 16" width={size} height={size} shapeRendering="crispEdges" aria-hidden>
      {rects}
    </svg>
  );
});

export function speakerKind(speaker?: string): string {
  if (!speaker) return 'system';
  if (speaker.includes('교수')) return 'professor';
  if (speaker.includes('선배')) return 'senior';
  if (speaker.includes('상담')) return 'counselor';
  if (speaker.includes('리뷰')) return 'reviewer';
  return 'system';
}
