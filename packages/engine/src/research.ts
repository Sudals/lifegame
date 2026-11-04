import type { ContentPack, Topic } from '@grad-sim/content';
import type { Rng } from './rng';
import { applyEffects, efficiency, getLab, GPU_RANK } from './stats';
import { clamp, type GameState, type Paper, type WeeklyPlan } from './state';
import { upcomingDeadlines } from './time';

export const MAX_ACTIVE_PAPERS = 3;

export function getTopic(pack: ContentPack, id: string): Topic {
  const t = pack.topics.find((x) => x.id === id);
  if (!t) throw new Error(`없는 주제 카드: ${id}`);
  return t;
}

export function activePapers(state: GameState): Paper[] {
  return state.papers.filter((p) => p.stage === 'experiment' || p.stage === 'writing' || p.stage === 'revision');
}

export function log(state: GameState, text: string, tone?: 'good' | 'bad' | 'info'): void {
  state.log.push({ week: state.week, text, tone });
  if (state.log.length > 200) state.log.splice(0, state.log.length - 200);
}

export function canExplore(pack: ContentPack, state: GameState, sourceId: string): string | null {
  const src = pack.ideaSources.find((s) => s.id === sourceId);
  if (!src) return '없는 아이디어 경로입니다.';
  if (state.phase !== 'semester') return '입학 후에 가능합니다.';
  if (state.exploredWeek === state.week) return '아이디어 탐색은 한 주에 한 번만 할 수 있습니다.';
  if (state.ideaCandidates) return '먼저 지금 후보 중에서 주제를 고르거나 버리세요.';
  if (src.requiresConference && !(state.attendedConference && state.week - state.attendedConference.week <= 1))
    return '학회에 참석한 직후에만 가능합니다.';
  return null;
}

/** ① 아이디어 탐색: 경로별 가중치로 주제 카드 후보를 뽑는다 */
export function exploreIdeas(pack: ContentPack, state: GameState, sourceId: string, rng: Rng): void {
  const err = canExplore(pack, state, sourceId);
  if (err) throw new Error(err);
  const src = pack.ideaSources.find((s) => s.id === sourceId)!;
  const lab = getLab(pack, state.labId);
  applyEffects(state, src.cost);
  state.exploredWeek = state.week;

  const used = new Set(state.papers.map((p) => p.topicId));
  let pool = pack.topics.filter((t) => !used.has(t.id));
  const picked: string[] = [];
  const n = Math.min(src.draw, pool.length);
  for (let i = 0; i < n; i++) {
    const t = rng.weighted(pool, (c) => {
      let w = Math.exp(0.5 * src.noveltyBias * (c.novelty - 3) + 0.5 * src.trendBias * (c.trend - 3));
      if (lab?.fields.includes(c.field)) w *= src.id === 'cross' ? 0.5 : 2.5;
      return w;
    });
    picked.push(t.id);
    pool = pool.filter((c) => c.id !== t.id);
  }
  state.ideaCandidates = { topicIds: picked, sourceId };
  log(state, `[${src.name}] 아이디어 후보 ${picked.length}개를 얻었다.`, 'info');
}

export function discardIdeas(state: GameState): void {
  state.ideaCandidates = null;
}

/** ② 주제 선정: 후보 카드 → 논문 프로젝트 생성 */
export function pickTopic(pack: ContentPack, state: GameState, topicId: string, rng: Rng): Paper {
  const cand = state.ideaCandidates;
  if (!cand || !cand.topicIds.includes(topicId)) throw new Error('후보에 없는 주제입니다.');
  if (activePapers(state).filter((p) => p.kind === 'paper').length >= MAX_ACTIVE_PAPERS)
    throw new Error(`진행 중인 논문은 최대 ${MAX_ACTIVE_PAPERS}편입니다.`);
  const t = getTopic(pack, topicId);
  const src = pack.ideaSources.find((s) => s.id === cand.sourceId)!;
  const lab = getLab(pack, state.labId);
  let bonus = src.qualityBonus;
  if (src.id === 'shower') bonus += rng.chance(state.stats.luck / 200) ? 12 : 0;
  const paper: Paper = {
    id: `p${state.nextId++}`,
    topicId: t.id,
    title: t.title,
    field: t.field,
    kind: 'paper',
    stage: 'experiment',
    progress: 0,
    quality: t.novelty * 5 + t.trend * 1.5 + bonus + (lab?.fields.includes(t.field) ? 3 : 0),
    authorOrder: src.coAuthor ? 2 : 1,
    checkpoints: 0,
    reviews: [],
    crunchWeeks: 0,
  };
  if (src.coAuthor) paper.progress = 25; // 선배 연구 확장: 빠른 시작
  state.papers.push(paper);
  state.ideaCandidates = null;
  log(state, `새 연구 시작: 「${t.title}」`, 'good');
  return paper;
}

export function createThesis(state: GameState): void {
  if (state.papers.some((p) => p.kind === 'thesis')) return;
  state.papers.push({
    id: `p${state.nextId++}`,
    topicId: 'thesis',
    title: '석사 학위논문',
    field: 'thesis',
    kind: 'thesis',
    stage: 'writing',
    progress: 0,
    quality: 30,
    authorOrder: 1,
    checkpoints: 0,
    reviews: [],
    crunchWeeks: 0,
  });
  log(state, '마지막 학기 시작! 학위논문 작성을 시작해야 한다. (연구 보드에서 집중 대상으로 지정)', 'info');
}

function speedFactor(pack: ContentPack, state: GameState, p: Paper): number {
  const eff = efficiency(pack, state);
  const research = state.stats.research;
  if (p.kind === 'thesis') return eff * (0.8 + research / 150);
  const t = getTopic(pack, p.topicId);
  const lab = getLab(pack, state.labId);
  const gpuGap = lab ? GPU_RANK[t.gpu] - GPU_RANK[lab.gpu] : 0;
  const gpu = gpuGap > 0 ? Math.max(0.25, 1 - 0.3 * gpuGap) : 1 + 0.05 * -gpuGap;
  const field = lab?.fields.includes(t.field) ? 1.1 : 0.9;
  const skill = clamp(1 + (research - t.difficulty * 15) / 200, 0.6, 1.3);
  return eff * gpu * field * skill * (0.8 + research / 150);
}

/** ③~⑤ 실험 중간 판정 */
function experimentCheckpoint(pack: ContentPack, state: GameState, p: Paper, rng: Rng): void {
  const t = getTopic(pack, p.topicId);
  const r = state.stats.research;
  const luck = state.stats.luck;
  const pDiscovery = 0.03 + luck / 1000;
  const pFail = clamp(0.18 + t.difficulty * 0.03 - r / 400, 0.05, 0.4);
  const pSuccess = clamp(0.45 + (r - t.difficulty * 12) / 150 + luck / 400, 0.15, 0.8);
  const roll = rng.next();
  p.checkpoints += 1;
  if (roll < pDiscovery) {
    p.quality += 15;
    log(state, `「${p.title}」 실험에서 의외의 발견! 결과가 기대 이상이다.`, 'good');
  } else if (roll < pDiscovery + pFail) {
    state.inbox.push({ kind: 'experiment-fail', paperId: p.id });
    log(state, `「${p.title}」 실험 결과가 기대와 다르다...`, 'bad');
  } else if (roll < pDiscovery + pFail + pSuccess) {
    p.quality += 7;
    log(state, `「${p.title}」 실험 성공. 베이스라인을 이겼다.`, 'good');
  } else {
    p.quality += 2;
    log(state, `「${p.title}」 실험 결과가 애매하다. 조금 더 다듬어야 할 듯.`, 'info');
  }
}

/** 주간 연구 시간 투입 → 진척/완성도 */
export function progressResearch(pack: ContentPack, state: GameState, plan: WeeklyPlan, rng: Rng): void {
  const active = activePapers(state);
  const focus = active.find((p) => p.id === plan.focusPaperId) ?? (active.length === 1 ? active[0] : undefined);
  if (!focus || plan.research <= 0) return;
  // 실험 실패 판정을 기다리는 논문은 멈춤
  if (state.inbox.some((i) => i.kind === 'experiment-fail' && i.paperId === focus.id)) return;

  const b = pack.balance;
  // 주제 카드의 weeks = 주 40시간 투입 기준 예상 소요 기간 (실험 60% / 작성 40%)
  const hoursFactor = plan.research / 40;
  const speed = speedFactor(pack, state, focus);
  const weeks = focus.kind === 'thesis' ? 8 : getTopic(pack, focus.topicId).weeks;
  const rate = hoursFactor * speed * b.progressPerHour * 1.8;

  if (focus.stage === 'experiment') {
    const before = focus.progress;
    focus.progress = Math.min(100, focus.progress + (100 / (weeks * 0.6)) * rate);
    if (before < 50 && focus.progress >= 50 && focus.checkpoints === 0) experimentCheckpoint(pack, state, focus, rng);
    if (focus.progress >= 100 && !state.inbox.some((i) => i.kind === 'experiment-fail' && i.paperId === focus.id)) {
      experimentCheckpoint(pack, state, focus, rng);
      if (!state.inbox.some((i) => i.kind === 'experiment-fail' && i.paperId === focus.id)) {
        focus.stage = 'writing';
        focus.progress = 0;
        log(state, `「${focus.title}」 실험 완료 → 논문 작성 단계로.`, 'good');
      } else {
        focus.progress = 70;
      }
    }
    return;
  }

  // 작성 / 리비전
  const nearDeadline = upcomingDeadlines(pack, state, 2).length > 0;
  const crunch = nearDeadline && plan.sleepPerDay < 6;
  if (crunch) focus.crunchWeeks += 1;
  const before = focus.progress;
  focus.progress = Math.min(100, focus.progress + (100 / (weeks * 0.4)) * rate);
  // 작성 완성도는 진척에 비례 (오래 붙잡는다고 무한히 오르지 않음) + 밤샘 크런치 소폭 보너스
  const skill = b.writingQualityBase + state.stats.research * b.writingQualityPerResearch;
  focus.quality += ((focus.progress - before) / 100) * skill * (focus.stage === 'revision' ? 0.4 : 1) + (crunch ? 1 : 0);

  if (focus.progress < 100) return;
  if (focus.stage === 'revision') {
    focus.stage = 'review';
    focus.quality += 4;
    focus.resultWeek = state.week + 8;
    log(state, `「${focus.title}」 리비전 원고를 제출했다. 다시 심사 대기.`, 'info');
    return;
  }
  // 작성 완료: 최종 보정
  const lab = getLab(pack, state.labId);
  focus.quality += state.stats.research * 0.12 + state.hidden.trust / 25;
  if (lab && rng.chance(lab.track * 0.1)) {
    focus.quality += lab.track * 2;
    log(state, `${lab.professor}님의 첨삭으로 논문이 확 좋아졌다! (연구실 실적 보너스)`, 'good');
  }
  if (focus.crunchWeeks >= 3) focus.quality -= 4; // 급하게 쓴 페널티
  focus.quality = Math.round(focus.quality);
  if (focus.kind === 'thesis') {
    focus.stage = 'accepted';
    focus.presentation = 'thesis';
    focus.acceptedWeek = state.week;
    log(state, '학위논문 초안 완성! 심사 준비 완료.', 'good');
  } else {
    focus.stage = 'ready';
    focus.progress = 100;
    log(state, `「${focus.title}」 원고 완성 (완성도 ${focus.quality}). 투고처를 고르자.`, 'good');
  }
}

export function experimentFailChoices(): { label: string; hint: string }[] {
  return [
    { label: '방향 수정(피벗)', hint: '진척도 30%로, 완성도 소폭↓' },
    { label: '하이퍼파라미터 지옥', hint: '체력·스트레스 대가, 그대로 진행' },
    { label: '네거티브 결과로 워크숍 원고화', hint: '바로 투고 가능, 완성도 낮음' },
    { label: '포기하고 카드 폐기', hint: '스트레스↓' },
  ];
}

export function resolveExperimentFail(state: GameState, paperId: string, choice: number): void {
  const p = state.papers.find((x) => x.id === paperId);
  if (!p) return;
  switch (choice) {
    case 0:
      p.progress = 30;
      p.checkpoints = 0;
      p.quality -= 2;
      applyEffects(state, { stress: 4 });
      log(state, `「${p.title}」 방향을 틀었다. 다시 실험 설계부터.`, 'info');
      break;
    case 1:
      p.quality += 1;
      applyEffects(state, { stress: 7, stamina: -7 });
      log(state, `「${p.title}」 learning rate 1e-4... 3e-5... 결국 뭔가 나왔다.`, 'info');
      break;
    case 2:
      p.stage = 'ready';
      p.progress = 100;
      p.quality = Math.min(Math.round(p.quality), 42);
      applyEffects(state, { stress: 2 });
      log(state, `「${p.title}」 네거티브 결과를 정리해 워크숍 원고로 만들었다.`, 'info');
      break;
    default:
      p.stage = 'abandoned';
      applyEffects(state, { stress: -6 });
      log(state, `「${p.title}」를 내려놓았다. 때로는 포기도 전략이다.`, 'bad');
  }
}
