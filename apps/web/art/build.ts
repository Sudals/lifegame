/**
 * 에셋 생성: pnpm --filter web art
 *  → public/art/*.png + src/art/manifest.json + art/palette.hex
 * 생성 결과는 커밋한다 (Aseprite 손보정 후 덮어쓰지 않도록 빌드에서는 자동 실행하지 않음).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHARACTERS, EXPRESSIONS, FRAME, FRAMES, renderSheet } from './characters';
import { ICONS, renderFx } from './fx';
import { PALETTE } from './palette';
import { renderScenes } from './scenes';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '../public/art');
mkdirSync(out, { recursive: true });

let bytes = 0;
const write = (name: string, png: Buffer) => {
  writeFileSync(join(out, `${name}.png`), png);
  bytes += png.length;
};

const manifest = {
  palette: PALETTE,
  scene: { w: 640, h: 360 } as const,
  scenes: {} as Record<string, { name: string; time: string; file: string; hotspots: unknown }>,
  characters: {} as Record<string, { name: string; file: string; frame: number }>,
  expressions: EXPRESSIONS,
  frames: FRAMES,
  sheets: {} as Record<string, { file: string; w: number; h: number; frameW: number; frameH: number; frames: number }>,
  icons: ICONS,
};

for (const s of renderScenes()) {
  write(`scene-${s.id}`, s.canvas.toPNG());
  manifest.scenes[s.id] = { name: s.name, time: s.time, file: `/art/scene-${s.id}.png`, hotspots: s.hotspots };
}
for (const ch of CHARACTERS) {
  write(`char-${ch.id}`, renderSheet(ch).toPNG());
  manifest.characters[ch.id] = { name: ch.name, file: `/art/char-${ch.id}.png`, frame: FRAME };
}
for (const fx of renderFx()) {
  write(fx.id, fx.canvas.toPNG());
  manifest.sheets[fx.id] = { file: `/art/${fx.id}.png`, w: fx.canvas.w, h: fx.canvas.h, frameW: fx.frameW, frameH: fx.frameH, frames: fx.frames };
}

writeFileSync(join(here, '../src/art/manifest.json'), JSON.stringify(manifest, null, 1));
writeFileSync(join(here, 'palette.hex'), PALETTE.map((h) => h.slice(1)).join('\n') + '\n');
console.log(
  JSON.stringify({
    palette: PALETTE.length,
    scenes: Object.keys(manifest.scenes).length,
    characters: Object.keys(manifest.characters).length,
    sheets: Object.keys(manifest.sheets).length,
    totalKB: Math.round(bytes / 1024),
  }),
);
