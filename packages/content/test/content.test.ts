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
