import { memo, useEffect, useState } from 'react';
import { character, EXPRESSIONS, FRAME, type CharacterId, type Expression } from './assets';

/**
 * 반신 캐릭터: 128x128 프레임 시트 (행 = 표정, 열 = 기본/눈깜빡/말하기)
 * - 2.5~5.5초마다 랜덤 눈깜빡임
 * - talking 동안 입 모양 교차
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
  const [blink, setBlink] = useState(false);
  const [mouth, setMouth] = useState(false);

  useEffect(() => {
    let t: number;
    const schedule = () => {
      t = window.setTimeout(
        () => {
          setBlink(true);
          window.setTimeout(() => setBlink(false), 130);
          schedule();
        },
        2500 + Math.random() * 3000,
      );
    };
    schedule();
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!talking) return setMouth(false);
    const t = window.setInterval(() => setMouth((m) => !m), 120);
    return () => window.clearInterval(t);
  }, [talking]);

  const row = Math.max(0, EXPRESSIONS.indexOf(expr));
  const col = blink ? 1 : mouth ? 2 : 0;
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
