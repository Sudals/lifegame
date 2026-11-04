import type { Career, ContentPack } from '@grad-sim/content';
import { findVenue } from './review';
import { getLab } from './stats';
import { clamp, type Ending, type GameState, type Paper } from './state';

export function paperTierKey(pack: ContentPack, p: Paper): string | null {
  if (p.stage !== 'accepted' || p.kind !== 'paper' || !p.venueId) return null;
  const v = findVenue(pack, p.venueId);
  if (!v) return null;
  if (p.venueKind === 'conference') return v.tier === 'A+' ? `A+:${p.presentation ?? 'poster'}` : v.tier;
  return v.tier === 'S' ? 'S' : `J:${v.tier}`;
}

export function paperScore(pack: ContentPack, p: Paper): number {
  const key = paperTierKey(pack, p);
  if (!key) return 0;
  return (pack.balance.tierScore[key] ?? 0) * (pack.balance.authorWeight[String(p.authorOrder)] ?? 0.2);
}

export function totalPaperScore(pack: ContentPack, state: GameState): number {
  return Math.round(state.papers.reduce((s, p) => s + paperScore(pack, p), 0));
}

/** 1저자 탑티어(A+ 학회 또는 S 저널) 편수 */
export function topTierCount(pack: ContentPack, state: GameState): number {
  return state.papers.filter((p) => {
    const k = paperTierKey(pack, p);
    return p.authorOrder === 1 && k !== null && (k.startsWith('A+') || k === 'S');
  }).length;
}

export function acceptedCount(state: GameState): number {
  return state.papers.filter((p) => p.kind === 'paper' && p.stage === 'accepted').length;
}

export function meetsCareer(pack: ContentPack, state: GameState, c: Career): boolean {
  const r = c.req;
  const lab = getLab(pack, state.labId);
  if (r.minPaperScore !== undefined && totalPaperScore(pack, state) < r.minPaperScore) return false;
  if (r.minTopTier !== undefined && topTierCount(pack, state) < r.minTopTier) return false;
  if (r.minResearch !== undefined && state.stats.research < r.minResearch) return false;
  if (r.minNetwork !== undefined && state.hidden.network < r.minNetwork) return false;
  if (r.minTrust !== undefined && state.hidden.trust < r.minTrust) return false;
  if (r.minIndustryLab !== undefined && (lab?.industry ?? 0) < r.minIndustryLab) return false;
  if (r.maxStress !== undefined && state.stats.stress > r.maxStress) return false;
  if (r.minMoney !== undefined && state.stats.money < r.minMoney) return false;
  return true;
}

export function careerOffers(pack: ContentPack, state: GameState): Career[] {
  return pack.careers.filter((c) => meetsCareer(pack, state, c));
}

function epithet(pack: ContentPack, state: GameState, careerId: string | null): string {
  const rejects = state.papers.reduce((s, p) => s + p.reviews.filter((r) => r.decision === 'reject').length, 0);
  const avgSleep = state.hidden.sleepSum / Math.max(1, state.week);
  const lab = getLab(pack, state.labId);
  if (careerId === null) return '다시 일어설 연구자';
  if (topTierCount(pack, state) >= 2) return '탑티어 수집가';
  if (rejects >= 4 && acceptedCount(state) > 0) return '리뷰어 2의 천적';
  if (avgSleep >= 7.5) return '정시 퇴근 석사';
  if (lab && lab.projectLoad >= 5) return '과제의 노예';
  if (careerId === 'outside') return '인생 2회차';
  if (acceptedCount(state) === 0) return '졸업이 곧 업적';
  return '성실한 연구자';
}

/** 최종 스코어 (기획안 8.3) */
export function computeEnding(pack: ContentPack, state: GameState, careerId: string | null): Ending {
  const career = careerId ? pack.careers.find((c) => c.id === careerId) ?? null : null;
  const weeks = Math.max(1, state.week);
  const avgStress = state.hidden.stressSum / weeks;
  const avgSleep = state.hidden.sleepSum / weeks;
  const accepted = state.papers.filter((p) => p.kind === 'paper' && p.stage === 'accepted');

  const breakdown: Record<string, number> = {
    논문: totalPaperScore(pack, state),
    진로: career?.score ?? 0,
    인용: Math.round(accepted.reduce((s, p) => s + Math.max(0, p.quality - 50) * 0.5, 0)),
    졸업기간: careerId === null ? -50 : state.extended ? -20 : 30,
    웰빙: Math.round(clamp((60 - avgStress) * 1.5, -30, 60) + (avgSleep >= 7 && avgSleep <= 8.5 ? 20 : avgSleep >= 6 ? 5 : -10)),
    잔여자금: Math.round(clamp(state.stats.money / 100000, -30, 30)),
  };
  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const grade = score >= 550 ? 'S' : score >= 420 ? 'A' : score >= 300 ? 'B' : score >= 180 ? 'C' : 'D';
  return {
    careerId,
    title: career?.name ?? '중도 포기',
    score,
    breakdown,
    grade,
    epithet: epithet(pack, state, careerId),
  };
}
