/**
 * UI 연출 확인용 자동 플레이 + 스크린샷 (설치된 Chrome 사용, 브라우저 다운로드 없음)
 *   npm start  →  pnpm exec tsx scripts/ui-walkthrough.ts <출력폴더> [baseUrl]
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright-core';

const out = process.argv[2] ?? 'ui-shots';
const BASE = process.argv[3] ?? 'http://localhost:4173';
mkdirSync(out, { recursive: true });

const errors: string[] = [];
const shot = async (page: Page, name: string) => {
  await page.screenshot({ path: join(out, `${name}.png`) });
  console.log('📸', name);
};
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

await page.goto(BASE);
await page.evaluate(() => indexedDB.deleteDatabase('grad-sim'));
await page.reload();
await wait(1500);
await shot(page, '01-title');

await page.getByRole('button', { name: '새 게임' }).click();
await page.getByPlaceholder('김석사').fill('도트석사');
await page.getByPlaceholder('비우면 랜덤').fill('walkthrough-7');
await page.getByRole('button', { name: /컨택 메일 쓰러 가기/ }).click();
await wait(1200);
await shot(page, '02-contact-home');

// 컨택: 답장 올 때까지 연구실 순회 (최대 4곳)
const labs = page.locator('.lab-card');
let interviewed = false;
for (let i = 0; i < 4 && !interviewed; i++) {
  await labs.nth([3, 1, 4, 5][i]!).click();
  const sel = page.locator('.mail select');
  if ((await sel.count()) === 0) continue;
  await sel.nth(0).selectOption('0');
  await sel.nth(1).selectOption('0');
  await sel.nth(2).selectOption('0');
  await page.getByRole('button', { name: '메일 보내기' }).click();
  await wait(500);
  if (i === 0) await shot(page, '03-mail-sent');
  await wait(900);
  if ((await page.locator('.interview').count()) > 0) {
    interviewed = true;
    await wait(1600);
    await shot(page, '04-interview-office');
    for (let q = 0; q < 3; q++) await page.locator(`input[name="q${q}"]`).first().check();
    await page.getByRole('button', { name: '면접 마치기' }).click();
    await wait(1400);
    await shot(page, '05-interview-result');
  }
}
const enrollBtn = page.getByRole('button', { name: /입학하기|지원·입학/ });
await enrollBtn.first().click();
await wait(1500);
await shot(page, '06-main');

// 아이디어 → 주제
await page.getByRole('button', { name: /교수 미팅에서 하사받기/ }).click();
await wait(300);
await shot(page, '07-topic-cards');
await page.locator('.topic-card').first().click();

// 몇 주 진행하며 컷신/이펙트 캡처
let cut = 0;
for (let w = 0; w < 26; w++) {
  for (let k = 0; k < 4 && (await page.locator('.cutscene').count()) > 0; k++) {
    await wait(2200);
    if (cut < 3) await shot(page, `08-cutscene-${++cut}`);
    await page.locator('.stage-choice').first().click();
    await wait(400);
  }
  const btn = page.getByRole('button', { name: /한 주 보내기/ });
  if (!(await btn.isEnabled())) break;
  await btn.click();
  if (w === 1) {
    await wait(350);
    await shot(page, '09-week-transition');
  }
  await wait(250);
}
await wait(1500);
await shot(page, '10-main-later');

// 이펙트 단독 캡처
type Fx = { getState(): { play(k: string, o?: object): void } };
const play = (k: string) => page.evaluate((kind) => (window as unknown as { __gradsimFx: Fx }).__gradsimFx.getState().play(kind), k);
for (let k = 0; k < 6 && (await page.locator('.cutscene').count()) > 0; k++) {
  await wait(2500);
  await page.locator('.stage-choice').first().click();
  await wait(500);
}
{
  await page.evaluate(() => window.scrollTo(0, 0));
  await play('accept');
  await wait(700);
  await shot(page, '11-fx-accept');
  await wait(2500);
  await play('reject');
  await wait(500);
  await shot(page, '12-fx-reject');
  await wait(2500);
  await play('firework');
  await wait(900);
  await shot(page, '13-fx-firework');
}

console.log(JSON.stringify({ errors }));
await browser.close();
