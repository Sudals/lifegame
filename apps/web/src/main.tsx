import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import g11 from 'galmuri/dist/Galmuri11.woff2?url';
import g11b from 'galmuri/dist/Galmuri11-Bold.woff2?url';
import { preloadArt } from './art/assets';
import { useFx } from './art/fx';
import './styles.css';
import './art/art.css';

// 한글 도트 폰트 Galmuri (OFL-1.1) — 쓰는 두 굵기만 로드
for (const [family, url] of [['Galmuri11', g11], ['Galmuri11 Bold', g11b]] as const) {
  const face = new FontFace(family, `url(${url}) format('woff2')`);
  document.fonts.add(face);
  face.load().catch(() => undefined);
}
preloadArt();
// 자동화 테스트(scripts/ui-walkthrough.ts)에서 이펙트를 직접 재생하기 위한 훅
(window as unknown as { __gradsimFx: typeof useFx }).__gradsimFx = useFx;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
