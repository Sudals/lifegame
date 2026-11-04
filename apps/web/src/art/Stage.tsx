import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { rectStyle, scene, STAGE_H, STAGE_W, type SceneId } from './assets';
import { FxLayer, useFx } from './fx';
import { Sprite } from './Sprite';

/**
 * 640x360 도트 무대. 내부는 무대 좌표(px) 그대로, 바깥에서 transform: scale로 확대.
 * 장면이 바뀌면 디더 와이프(9프레임) 전환.
 */
export function Stage({
  sceneId,
  children,
  rain = false,
  vignette = false,
  fx = true,
  className = '',
  onClick,
}: {
  sceneId: SceneId;
  children?: ReactNode;
  rain?: boolean;
  vignette?: boolean;
  fx?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const [k, setK] = useState(1);
  const [shown, setShown] = useState(sceneId);
  const [wipe, setWipe] = useState(-1);

  useLayoutEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = e!.contentRect.width;
      // 충분히 넓으면 정수배로 선명하게
      setK(w >= STAGE_W * 2 ? Math.floor(w / STAGE_W) : w / STAGE_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 장면 전환: 디더로 덮고(0→8) 교체 후 걷어냄(8→0). shown은 ref로 비교해 중간 교체 시 effect가 끊기지 않게 한다.
  const shownRef = useRef(sceneId);
  useEffect(() => {
    if (sceneId === shownRef.current) return;
    let f = 0;
    let dir = 1;
    setWipe(0);
    const t = window.setInterval(() => {
      f += dir;
      if (f > 8) {
        shownRef.current = sceneId;
        setShown(sceneId);
        dir = -1;
        f = 8;
      }
      if (f < 0) {
        window.clearInterval(t);
        setWipe(-1);
        return;
      }
      setWipe(f);
    }, 32);
    return () => {
      window.clearInterval(t);
      shownRef.current = sceneId;
      setShown(sceneId);
      setWipe(-1);
    };
  }, [sceneId]);

  const shaking = useFx((st) => st.shaking);
  const s = scene(shown);
  return (
    <div ref={outer} className={`stage-outer ${className}`} style={{ height: STAGE_H * k }} onClick={onClick}>
      <div className="stage" style={{ transform: `scale(${k})` }}>
        <div className={`stage-shake ${shaking ? 'shaking' : ''}`}>
          <img className="stage-bg" src={s.file} alt={s.name} draggable={false} />
          <Ambient sceneId={shown} rain={rain} />
          {children}
          {vignette && <div className="vignette" />}
          {fx && <FxLayer />}
        </div>
        {wipe >= 0 && <div className="stage-wipe" style={{ backgroundImage: `url(/art/fx-wipe-${wipe}.png)` }} />}
      </div>
    </div>
  );
}

/** 장면 핫스팟 기반 상시 애니메이션 */
function Ambient({ sceneId, rain }: { sceneId: SceneId; rain: boolean }) {
  const s = scene(sceneId);
  const h = s.hotspots;
  const night = s.time === 'night' || s.time === 'dawn';
  const stars = useMemo(() => {
    if (!h.window || s.time !== 'night') return [];
    const w = h.window;
    return [0.15, 0.4, 0.62, 0.85].map((fx, i) => ({ x: w.x + w.w * fx, y: w.y + 6 + ((i * 17) % Math.max(8, w.h * 0.4)), delay: i * 0.7 }));
  }, [h.window, s.time]);

  return (
    <div className="ambient">
      {h.code.map((r, i) => (
        <div key={`c${i}`} className="amb-code" style={{ ...rectStyle(r), animationDelay: `${-i * 1.3}s` }} />
      ))}
      {h.screens.map((r, i) => (
        <div key={`s${i}`} className="amb-screen" style={rectStyle(r)} />
      ))}
      {h.steam.map((p, i) => (
        <Sprite key={`st${i}`} id="fx-steam" fps={5} style={{ left: p.x - 6, top: p.y - 22, animationDelay: `${-i * 0.4}s` }} className="abs" />
      ))}
      {h.leds.map((r, i) => (
        <div key={`l${i}`} className="amb-leds" style={rectStyle(r)}>
          {Array.from({ length: Math.floor(r.h / 14) }, (_, j) => (
            <span key={j} style={{ top: j * 14 + 3, animationDelay: `${(j * 0.37) % 1.7}s`, background: j % 3 === 0 ? '#ffd166' : '#5cb874' }} />
          ))}
        </div>
      ))}
      {h.lamps.map((r, i) => (
        <div key={`lp${i}`} className={night ? 'amb-lamp warm' : 'amb-lamp'} style={{ ...rectStyle(r), animationDelay: `${i * 2.1}s` }} />
      ))}
      {h.glow.map((g, i) => (
        <img key={`g${i}`} className="amb-glow" src="/art/fx-glow.png" alt="" style={{ left: g.x - g.r, top: g.y - g.r, width: g.r * 2, height: g.r * 2 }} />
      ))}
      {h.window && rain && <div className="amb-rain" style={rectStyle(h.window)} />}
      {stars.map((st, i) => (
        <Sprite key={`tw${i}`} id="fx-sparkle" fps={4} className="abs twinkle" style={{ left: st.x - 6, top: st.y - 6, animationDelay: `${st.delay}s` }} />
      ))}
    </div>
  );
}

/** 무대 하단 대화창 */
export function DialogueBox({ name, children, onClick }: { name?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div className="stage-dialog" onClick={onClick}>
      {name && <span className="stage-name">{name}</span>}
      <div className="stage-text">{children}</div>
    </div>
  );
}
