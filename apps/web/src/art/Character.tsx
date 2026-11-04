import { memo, useEffect, useState } from 'react';
import { character, EXPRESSIONS, FRAME, type CharacterId, type Expression } from './assets';

/** 시트 열: art/characters.ts FRAMES 순서 */
const COL = { idle: 0, blinkHalf: 1, blink: 2, talkHalf: 3, talk: 4 } as const;

/**
 * 반신 캐릭터: 128x128 프레임 시트 (행 = 표정, 열 = 기본/반눈/눈감음/반입/말하기)
 * - 눈깜빡임: 반눈 → 감음 → 반눈 (가끔 두 번)
 * - 말하기: 반입 ↔ 입 벌림 ↔ 다물기를 불규칙하게
 * - 숨쉬기 1px 상하 (CSS)
 */
export const Character = memo(function Character({
  id,
  expr = 'normal',
  talking = false,
  x = 320,
  bottom = 276,
  flip = false,
  dim = false,
  enter = 'up',
}: {
  id: CharacterId;
  expr?: Expression;
  talking?: boolean;
  x?: number;
  bottom?: number;
  flip?: boolean;
  dim?: boolean;
  enter?: 'up' | 'left' | 'right' | 'none';
}) {
  const [eye, setEye] = useState<number>(COL.idle);
  const [mouth, setMouth] = useState<number>(COL.idle);

  useEffect(() => {
    const timers: number[] = [];
    const at = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
    let alive = true;
    const blinkOnce = (start: number) => {
      at(start, () => setEye(COL.blinkHalf));
      at(start + 45, () => setEye(COL.blink));
      at(start + 130, () => setEye(COL.blinkHalf));
      at(start + 175, () => setEye(COL.idle));
    };
    const schedule = () => {
      if (!alive) return;
      const wait = 2200 + Math.random() * 3400;
      blinkOnce(wait);
      if (Math.random() < 0.2) blinkOnce(wait + 260);
      at(wait + 600, schedule);
    };
    schedule();
    return () => {
      alive = false;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    if (!talking) return setMouth(COL.idle);
    const seq = [COL.talkHalf, COL.talk, COL.talkHalf, COL.idle, COL.talk, COL.talkHalf, COL.idle];
    let i = 0;
    let t: number;
    const step = () => {
      setMouth(seq[i++ % seq.length]!);
      t = window.setTimeout(step, 70 + Math.random() * 50);
    };
    step();
    return () => window.clearTimeout(t);
  }, [talking]);

  const row = Math.max(0, EXPRESSIONS.indexOf(expr));
  // 눈을 감는 중이면 눈 프레임 우선, 아니면 입 프레임
  const col = eye !== COL.idle ? eye : mouth;
  const c = character(id);
  return (
    <div className={`char enter-${enter} ${dim ? 'dim' : ''}`} style={{ left: x - FRAME / 2, top: bottom - FRAME }}>
      <div
        className="char-img"
        style={{
          backgroundImage: `url(${c.file})`,
          backgroundPosition: `-${col * FRAME}px -${row * FRAME}px`,
          transform: flip ? 'scaleX(-1)' : undefined,
        }}
      />
    </div>
  );
});
