import { describe, expect, it } from 'vitest';
import { aiPack, checkIntegrity } from '../index';

describe('AI 콘텐츠 팩', () => {
  it('zod 스키마와 참조 무결성을 통과한다', () => {
    expect(checkIntegrity(aiPack)).toEqual([]);
  });
  it('MVP 볼륨: 연구실 7개, 아이디어 경로 9종, 저널 9개', () => {
    expect(aiPack.labs).toHaveLength(7);
    expect(aiPack.ideaSources).toHaveLength(9);
    expect(aiPack.journals).toHaveLength(9);
    expect(aiPack.venues.length).toBeGreaterThanOrEqual(15);
  });
  it('모든 연구실 분야에 주제 카드가 3장 이상 있다', () => {
    for (const lab of aiPack.labs)
      for (const f of lab.fields) expect(aiPack.topics.filter((t) => t.field === f).length).toBeGreaterThanOrEqual(3);
  });
});

import manifest from '../../../apps/web/src/art/manifest.json';
describe('연출 데이터', () => {
  it('모든 이벤트의 장면이 생성된 에셋에 존재한다', () => {
    for (const e of aiPack.events) expect(Object.keys(manifest.scenes)).toContain(e.scene);
  });
  it('모든 연구실 교수에게 캐릭터 시트가 있다', () => {
    for (const l of aiPack.labs) expect(Object.keys(manifest.characters)).toContain(`prof-${l.id}`);
  });
  it('팔레트는 32~64색', () => {
    expect(manifest.palette.length).toBeGreaterThanOrEqual(32);
    expect(manifest.palette.length).toBeLessThanOrEqual(64);
  });
});
