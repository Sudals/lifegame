import type { ContentPack, Journal, Venue } from '@grad-sim/content';
import { log } from './research';
import type { Rng } from './rng';
import { applyEffects, getLab } from './stats';
import { clamp, type GameState, type Paper } from './state';
import { upcomingDeadlines } from './time';

const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function findVenue(pack: ContentPack, id: string): Venue | Journal | null {
  return pack.venues.find((v) => v.id === id) ?? pack.journals.find((j) => j.id === id) ?? null;
}

function fitBonus(venue: Venue | Journal, field: string): number {
  if (venue.fields.length === 0) return 0;
  return venue.fields.includes(field) ? 5 : -4;
}

/** 심사 판정의 핵심 값: (완성도 − 컷 + 적합도 + 운 보정 + 리버탈) / 8 */
export function reviewMargin(state: GameState, paper: Paper, venue: Venue | Journal): number {
  return (paper.quality + fitBonus(venue, paper.field) + (state.stats.luck - 50) / 10 + (paper.rebuttalBonus ?? 0) - venue.cut) / 8;
}

/** 투고 화면용 채택 확률 힌트. 연구력이 높을수록 오차가 작다. */
export function acceptanceHint(state: GameState, paper: Paper, venue: Venue | Journal): { low: number; high: number } {
  const p = sigmoid(reviewMargin(state, paper, venue) * 1.6);
  const err = clamp(0.35 - state.stats.research / 250, 0.05, 0.35);
  return { low: clamp(p - err, 0, 1), high: clamp(p + err, 0, 1) };
}

export interface SubmitTarget {
  venueId: string;
  kind: 'conference' | 'journal';
  deadlineWeek: number | null;
  resultWeek: number;
}

export function submitTargets(pack: ContentPack, state: GameState): SubmitTarget[] {
  const seen = new Set<string>();
  const out: SubmitTarget[] = [];
  for (const d of upcomingDeadlines(pack, state, 40)) {
    if (seen.has(d.venueId)) continue;
    seen.add(d.venueId);
    out.push({ venueId: d.venueId, kind: 'conference', deadlineWeek: d.week, resultWeek: d.resultWeek });
  }
  for (const j of pack.journals) out.push({ venueId: j.id, kind: 'journal', deadlineWeek: null, resultWeek: -1 });
  return out;
}

/** ⑧ 투고 */
export function submitPaper(pack: ContentPack, state: GameState, paperId: string, venueId: string, rng: Rng): void {
  const p = state.papers.find((x) => x.id === paperId);
  if (!p || p.stage !== 'ready') throw new Error('투고 가능한 원고가 아닙니다.');
  const target = submitTargets(pack, state).find((t) => t.venueId === venueId);
  if (!target) throw new Error('지금 투고할 수 없는 곳입니다 (마감 일정 확인).');
  // 중복 투고 금지: 동일 논문이 심사 중이면 위에서 stage로 차단됨
  p.venueId = venueId;
  p.venueKind = target.kind;
  p.submittedWeek = state.week;
  p.rebuttalDone = false;
  p.rebuttalBonus = 0;
  if (target.kind === 'journal') {
    const j = pack.journals.find((x) => x.id === venueId)!;
    p.resultWeek = state.week + rng.int(j.reviewMonths[0], j.reviewMonths[1]) * 4;
  } else {
    p.resultWeek = target.resultWeek;
  }
  p.stage = 'review';
  const name = findVenue(pack, venueId)!.displayName;
  log(state, `「${p.title}」를 ${name}에 투고했다. 결과 발표까지 기다리자.`, 'info');
}

function reviewerScores(margin: number, rng: Rng): number[] {
  const n = rng.int(3, 4);
  return Array.from({ length: n }, (_, i) => clamp(Math.round(5.5 + margin * 1.2 + rng.normal(0, 1.1) - (i === 1 ? 1 : 0)), 1, 10));
}

/** 리버탈: 결과 4주 전, 예비 점수를 보고 대응 */
export function queueRebuttals(pack: ContentPack, state: GameState, rng: Rng): void {
  for (const p of state.papers) {
    if (p.stage !== 'review' || p.venueKind !== 'conference' || p.rebuttalDone || p.resultWeek === undefined) continue;
    const v = pack.venues.find((x) => x.id === p.venueId);
    if (!v?.rebuttal || state.week !== p.resultWeek - 4) continue;
    p.rebuttalDone = true;
    state.inbox.push({ kind: 'rebuttal', paperId: p.id, scores: reviewerScores(reviewMargin(state, p, v), rng) });
  }
}

export function rebuttalChoices(): { label: string; hint: string }[] {
  return [
    { label: '정중한 반박', hint: '연구력에 비례해 점수 상승' },
    { label: '추가 실험 약속', hint: '점수↑↑, 체력↓ 스트레스↑' },
    { label: '일부 인정', hint: '점수 소폭↑, 스트레스↓' },
  ];
}

export function resolveRebuttal(state: GameState, paperId: string, choice: number): void {
  const p = state.papers.find((x) => x.id === paperId);
  if (!p) return;
  if (choice === 0) p.rebuttalBonus = 2 + state.stats.research / 40;
  else if (choice === 1) {
    p.rebuttalBonus = 5;
    applyEffects(state, { stamina: -8, stress: 5 });
  } else {
    p.rebuttalBonus = 1;
    applyEffects(state, { stress: -3 });
  }
  log(state, `「${p.title}」 리버탈을 제출했다.`, 'info');
}

/** ⑨~⑪ 결과 발표 처리 */
export function resolveReviews(pack: ContentPack, state: GameState, rng: Rng): void {
  for (const p of state.papers) {
    if (p.stage !== 'review' || p.resultWeek !== state.week || !p.venueId) continue;
    const venue = findVenue(pack, p.venueId)!;
    const margin = reviewMargin(state, p, venue);
    const prob = sigmoid(margin * 1.6);
    const accepted = rng.chance(prob);
    const scores = reviewerScores(margin + (accepted ? 0.4 : -0.4), rng);

    if (p.venueKind === 'conference') {
      const v = venue as Venue;
      if (accepted) {
        let pres = 'poster';
        if (v.tier === 'A+') {
          if (margin > 2.5 && rng.chance(0.4)) pres = 'oral';
          else if (margin > 1.2 && rng.chance(0.5)) pres = 'spotlight';
        }
        accept(state, p, pres);
        incentive(pack, state, v.tier);
        p.reviews.push({ venueId: v.id, kind: 'conference', scores, decision: pres, week: state.week });
        log(state, `🎉 「${p.title}」 ${v.displayName} 채택! (${pres.toUpperCase()}) 리뷰 점수 ${scores.join('/')}`, 'good');
      } else {
        reject(state, p);
        p.reviews.push({ venueId: v.id, kind: 'conference', scores, decision: 'reject', week: state.week });
        log(state, `「${p.title}」 ${v.displayName} 리젝... 리뷰어 2의 점수는 ${scores[1]}점이었다.`, 'bad');
      }
      continue;
    }

    const j = venue as Journal;
    let decision: string;
    if (accepted) decision = rng.chance(0.3) || p.reviews.some((r) => r.decision === 'minor') ? 'accept' : 'minor';
    else decision = margin > -1.5 && !p.reviews.some((r) => r.decision === 'major' && r.venueId === j.id) ? 'major' : 'reject';
    p.reviews.push({ venueId: j.id, kind: 'journal', scores, decision, week: state.week });

    if (decision === 'accept') {
      accept(state, p, 'journal');
      incentive(pack, state, j.tier === 'S' ? 'A+' : j.tier);
      if (j.apc > 0) {
        applyEffects(state, { money: -j.apc });
        log(state, `APC ${j.apc.toLocaleString()}원을 납부했다.`, 'info');
      }
      log(state, `🎉 「${p.title}」 ${j.displayName} 최종 채택!`, 'good');
    } else if (decision === 'minor') {
      p.quality += 2;
      p.resultWeek = state.week + rng.int(4, 8);
      applyEffects(state, { stress: -3 });
      log(state, `「${p.title}」 ${j.displayName} Minor Revision. 거의 다 왔다!`, 'good');
    } else if (decision === 'major') {
      p.stage = 'revision';
      p.progress = 0;
      applyEffects(state, { stress: 8 });
      log(state, `「${p.title}」 ${j.displayName} Major Revision. 리뷰어 코멘트가 12페이지다.`, 'bad');
    } else {
      reject(state, p);
      log(state, `「${p.title}」 ${j.displayName} 리젝.`, 'bad');
    }
  }
}

/** 채택 인센티브: 연구실 실적 × 단가 (A+/S는 2배, A는 1배) */
function incentive(pack: ContentPack, state: GameState, tier: string): void {
  const lab = getLab(pack, state.labId);
  if (!lab) return;
  const mult = tier === 'A+' ? 2 : tier === 'A' ? 1 : 0;
  const amount = lab.track * pack.balance.acceptIncentivePerTrack * mult;
  if (amount <= 0) return;
  state.stats.money += amount;
  log(state, `💰 논문 채택 인센티브 ${amount.toLocaleString()}원이 들어왔다.`, 'good');
}

function accept(state: GameState, p: Paper, presentation: string): void {
  p.stage = 'accepted';
  p.presentation = presentation;
  p.acceptedWeek = state.week;
  applyEffects(state, { stress: -15, research: 3, trust: 6, network: 3 });
}

function reject(state: GameState, p: Paper): void {
  p.stage = 'ready';
  p.quality += 3; // 리뷰 반영 후 재투고 시 완성도 소폭↑
  p.venueId = undefined;
  p.venueKind = undefined;
  p.resultWeek = undefined;
  applyEffects(state, { stress: 10, trust: -1 });
}

/** 학회 참석: 채택 논문 발표 시 연구실이 비용 지원 */
export function attendCost(pack: ContentPack, state: GameState, venueId: string): number {
  const v = pack.venues.find((x) => x.id === venueId);
  if (!v) return 0;
  const presenting = state.papers.some((p) => p.stage === 'accepted' && p.venueId === venueId && p.acceptedWeek !== undefined && state.week - p.acceptedWeek < 40);
  if (presenting) return 0;
  const lab = getLab(pack, state.labId);
  return lab && lab.track >= 4 ? Math.round(v.fee / 2) : v.fee;
}
