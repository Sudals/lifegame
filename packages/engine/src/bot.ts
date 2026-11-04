import type { ContentPack } from '@grad-sim/content';
import {
  advanceWeek,
  canAttendConference,
  chooseCareer,
  chooseTopic,
  contactLab,
  dropIdeas,
  enroll,
  explore,
  fallbackLabId,
  interview,
  MAX_CONTACTS,
  newGame,
  resolveInbox,
  submit,
} from './game';
import { activePapers, canExplore } from './research';
import { acceptanceHint, findVenue, submitTargets } from './review';
import { careerOffers } from './scoring';
import { canDualTask, checkPlan, getLab, GPU_RANK } from './stats';
import { PLAN_DEFAULTS, type GameState, type WeeklyPlan } from './state';
import { ongoingConferences } from './time';

/** 밸런스 시뮬레이션용 봇 전략 (개발환경 문서 9장) */
export type BotStrategy = 'diligent' | 'allnighter' | 'balanced';

const STRATEGY: Record<BotStrategy, { sleep: number; research: number; study: number }> = {
  diligent: { sleep: 7, research: 0.6, study: 0.25 },
  allnighter: { sleep: 5, research: 0.8, study: 0.15 },
  balanced: { sleep: 7.5, research: 0.45, study: 0.2 },
};

function botPlan(pack: ContentPack, s: GameState, strat: BotStrategy): WeeklyPlan {
  const cfg = STRATEGY[strat];
  const active = activePapers(s);
  const thesis = active.find((p) => p.kind === 'thesis');
  const lateThesis = thesis && s.semesterDeadlineWeek - s.week <= 12;
  const focus =
    (lateThesis ? thesis : undefined) ??
    active.find((p) => p.kind === 'paper' && p.stage === 'writing') ??
    active.find((p) => p.stage === 'revision') ??
    active.find((p) => p.kind === 'paper') ??
    thesis;
  const conf = canAttendConference(s) ? ongoingConferences(pack, s)[0] : undefined;
  // 연구력 70 이상이면 두 번째 작업도 진행
  const second = canDualTask(pack, s) ? active.find((p) => p.id !== focus?.id) : undefined;
  const plan: WeeklyPlan = {
    ...PLAN_DEFAULTS,
    sleepPerDay: cfg.sleep,
    research: 0,
    study: 0,
    rest: 0,
    focusPaperId: focus?.id ?? null,
    secondFocusPaperId: second?.id ?? null,
    split: 0.6,
    counseling: s.stats.stress >= 75 && s.stats.money > 0,
    attendConferenceId: conf && s.stats.money > 2_000_000 ? conf.venueId : null,
  };
  const free = Math.max(0, checkPlan(pack, s, plan).freeHours);
  plan.research = Math.floor(free * cfg.research);
  plan.study = Math.floor(free * cfg.study);
  plan.rest = Math.max(0, free - plan.research - plan.study);
  return plan;
}

export interface BotResult {
  state: GameState;
  weeks: number;
}

export function runBot(pack: ContentPack, seed: string, strat: BotStrategy, maxWeeks = 200): BotResult {
  let s = newGame(pack, { name: 'bot', background: 'cs', startTerm: 3, seed });

  // 컨택: 입학 커트가 높은 순서로 도전
  const order = [...pack.labs].sort((a, b) => b.admissionCut - a.admissionCut);
  for (const lab of order) {
    if (s.contacts.length >= MAX_CONTACTS || s.contacts.some((c) => c.admitted)) break;
    s = contactLab(pack, s, lab.id, { interest: 0, pitch: 0, question: 0 });
    const c = s.contacts.at(-1)!;
    if (c.replied) s = interview(pack, s, lab.id, [0, 0, 0]);
  }
  const admitted = s.contacts.find((c) => c.admitted)?.labId ?? fallbackLabId(pack, s)!;
  s = enroll(pack, s, admitted);

  let guard = 0;
  while (s.phase === 'semester' && guard++ < maxWeeks * 6) {
    while (s.inbox.length) s = resolveInbox(pack, s, 0);
    if (s.phase !== 'semester') break;

    if (s.ideaCandidates) {
      // 연구실 GPU로 감당 가능한 카드 중 가장 참신한 것. 없으면 버린다.
      const labGpu = GPU_RANK[getLab(pack, s.labId)!.gpu];
      const best = s.ideaCandidates.topicIds
        .map((id) => pack.topics.find((t) => t.id === id)!)
        .filter((t) => GPU_RANK[t.gpu] <= labGpu)
        .sort((a, b) => b.novelty - a.novelty)[0];
      try {
        s = best ? chooseTopic(pack, s, best.id) : dropIdeas(s);
      } catch {
        s = dropIdeas(s); // 최대 편수
      }
    } else if (activePapers(s).filter((p) => p.kind === 'paper').length < 2 && !canExplore(pack, s, 'professor')) {
      s = explore(pack, s, s.week % 2 ? 'professor' : 'arxiv');
    }

    const safeMode = !s.papers.some((x) => x.kind === 'paper' && x.stage === 'accepted') && s.semesterDeadlineWeek - s.week < 36;
    for (const p of s.papers.filter((x) => x.stage === 'ready')) {
      const targets = submitTargets(pack, s)
        .map((t) => {
          const v = findVenue(pack, t.venueId)!;
          const h = acceptanceHint(s, p, v);
          // 졸업 요건용 논문이 아직 없으면 졸업 심사 전에 결과가 나오는 곳만 노린다
          const hasPaper = s.papers.some((x) => x.kind === 'paper' && x.stage === 'accepted');
          const worstResult = t.kind === 'journal' ? s.week + (v as { reviewMonths: [number, number] }).reviewMonths[1] * 4 : t.resultWeek;
          const waitOk = (t.kind === 'journal' || t.deadlineWeek! - s.week <= 10) && (hasPaper || worstResult < s.semesterDeadlineWeek);
          return { t, prob: (h.low + h.high) / 2, cut: v.cut, waitOk };
        })
        .filter((x) => x.waitOk && x.prob >= (safeMode ? 0.85 : 0.45))
        .sort((a, b) => b.cut - a.cut);
      const pick = targets[0];
      if (pick) s = submit(pack, s, p.id, pick.t.venueId);
    }

    s = advanceWeek(pack, s, botPlan(pack, s, strat));
  }

  while (s.inbox.length) s = resolveInbox(pack, s, 0);
  if (s.phase === 'career') {
    const best = careerOffers(pack, s).sort((a, b) => b.score - a.score)[0];
    if (best) s = chooseCareer(pack, s, best.id);
  }
  return { state: s, weeks: s.week };
}
