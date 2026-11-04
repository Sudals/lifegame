import { useMemo, type CSSProperties } from 'react';
import { create } from 'zustand';
import { PALETTE, sheet, type SheetId } from './assets';
import { Sprite } from './Sprite';

export type FxKind = 'accept' | 'reject' | 'major' | 'minor' | 'oral' | 'pass' | 'week' | 'mail' | 'firework' | 'shake' | 'sparkle' | 'zzz';

export interface FxItem {
  id: number;
  kind: FxKind;
  label?: string;
  x?: number;
  y?: number;
  delay?: number;
}

const DURATION: Record<FxKind, number> = {
  accept: 2600,
  reject: 2400,
  major: 2200,
  minor: 2200,
  oral: 2600,
  pass: 2600,
  week: 1300,
  mail: 1400,
  firework: 2600,
  shake: 500,
  sparkle: 1200,
  zzz: 2400,
};

interface FxStore {
  items: FxItem[];
  shaking: boolean;
  play(kind: FxKind, opts?: Omit<FxItem, 'id' | 'kind'>): void;
}

let seq = 1;

/** 어디서든 이펙트 재생: useFx.getState().play('accept') */
export const useFx = create<FxStore>((set, get) => ({
  items: [],
  shaking: false,
  play(kind, opts = {}) {
    const item = { id: seq++, kind, ...opts };
    const start = () => {
      set({ items: [...get().items, item] });
      if (kind === 'reject' || kind === 'shake') {
        set({ shaking: true });
        window.setTimeout(() => set({ shaking: false }), 450);
      }
      window.setTimeout(() => set({ items: get().items.filter((i) => i.id !== item.id) }), DURATION[kind]);
    };
    if (opts.delay) window.setTimeout(start, opts.delay);
    else start();
  },
}));

const CONFETTI = ['#ef6b7f', '#ffd166', '#4cc9f0', '#5cb874', '#b59bd6', '#fff0b3', '#ffffff'];

function Confetti({ n = 46, x = 320, y = 150 }: { n?: number; x?: number; y?: number }) {
  const parts = useMemo(
    () =>
      Array.from({ length: n }, (_, i) => ({
        dx: Math.round((Math.random() - 0.5) * 420),
        dy: Math.round(120 + Math.random() * 180),
        up: Math.round(40 + Math.random() * 80),
        size: Math.random() > 0.7 ? 4 : 2,
        color: CONFETTI[i % CONFETTI.length]!,
        delay: Math.random() * 0.15,
        dur: 1.4 + Math.random() * 0.9,
      })),
    [n],
  );
  return (
    <>
      {parts.map((p, i) => (
        <span
          key={i}
          className="confetti"
          style={
            {
              left: x,
              top: y,
              width: p.size,
              height: p.size,
              background: p.color,
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
              '--up': `${-p.up}px`,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
            } as CSSProperties
          }
        />
      ))}
    </>
  );
}

function Stamp({ id }: { id: SheetId }) {
  const s = sheet(id);
  return <img className="stamp" src={s.file} alt="" style={{ left: 320 - s.w, top: 150 - s.h, width: s.w * 2, height: s.h * 2 }} />;
}

function WeekCard({ label }: { label?: string }) {
  return (
    <div className="week-card">
      <img src="/art/fx-calendar.png" alt="" />
      <span className="week-label">{label}</span>
    </div>
  );
}

function Item({ it }: { it: FxItem }) {
  switch (it.kind) {
    case 'accept':
      return (
        <>
          <Confetti />
          <Stamp id="stamp-accept" />
          {[150, 250, 400, 500].map((x, i) => (
            <Sprite key={i} id="fx-sparkle" fps={8} className="abs" style={{ left: x, top: 70 + (i % 2) * 40, animationDelay: `${i * 0.2}s` }} />
          ))}
        </>
      );
    case 'oral':
      return (
        <>
          <Confetti n={70} />
          <Stamp id="stamp-oral" />
        </>
      );
    case 'pass':
      return (
        <>
          <Confetti n={60} />
          <Stamp id="stamp-pass" />
        </>
      );
    case 'reject':
      return (
        <>
          <Stamp id="stamp-reject" />
          <Sprite id="fx-cloud" fps={6} className="abs cloud-drift" style={{ left: (it.x ?? 320) - 20, top: (it.y ?? 150) - 15, transform: 'scale(2)' }} />
        </>
      );
    case 'major':
      return <Stamp id="stamp-major" />;
    case 'minor':
      return <Stamp id="stamp-minor" />;
    case 'week':
      return <WeekCard label={it.label} />;
    case 'mail':
      return (
        <span className="abs mail-fly" style={{ left: it.x ?? 300, top: it.y ?? 200 }}>
          <Sprite id="fx-mail" fps={4} style={{ transform: 'scale(2)' }} />
        </span>
      );
    case 'firework':
      return (
        <>
          {[
            [140, 70],
            [320, 40],
            [500, 80],
            [230, 110],
            [420, 120],
          ].map(([x, y], i) => (
            <Sprite key={i} id="fx-firework" fps={7} loop={false} className="abs firework" style={{ left: x! - 24, top: y! - 24, animationDelay: `${i * 0.35}s`, transform: 'scale(2)' }} />
          ))}
        </>
      );
    case 'sparkle':
      return <Sprite id="fx-sparkle" fps={8} className="abs" style={{ left: (it.x ?? 320) - 6, top: (it.y ?? 150) - 6 }} />;
    case 'zzz':
      return <Sprite id="fx-zzz" fps={3} className="abs" style={{ left: it.x ?? 350, top: it.y ?? 150 }} />;
    default:
      return null;
  }
}

export function FxLayer() {
  const items = useFx((s) => s.items);
  return (
    <div className="fx-layer">
      {items.map((it) => (
        <Item key={it.id} it={it} />
      ))}
    </div>
  );
}

export { PALETTE };
