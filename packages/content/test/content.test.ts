import { describe, expect, it } from 'vitest';
import { aiPack, checkIntegrity } from '../index';

describe('AI 콘텐츠 팩', () => {
  it('zod 스키마와 참조 무결성을 통과한다', () => {
    expect(checkIntegrity(aiPack)).toEqual([]);
  });
  it('MVP 볼륨: 연구실 7개 이상(DBI 포함), 아이디어 경로 9종, 저널 20개 이상(NMI 포함)', () => {
    expect(aiPack.labs.length).toBeGreaterThanOrEqual(7);
    expect(aiPack.labs.some((l) => l.id === 'dbi')).toBe(true);
    expect(aiPack.ideaSources).toHaveLength(9);
    expect(aiPack.journals.length).toBeGreaterThanOrEqual(20);
    expect(aiPack.journals.find((j) => j.id === 'nmi')).toMatchObject({ displayName: 'Nature Machine Intelligence', tier: 'S' });
    for (const tier of ['S', 'A', 'B', 'C', 'domestic']) expect(aiPack.journals.filter((j) => j.tier === tier).length).toBeGreaterThanOrEqual(2);
    expect(aiPack.venues.length).toBeGreaterThanOrEqual(15);
  });
  it('DBI 연구실: 주제 카드 4장, 설명에 학교명·학회명 없음', () => {
    const dbi = aiPack.labs.find((l) => l.id === 'dbi')!;
    expect(aiPack.topics.filter((t) => t.id.startsWith('dbi-'))).toHaveLength(4);
    expect(`${dbi.name} ${dbi.description} ${dbi.rumors.join(' ')}`).not.toMatch(/한양|NeurIPS/);
  });
  it('v0.3 볼륨: 상점 30종·활동 30종 이상, 과제/제안서·공모전·알바 이벤트', () => {
    expect(aiPack.shop.length).toBeGreaterThanOrEqual(30);
    expect(aiPack.activities.length).toBeGreaterThanOrEqual(30);
    for (const cat of ['date', 'money', 'health']) expect(aiPack.activities.some((a) => a.category === cat)).toBe(true);
    for (const id of ['proposal-nrf', 'proposal-industry', 'proposal-ict', 'annual-report', 'contest-notice', 'short-gig']) expect(aiPack.events.some((e) => e.id === id)).toBe(true);
    expect(aiPack.flags.filter((f) => f.grant).length).toBeGreaterThanOrEqual(3);
  });
  it('컨택·상담 선택지 볼륨', () => {
    expect(aiPack.contact.mail.length).toBeGreaterThanOrEqual(5);
    for (const part of aiPack.contact.mail) expect(part.options.length).toBeGreaterThanOrEqual(4);
    expect(aiPack.contact.interview.length).toBeGreaterThanOrEqual(12);
    for (const q of aiPack.contact.interview) expect(q.options.length).toBeGreaterThanOrEqual(4);
    expect(aiPack.counseling.map((c) => c.name)).toEqual(['정신건강의학과 진료', '학생상담센터']);
    expect(aiPack.events.find((e) => e.id === 'counseling-alert')!.choices.length).toBeGreaterThanOrEqual(7);
    expect(aiPack.flags.some((f) => f.id === 'light-duty')).toBe(true); // 번아웃 업무 조정 (엔진에서 사용)
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
