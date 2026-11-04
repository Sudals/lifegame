import type { CSSProperties } from 'react';
import { sheet, type IconName, type SheetId } from './assets';
import manifest from './manifest.json';

/** 스프라이트 시트 애니메이션 (CSS steps) */
export function Sprite({ id, fps = 8, loop = true, style, className = '' }: { id: SheetId; fps?: number; loop?: boolean; style?: CSSProperties; className?: string }) {
  const s = sheet(id);
  const animated = s.frames > 1;
  return (
    <span
      className={`sprite-anim ${animated ? 'playing' : ''} ${className}`}
      style={
        {
          width: s.frameW,
          height: s.frameH,
          backgroundImage: `url(${s.file})`,
          '--sw': `-${s.w}px`,
          '--n': s.frames,
          '--dur': `${s.frames / fps}s`,
          '--iter': loop ? 'infinite' : 1,
          ...style,
        } as CSSProperties
      }
    />
  );
}

/** 16x16 도트 아이콘 */
export function Icon({ name, size = 16, className = '' }: { name: IconName; size?: number; className?: string }) {
  const i = manifest.icons.indexOf(name);
  const k = size / 16;
  return (
    <span
      className={`icon ${className}`}
      aria-hidden
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${manifest.sheets.icons.file})`,
        backgroundSize: `${manifest.sheets.icons.w * k}px ${16 * k}px`,
        backgroundPosition: `-${i * 16 * k}px 0`,
      }}
    />
  );
}
