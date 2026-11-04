/** 640x360 배경 장면 + 애니메이션 핫스팟 */
import { c } from './palette';
import { PixelCanvas } from './lib/canvas';
import { text } from './lib/font';
import {
  audience,
  backpack,
  bankerLamp,
  baseboard,
  cable,
  castShadow,
  floorGloss,
  floorShadow,
  noise,
  rug,
  spotlight,
  stickyNotes,
  trashBin,
  wallClockShadow,
  wallDepth,
  windowShaft,
  bed,
  books,
  bookshelf,
  ceiling,
  chairBack,
  chalkboard,
  clock,
  counter,
  desk,
  deskLamp,
  door,
  floorTiles,
  floorWood,
  framePicture,
  fridge,
  H,
  keyboard,
  laptop,
  lightPool,
  monitor,
  mug,
  nightify,
  paperStack,
  pendantLamp,
  plant,
  poster,
  productShelf,
  type Rect,
  serverRack,
  sofa,
  type Time,
  W,
  wainscot,
  wall,
  whiteboard,
  windowView,
} from './props';

export interface SceneHotspots {
  screens: Rect[]; // 화면 깜빡임
  code: Rect[]; // 코드 스크롤 오버레이
  steam: { x: number; y: number }[]; // 김 파티클
  leds: Rect[]; // 깜빡이는 LED
  window?: Rect; // 비/별 오버레이
  lamps: Rect[]; // 조명 깜빡임
  glow: { x: number; y: number; r: number }[]; // 은은한 빛 맥동
}

export interface Scene {
  id: string;
  name: string;
  time: Time;
  canvas: PixelCanvas;
  hotspots: SceneHotspots;
}

const empty = (): SceneHotspots => ({ screens: [], code: [], steam: [], leds: [], lamps: [], glow: [] });

function lab(time: Time): Scene {
  const cv = new PixelCanvas(W, H);
  const hs = empty();
  wall(cv, 0, 236, c('gray4'), { panel: 80 });
  noise(cv, 0, 14, W, 158, 3, 0.004);
  wainscot(cv, 172, 236, c('gray3'));
  wallDepth(cv, 15, 236);
  hs.lamps.push(...ceiling(cv, 14, c('gray5'), [170, 470]));
  for (let x = 32; x < W; x += 64) if (Math.abs(x - 170) > 44 && Math.abs(x - 470) > 44) cv.vline(x, 0, 13, c('gray4'));
  baseboard(cv, 236, c('gray1'));
  floorTiles(cv, 242, c('gray3'));
  noise(cv, 0, 244, W, 116, 5, 0.004);
  hs.window = windowView(cv, 26, 42, 176, 104, time, { seed: 11, blinds: 0.22 });
  windowShaft(cv, hs.window, 244, time, 100);
  wallClockShadow(cv, 246, 44, 11);
  clock(cv, 246, 44);
  hs.leds.push(serverRack(cv, 222, 72, 50, 170));
  castShadow(cv, 318, 54, 4, 50, 'right', 0.7);
  poster(cv, 282, 52, 36, 50, 'CVPR', c('blue2'));
  castShadow(cv, 334, 126, 260, 5, 'down', 0.8);
  whiteboard(cv, 334, 30, 254, 90, 4);
  trashBin(cv, 300, 242);
  desk(cv, 290, 190, 340, 242);
  cable(cv, 364, 201, 352, 241, 4);
  cable(cv, 502, 201, 520, 241, 5);
  cable(cv, 606, 201, 596, 241, 3, c('gray1'));
  const m1 = monitor(cv, 332, 134, 64, 46, 'code', 2);
  const m2 = monitor(cv, 470, 134, 64, 46, time === 'night' ? 'code' : 'graph', 5);
  hs.screens.push(m1, m2);
  hs.code.push(m1);
  if (time === 'night') hs.code.push(m2);
  keyboard(cv, 344, 185, 40);
  keyboard(cv, 482, 185, 40);
  hs.steam.push(mug(cv, 412, 180, c('red2')));
  paperStack(cv, 428, 189, 6);
  books(cv, 548, 190, 34, 21, 20);
  stickyNotes(cv, 397, 138, 2);
  stickyNotes(cv, 535, 140, 1);
  const lamp = deskLamp(cv, 606, 190);
  plant(cv, 280, 242, 0.9);
  chairBack(cv, 364, 198);
  chairBack(cv, 502, 198);
  floorShadow(cv, 436, 264, 16, 3);
  backpack(cv, 432, 264, time === 'night' ? c('red1') : c('red2'));
  if (time === 'night' || time === 'dawn') {
    nightify(cv, [hs.window, ...hs.screens, lamp], time === 'night' ? -2 : -1);
    for (const s of hs.screens) lightPool(cv, s.x + s.w / 2, s.y + s.h + 10, 52, 22);
    lightPool(cv, lamp.x + 8, 194, 40, 16);
    hs.lamps.length = 0;
    hs.glow.push({ x: lamp.x + 10, y: 190, r: 34 });
  }
  return { id: `lab-${time}`, name: '연구실', time, canvas: cv, hotspots: hs };
}

function office(): Scene {
  const cv = new PixelCanvas(W, H);
  const hs = empty();
  wall(cv, 0, 236, c('wood4'), { panel: 48 });
  noise(cv, 0, 8, W, 160, 13, 0.004);
  cv.rect(0, 0, W, 8, c('wood2')).hline(0, W, 8, c('wood1'));
  wainscot(cv, 168, 236, c('wood2'));
  wallDepth(cv, 9, 236);
  baseboard(cv, 236, c('wood0'));
  floorWood(cv, 242, c('wood1'));
  rug(cv, 330, 302, 210, 28, c('red1'), c('gold1'));
  castShadow(cv, 168, 34, 10, 202, 'right', 0.8);
  bookshelf(cv, 18, 30, 150, 206, 31);
  framePicture(cv, 196, 52, 40, 30, 'diploma');
  framePicture(cv, 252, 52, 40, 30, 'diploma');
  framePicture(cv, 224, 98, 40, 30, 'diploma');
  hs.window = windowView(cv, 432, 36, 168, 110, 'day', { seed: 5, blinds: 0.38, frame: c('wood5') });
  windowShaft(cv, hs.window, 244, 'day', 110, -1);
  plant(cv, 612, 242, 1.3);
  desk(cv, 150, 198, 340, 262, c('wood2'));
  hs.screens.push(monitor(cv, 396, 146, 58, 42, 'paper', 3));
  hs.lamps.push(bankerLamp(cv, 246, 197));
  paperStack(cv, 180, 197, 8);
  paperStack(cv, 206, 197, 4);
  cv.rect(280, 188, 44, 10, c('gold2')).frame(280, 188, 44, 10, c('gold0'));
  text(cv, 'PROF', 290, 190, c('gold0'));
  hs.steam.push(mug(cv, 346, 187, c('gray6')));
  cv.rect(362, 186, 8, 11, c('ink2')).vline(364, 178, 186, c('red2')).vline(367, 180, 186, c('blue2'));
  return { id: 'office', name: '교수실', time: 'day', canvas: cv, hotspots: hs };
}

function classroom(): Scene {
  const cv = new PixelCanvas(W, H);
  const hs = empty();
  wall(cv, 0, 236, c('gray5'), { panel: 120 });
  noise(cv, 0, 12, W, 164, 17, 0.004);
  wainscot(cv, 176, 236, c('wood3'));
  wallDepth(cv, 13, 236);
  castShadow(cv, 125, 157, 390, 6, 'down', 0.8);
  hs.lamps.push(...ceiling(cv, 12, c('gray6'), [140, 320, 500]));
  baseboard(cv, 236, c('wood1'));
  floorWood(cv, 242, c('wood3'));
  cv.rect(124, 20, 392, 6, c('gray3')).rect(124, 26, 392, 3, c('gray5'));
  chalkboard(cv, 130, 42, 380, 110);
  clock(cv, 580, 56, 10);
  door(cv, 20, 96, 56, 140);
  cv.rect(560, 110, 50, 66, c('gray6')).frame(560, 110, 50, 66, c('gray3'));
  text(cv, 'NOTICE', 563, 113, c('red2'));
  for (let y = 118 + 12; y < 172; y += 5) cv.hline(564, 604, y, c('gray4'));
  for (const [y, h] of [
    [262, 10],
    [318, 12],
  ] as const) {
    for (let x = 10; x < W; x += 128) {
      castShadow(cv, x + 6, y + h + 4, 110, 8, 'down', 0.8);
      cv.rect(x, y, 110, h, c('wood4')).hline(x, x + 109, y, c('wood5')).rect(x, y + h, 110, 4, c('wood2'));
      cv.rect(x + 8, y + h + 4, 4, 40, c('gray2')).rect(x + 98, y + h + 4, 4, 40, c('gray2'));
    }
  }
  return { id: 'classroom', name: '강의실', time: 'day', canvas: cv, hotspots: hs };
}

function home(): Scene {
  const cv = new PixelCanvas(W, H);
  const hs = empty();
  wall(cv, 0, 236, c('gold4'), { pattern: 'dots' });
  wallDepth(cv, 0, 236);
  baseboard(cv, 236, c('wood2'));
  floorWood(cv, 242, c('wood3'));
  rug(cv, 330, 300, 120, 20, c('teal2'), c('gray5'));
  hs.window = windowView(cv, 268, 48, 112, 92, 'night', { seed: 8, frame: c('gray6') });
  cv.rect(256, 36, 18, 120, c('red2')).rect(374, 36, 18, 120, c('red2')).rect(250, 32, 148, 5, c('wood1'));
  for (let y = 40; y < 156; y += 8) cv.vline(262, y, y + 4, c('red1')).vline(382, y, y + 4, c('red1'));
  bed(cv, 18, 212, 220, 260);
  floorShadow(cv, 140, 262, 120, 5);
  // 침대 위 후드티, 바닥 책 더미, 벽시계
  cv.ellipse(150, 206, 22, 7, c('vio1')).ellipse(170, 204, 9, 5, c('vio2')).line(128, 208, 116, 214, c('vio1')).hline(132, 168, 210, c('vio0'));
  books(cv, 250, 262, 26, 7, 14);
  cv.rect(250, 248, 26, 4, c('blue2')).rect(252, 244, 22, 4, c('red2')).rect(249, 240, 24, 4, c('grn2'));
  clock(cv, 226, 64, 8);
  poster(cv, 420, 44, 40, 54, 'AI', c('vio2'));
  cv.rect(476, 56, 34, 24, c('gray6')).frame(476, 56, 34, 24, c('gray3'));
  text(cv, 'D-7', 481, 64, c('red2'));
  desk(cv, 400, 196, 226, 262, c('wood3'));
  const lap = laptop(cv, 466, 158, 'code');
  hs.screens.push(lap);
  hs.code.push(lap);
  // 컵라면
  cv.poly([[556, 180], [572, 180], [570, 196], [558, 196]], c('gray6')).rect(556, 178, 16, 3, c('red2')).hline(558, 569, 188, c('red3'));
  hs.steam.push({ x: 564, y: 176 });
  const lamp = deskLamp(cv, 606, 196);
  const lights: Rect[] = [];
  for (let x = 12; x < W; x += 22) {
    const y = 18 + Math.round(Math.sin(x / 40) * 4);
    cv.set(x, y - 2, c('ink2')).rect(x - 1, y, 3, 3, [c('gold3'), c('red3'), c('teal3')][(x / 22) % 3 | 0]!);
    lights.push({ x: x - 1, y, w: 3, h: 3 });
  }
  for (let x = 0; x < W - 1; x++) cv.set(x, 16 + Math.round(Math.sin(x / 40) * 4), c('ink2'));
  nightify(cv, [hs.window, ...hs.screens, lamp, ...lights], -3);
  for (const s of hs.screens) lightPool(cv, s.x + s.w / 2, s.y + s.h, 60, 30);
  lightPool(cv, lamp.x + 8, 200, 36, 14);
  hs.lamps.push(...lights);
  hs.glow.push({ x: 490, y: 175, r: 60 });
  return { id: 'home', name: '자취방', time: 'night', canvas: cv, hotspots: hs };
}

function conference(): Scene {
  const cv = new PixelCanvas(W, H);
  const hs = empty();
  wall(cv, 0, 236, c('blue1'), { stripe: 1, pattern: 'stripes' });
  cv.rect(0, 0, W, 18, c('ink2'));
  cv.rect(40, 176, 560, 50, c('wood1')).hline(40, 599, 176, c('wood3')).rect(40, 226, 560, 10, c('wood0'));
  baseboard(cv, 236, c('ink1'));
  floorTiles(cv, 242, c('red0'), 64);
  // 스크린 + 슬라이드
  cv.rect(144, 24, 352, 140, c('ink1'));
  const scr = { x: 148, y: 28, w: 344, h: 132 };
  cv.rect(scr.x, scr.y, scr.w, scr.h, c('gray6'));
  cv.rect(scr.x, scr.y, scr.w, 22, c('blue2'));
  text(cv, 'AI CONF 2027 - ORAL SESSION', scr.x + 10, scr.y + 8, c('gray6'));
  const bars = [40, 56, 48, 92];
  bars.forEach((b, i) => cv.rect(scr.x + 40 + i * 44, scr.y + 120 - b, 28, b, i === 3 ? c('red2') : c('blue3')));
  text(cv, 'OURS', scr.x + 40 + 3 * 44 - 2, scr.y + 122 - 92 - 10, c('red2'));
  for (let y = scr.y + 34; y < scr.y + 110; y += 8) cv.hline(scr.x + 230, scr.x + 330 - ((y * 7) % 30), y, c('gray3'));
  hs.screens.push(scr);
  // 연단
  cv.rect(520, 128, 52, 50, c('wood2')).rect(516, 124, 60, 6, c('wood3')).line(546, 124, 552, 108, c('gray2')).rect(551, 104, 4, 5, c('ink1'));
  poster(cv, 8, 70, 30, 44, 'P1', c('grn1'));
  poster(cv, 602, 70, 30, 44, 'P2', c('red1'));
  spotlight(cv, 220, 270, 178, 70);
  spotlight(cv, 430, 380, 178, 70);
  audience(cv, 268, 13);
  nightify(cv, [scr], -1);
  lightPool(cv, 320, 160, 230, 40);
  hs.lamps.push({ x: scr.x, y: scr.y, w: scr.w, h: 22 });
  hs.glow.push({ x: 320, y: 96, r: 180 });
  return { id: 'conference', name: '학회장', time: 'day', canvas: cv, hotspots: hs };
}

function cafe(): Scene {
  const cv = new PixelCanvas(W, H);
  const hs = empty();
  wall(cv, 0, 236, c('wood4'), { panel: 64 });
  // 벽돌
  for (let y = 150; y < 236; y += 8)
    for (let x = ((y / 8) % 2) * 12; x < W; x += 24) cv.rect(x, y, 22, 6, c('red1')).hline(x, x + 21, y, c('red2'));
  baseboard(cv, 236, c('wood0'));
  floorWood(cv, 242, c('wood2'));
  cv.rect(50, 36, 150, 92, c('wood1')).rect(54, 40, 142, 84, c('ink2'));
  text(cv, 'MENU', 104, 46, c('gold3'));
  text(cv, 'AMERICANO 4.5', 62, 64, c('gray5'));
  text(cv, 'LATTE     5.0', 62, 78, c('gray5'));
  text(cv, 'CAKE      6.5', 62, 92, c('gray5'));
  text(cv, 'WIFI: GRADLIFE', 62, 108, c('teal3'));
  wallDepth(cv, 0, 236);
  hs.window = windowView(cv, 380, 64, 230, 100, 'day', { seed: 21, frame: c('wood1') });
  windowShaft(cv, hs.window, 244, 'day', 100, -1);
  castShadow(cv, 0, 262, 310, 10, 'down', 0.9);
  counter(cv, 0, 186, 300, 262, c('wood5'), c('wood2'));
  cv.rect(200, 140, 64, 46, c('gray3')).frame(200, 140, 64, 46, c('gray1')).rect(206, 146, 52, 12, c('gray5'));
  cv.rect(214, 160, 6, 14, c('gray1')).rect(242, 160, 6, 14, c('gray1')).rect(210, 176, 44, 4, c('gray2'));
  hs.steam.push({ x: 217, y: 170 });
  for (const x of [40, 60, 80]) mug(cv, x, 176, c('gray6'));
  hs.lamps.push(pendantLamp(cv, 330, 36), pendantLamp(cv, 420, 28), pendantLamp(cv, 520, 36));
  plant(cv, 340, 242, 1.1);
  floorShadow(cv, 508, 312, 60, 6);
  cv.ellipse(500, 266, 70, 10, c('wood3')).hline(440, 560, 262, c('wood4')).rect(496, 270, 8, 40, c('wood1')).vline(496, 270, 309, c('wood2'));
  hs.steam.push(mug(cv, 470, 248, c('gray6')), mug(cv, 520, 248, c('teal2')));
  for (const l of hs.lamps) lightPool(cv, l.x + 6, l.y + 30, 44, 34);
  return { id: 'cafe', name: '카페', time: 'day', canvas: cv, hotspots: hs };
}

function counseling(): Scene {
  const cv = new PixelCanvas(W, H);
  const hs = empty();
  wall(cv, 0, 236, c('grn4'), { pattern: 'dots' });
  wainscot(cv, 180, 236, c('gray5'));
  baseboard(cv, 236, c('wood2'));
  floorWood(cv, 242, c('wood4'));
  wallDepth(cv, 0, 236);
  hs.window = windowView(cv, 44, 52, 140, 100, 'day', { seed: 33, city: false, frame: c('gray6') });
  windowShaft(cv, hs.window, 244, 'day', 100, 1);
  cv.rect(30, 42, 22, 130, c('gold3')).rect(176, 42, 22, 130, c('gold3')).rect(24, 38, 180, 5, c('wood2'));
  for (let y = 46; y < 170; y += 7) cv.vline(38, y, y + 3, c('gold2')).vline(186, y, y + 3, c('gold2'));
  framePicture(cv, 268, 62, 96, 58, 'landscape');
  plant(cv, 230, 242, 1.5);
  floorShadow(cv, 512, 236, 110, 6);
  sofa(cv, 410, 176, 190, c('vio2'));
  cv.rect(340, 204, 46, 6, c('wood3')).rect(346, 210, 4, 32, c('wood2')).rect(376, 210, 4, 32, c('wood2'));
  cv.rect(346, 194, 18, 10, c('teal4')).rect(352, 190, 6, 4, c('gray6'));
  hs.steam.push(mug(cv, 368, 194, c('gray6')));
  cv.vline(620, 100, 236, c('gold1')).poly([[606, 100], [634, 100], [628, 80], [612, 80]], c('gold4'));
  hs.lamps.push({ x: 612, y: 86, w: 16, h: 10 });
  cv.ellipse(450, 300, 170, 26, c('red3')).ellipse(450, 300, 150, 20, c('gold4')).ellipse(450, 300, 130, 15, c('red3'));
  lightPool(cv, 620, 120, 60, 80);
  return { id: 'counseling', name: '상담실', time: 'day', canvas: cv, hotspots: hs };
}

function store(): Scene {
  const cv = new PixelCanvas(W, H);
  const hs = empty();
  wall(cv, 0, 236, c('gray6'), { panel: 160 });
  hs.lamps.push(...ceiling(cv, 10, c('gray5'), [100, 260, 420, 580]));
  cv.rect(0, 30, W, 14, c('grn2')).rect(0, 44, W, 4, c('gold3'));
  text(cv, '24H  OPEN  CONVENIENCE', 180, 34, c('gray6'));
  baseboard(cv, 236, c('gray3'));
  floorTiles(cv, 242, c('gray5'), 48);
  // 바깥 (유리문)
  hs.window = windowView(cv, 14, 66, 74, 166, 'night', { seed: 41, frame: c('gray3') });
  cv.rect(70, 140, 4, 90, c('gray1')).ellipse(72, 136, 6, 3, c('gold4'));
  castShadow(cv, 104, 236, 330, 10, 'down', 0.8);
  productShelf(cv, 104, 70, 150, 166, 5);
  productShelf(cv, 264, 70, 150, 166, 9);
  hs.screens.push(fridge(cv, 428, 60, 200, 176, 3));
  floorGloss(cv, 242, 16);
  counter(cv, 0, 270, 360, 360, c('gray4'), c('gray2'));
  cv.rect(240, 236, 70, 34, c('ink2')).rect(246, 240, 40, 16, c('teal2'));
  text(cv, '1200', 250, 245, c('ink1'));
  cv.rect(60, 252, 40, 18, c('red2')).rect(110, 256, 24, 14, c('gold3'));
  return { id: 'store', name: '편의점', time: 'night', canvas: cv, hotspots: hs };
}

export function renderScenes(): Scene[] {
  return [lab('day'), lab('dusk'), lab('night'), lab('dawn'), office(), classroom(), home(), conference(), cafe(), counseling(), store()];
}
