import type { Career, ContentPack, LandingMetric } from '@grad-sim/content';
import { hasFlag } from './flags';
import { findVenue } from './review';
import { getLab } from './stats';
import { clamp, type Ending, type GameState, type Landing, type Paper } from './state';

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
  if (state.hidden.grantsWon >= 2) return '과제 수주왕';
  if (hasFlag(state, 'relationship') && state.hidden.affection >= 70) return '사랑과 연구 사이';
  if (state.debt >= 8_000_000) return '학자금의 무게를 견딘 자';
  return '성실한 연구자';
}

/** 진로 안착도 지표 (0~1). 대학원 생활 전체가 졸업 후를 결정한다 */
export function landingMetrics(pack: ContentPack, state: GameState): Record<LandingMetric, number> {
  const weeks = Math.max(1, state.week);
  const avgStress = state.hidden.stressSum / weeks;
  const avgSleep = state.hidden.sleepSum / weeks;
  const lab = getLab(pack, state.labId);
  const net = state.stats.money - state.debt;
  const sleepScore = avgSleep >= 7 && avgSleep <= 8.5 ? 1 : avgSleep >= 6 ? 0.6 : 0.2;
  return {
    papers: clamp(totalPaperScore(pack, state) / 200, 0, 1),
    topTier: clamp(topTierCount(pack, state) / 2, 0, 1),
    research: clamp((state.stats.research - 35) / 65, 0, 1),
    network: clamp(state.hidden.network / 65, 0, 1),
    trust: clamp((state.hidden.trust - 30) / 70, 0, 1),
    relation: clamp((state.hidden.relation - 20) / 75, 0, 1),
    experience: clamp(((lab?.industry ?? 1) - 1) / 8 + (hasFlag(state, 'intern-done') ? 0.3 : 0) + state.hidden.grantsWon * 0.15 + (lab?.projectLoad ?? 0) * 0.03, 0, 1),
    wellbeing: clamp(((75 - avgStress) / 50) * 0.7 + sleepScore * 0.3, 0, 1),
    finance: clamp((net + 5_000_000) / 20_000_000, 0, 1),
    luck: clamp(state.stats.luck / 100, 0, 1),
    speed: state.extended ? 0.2 : 1,
  };
}

export function computeLanding(pack: ContentPack, state: GameState, career: Career): Landing {
  const m = landingMetrics(pack, state);
  const entries = Object.entries(career.landing.weights) as [LandingMetric, number][];
  const totalW = entries.reduce((a, [, w]) => a + w, 0);
  const score = Math.round((entries.reduce((a, [k, w]) => a + w * m[k], 0) / totalW) * 100);
  const tiers = pack.landing.tiers;
  const tier = Math.max(0, tiers.findIndex((t) => score >= t.min));
  // texts는 위기→대성공 순서, tiers는 대성공→위기 순서
  const story = career.landing.texts[tiers.length - 1 - tier]!;
  const metricText = pack.landing.metrics;
  // 가장 크게 도운 지표 2개, 가장 발목 잡은 지표 1개
  const strengths = entries
    .filter(([k]) => m[k] >= 0.6)
    .sort((a, b) => b[1] * m[b[0]] - a[1] * m[a[0]])
    .slice(0, 2)
    .map(([k]) => ({ text: metricText[k]!.strong, good: true }));
  const weakness = entries
    .filter(([k]) => m[k] < 0.4)
    .sort((a, b) => b[1] * (1 - m[b[0]]) - a[1] * (1 - m[a[0]]))
    .slice(0, strengths.length ? 1 : 2)
    .map(([k]) => ({ text: metricText[k]!.weak, good: false }));
  const notes = [...strengths, ...weakness];
  if (state.debt > 0) notes.push({ text: `학자금 대출 ${Math.round(state.debt / 10000).toLocaleString()}만 원이 남았다. 첫 월급부터 매달 조금씩 갚아 나간다.`, good: false });
  return { score, tier, label: tiers[tier]!.label, story, notes };
}

/** 순자산(잔고−대출) 점수 */
export function assetScore(pack: ContentPack, state: GameState): number {
  const b = pack.balance;
  return Math.round(clamp((state.stats.money - state.debt) / b.moneyScoreUnit, b.moneyScoreMin, b.moneyScoreMax));
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
    자산: assetScore(pack, state),
  };
  const landing = career ? computeLanding(pack, state, career) : undefined;
  if (landing) breakdown['정착'] = Math.round((landing.score - 50) * pack.balance.landingScoreScale);
  const score = Object.values(breakdown).reduce((a, b) => a + b, 0);
  const grade = score >= 550 ? 'S' : score >= 420 ? 'A' : score >= 300 ? 'B' : score >= 180 ? 'C' : 'D';
  return {
    careerId,
    title: career?.name ?? '중도 포기',
    score,
    breakdown,
    grade,
    epithet: epithet(pack, state, careerId),
    landing,
    assets: { money: state.stats.money, debt: state.debt, net: state.stats.money - state.debt },
  };
}
