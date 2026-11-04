/** 개발용 미리보기: 시트를 정수배 확대해 한 장으로 (pnpm art:preview → scratch 폴더) */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHARACTERS, EXPRESSIONS, FRAME, renderFrame } from './characters';
import { c } from './palette';
import { PixelCanvas } from './lib/canvas';

export function upscale(src: PixelCanvas, k: number): PixelCanvas {
  const out = new PixelCanvas(src.w * k, src.h * k);
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) out.rect(x * k, y * k, k, k, src.get(x, y));
  return out;
}

export function writePreview(dir: string, name: string, cv: PixelCanvas, k = 2): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${name}.png`), upscale(cv, k).toPNG());
}

if (process.argv[1]?.endsWith('preview.ts')) {
  const dir = process.argv[2] ?? '.';
  const which = process.argv[3] ?? 'characters';
  if (which === 'characters') {
    // 행: 캐릭터, 열: 표정 (기본 프레임)
    const sheet = new PixelCanvas(FRAME * EXPRESSIONS.length, FRAME * CHARACTERS.length, c('blue3'));
    CHARACTERS.forEach((ch, r) => EXPRESSIONS.forEach((e, col) => sheet.blit(renderFrame(ch, e, 'idle'), col * FRAME, r * FRAME)));
    writePreview(dir, 'characters', sheet, 1);
    const one = new PixelCanvas(FRAME * 3, FRAME * 2, c('blue3'));
    one.blit(renderFrame(CHARACTERS[0]!, 'normal', 'idle'), 0, 0).blit(renderFrame(CHARACTERS[0]!, 'normal', 'blink'), FRAME, 0).blit(renderFrame(CHARACTERS[0]!, 'normal', 'talk'), FRAME * 2, 0);
    one.blit(renderFrame(CHARACTERS[1]!, 'angry', 'idle'), 0, FRAME).blit(renderFrame(CHARACTERS[4]!, 'happy', 'talk'), FRAME, FRAME).blit(renderFrame(CHARACTERS[10]!, 'happy', 'idle'), FRAME * 2, FRAME);
    writePreview(dir, 'characters-zoom', one, 3);
  }
}

if (process.argv[1]?.endsWith('preview.ts') && process.argv[3] === 'scenes') {
  const { renderScenes } = await import('./scenes');
  const scenes = renderScenes();
  const cols = 2;
  const sheet = new PixelCanvas(640 * cols, 360 * Math.ceil(scenes.length / cols), c('ink0'));
  scenes.forEach((s, i) => sheet.blit(s.canvas, (i % cols) * 640, Math.floor(i / cols) * 360));
  writePreview(process.argv[2]!, 'scenes', sheet, 1);
  for (const s of scenes) writePreview(process.argv[2]!, `scene-${s.id}`, s.canvas, 2);
}

if (process.argv[1]?.endsWith('preview.ts') && process.argv[3] === 'fx') {
  const { renderFx } = await import('./fx');
  const list = renderFx();
  const w = Math.max(...list.map((s) => s.canvas.w)) + 8;
  const h = list.reduce((a, s) => a + s.canvas.h + 4, 4);
  const sheet = new PixelCanvas(w, h, c('blue2'));
  let y = 4;
  for (const s of list) {
    sheet.blit(s.canvas, 4, y);
    y += s.canvas.h + 4;
  }
  writePreview(process.argv[2]!, 'fx', sheet, 3);
}

if (process.argv[1]?.endsWith('preview.ts') && process.argv[3] === 'frames') {
  const { FRAMES } = await import('./characters');
  const picks = [CHARACTERS[0]!, CHARACTERS[2]!, CHARACTERS[8]!];
  const sheet = new PixelCanvas(FRAME * FRAMES.length, FRAME * picks.length, c('blue3'));
  picks.forEach((ch, r) => FRAMES.forEach((f, col) => sheet.blit(renderFrame(ch, r === 1 ? 'happy' : 'normal', f), col * FRAME, r * FRAME)));
  writePreview(process.argv[2]!, 'frames', sheet, 2);
}
