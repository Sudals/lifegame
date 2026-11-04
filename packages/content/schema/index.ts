import { z } from 'zod';

const stars = z.number().int().min(1).max(5);
export const GpuGrade = z.enum(['A', 'B', 'C', 'D']);
export type GpuGrade = z.infer<typeof GpuGrade>;

/** 스탯/보조수치 증감 묶음 (이벤트·아이디어 경로 비용 등에서 공용) */
export const Effects = z
  .object({
    research: z.number(),
    stress: z.number(),
    stamina: z.number(),
    money: z.number(),
    luck: z.number(),
    trust: z.number(),
    relation: z.number(),
    network: z.number(),
  })
  .partial();
export type Effects = z.infer<typeof Effects>;

export const Lab = z.object({
  id: z.string(),
  name: z.string(),
  professor: z.string(),
  fields: z.array(z.string()).min(1),
  salary: z.number().int().nonnegative(), // 월 인건비(원)
  track: stars, // 연구실적
  potential: stars.optional(), // 신임 교수 등 잠재력
  humanity: stars, // 인간성 (높을수록 좋음)
  chores: stars, // 잡무 빈도
  projectLoad: stars, // 과제량
  gpu: GpuGrade,
  style: z.enum(['handsoff', 'micro', 'collab']),
  industry: stars, // 산학/네트워크
  admissionCut: z.number().min(0).max(100),
  tuitionCover: z.number().min(0).max(1).default(1), // 등록금 장학 비율
  description: z.string(),
  rumors: z.array(z.string()).min(1),
});
export type Lab = z.infer<typeof Lab>;

export const Venue = z.object({
  id: z.string(),
  displayName: z.string(),
  tier: z.enum(['A+', 'A', 'B', 'C', 'domestic']),
  deadline: z.object({ month: z.number().int().min(1).max(12), week: z.number().int().min(1).max(4) }),
  notifyAfterWeeks: z.number().int().positive(),
  heldMonth: z.number().int().min(1).max(12),
  cut: z.number(),
  fields: z.array(z.string()), // 비어 있으면 일반 분야
  rebuttal: z.boolean(),
  years: z.enum(['all', 'odd', 'even']).default('all'),
  fee: z.number().int().nonnegative(),
  abroad: z.boolean(),
});
export type Venue = z.infer<typeof Venue>;

export const Journal = z.object({
  id: z.string(),
  displayName: z.string(),
  tier: z.enum(['S', 'A', 'B', 'C', 'domestic']),
  reviewMonths: z.tuple([z.number().positive(), z.number().positive()]),
  cut: z.number(),
  fields: z.array(z.string()),
  apc: z.number().int().nonnegative(),
});
export type Journal = z.infer<typeof Journal>;

export const Topic = z.object({
  id: z.string(),
  title: z.string(),
  field: z.string(),
  type: z.enum(['method', 'analysis', 'dataset', 'application', 'theory', 'survey']),
  novelty: stars,
  difficulty: stars,
  gpu: GpuGrade,
  trend: stars,
  competition: stars,
  weeks: z.number().int().positive(),
});
export type Topic = z.infer<typeof Topic>;

export const IdeaSource = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  cost: Effects,
  draw: z.number().int().min(1).max(5),
  noveltyBias: z.number(), // +면 참신한 카드 가중
  trendBias: z.number(), // +면 트렌디한 카드 가중
  qualityBonus: z.number(),
  requiresConference: z.boolean().default(false),
  coAuthor: z.boolean().default(false), // 선배 공저 → 2저자
});
export type IdeaSource = z.infer<typeof IdeaSource>;

/** 상태 플래그: 조교·연애·대출 등 — 켜져 있는 동안 매달 수입/지출, 매주 시간·효과 */
export const FlagDef = z.object({
  id: z.string(),
  name: z.string(),
  monthly: z.number().int().default(0), // +수입 / -지출 (원/월)
  weeklyHours: z.number().default(0), // 주당 고정 시간
  weekly: Effects.default({}), // 매주 효과
  efficiency: z.number().positive().default(1), // 연구 효율 배수
  hidden: z.boolean().default(false),
});
export type FlagDef = z.infer<typeof FlagDef>;

const FlagSet = z.object({ id: z.string(), weeks: z.number().int().positive().optional() });
const Schedule = z.object({ eventId: z.string(), weeks: z.number().int().positive() });

export const Outcome = z.object({
  p: z.number().positive().default(1), // 가중치
  luck: z.boolean().default(false), // true면 운이 높을수록 이 결과 확률↑
  effects: Effects.default({}),
  result: z.string(),
  setFlags: z.array(FlagSet).default([]),
  clearFlags: z.array(z.string()).default([]),
  schedule: Schedule.optional(),
});
export type Outcome = z.infer<typeof Outcome>;

export const EventChoice = z.object({
  label: z.string(),
  hint: z.string().optional(),
  requireMoney: z.number().int().positive().optional(), // 잔고가 부족하면 선택 불가
  effects: Effects.default({}),
  result: z.string().default(''),
  setFlags: z.array(FlagSet).default([]),
  clearFlags: z.array(z.string()).default([]),
  schedule: Schedule.optional(), // 후속 이벤트 예약 (분기)
  outcomes: z.array(Outcome).default([]), // 있으면 확률적으로 하나 선택
  addPaper: z
    .object({ title: z.string(), field: z.string(), stage: z.enum(['experiment', 'writing']), quality: z.number(), authorOrder: z.union([z.literal(1), z.literal(2), z.literal(3)]) })
    .optional(),
});
export type EventChoice = z.infer<typeof EventChoice>;

export const GameEvent = z.object({
  id: z.string(),
  title: z.string(),
  speaker: z.string().optional(),
  text: z.string(),
  /** 같은 이벤트의 다른 멘트 — {prof} {lab} {name} {venue} {rival} {senior} {month} {season} {paper} {dday} {money} 치환 */
  variants: z.array(z.string()).default([]),
  weight: z.number().positive(),
  once: z.boolean().default(false),
  random: z.boolean().default(true), // false = 예약(후속)으로만 등장
  /** 연출: 배경 장면 id와 화자 표정 (apps/web/src/art/manifest.json) */
  scene: z.string().optional(),
  mood: z.enum(['normal', 'happy', 'tired', 'frustrated', 'flustered', 'angry']).optional(),
  when: z
    .object({
      months: z.array(z.number().int().min(1).max(12)),
      minStress: z.number(),
      maxStress: z.number(),
      maxStamina: z.number(),
      minMoney: z.number(),
      maxMoney: z.number(),
      minWeek: z.number().int(),
      labIds: z.array(z.string()),
      minHumanity: z.number(),
      maxHumanity: z.number(),
      hasPaperStage: z.string(),
      minResearch: z.number(),
      maxResearch: z.number(),
      minTrust: z.number(),
      maxTrust: z.number(),
      minAccepted: z.number().int(),
      flags: z.array(z.string()), // 모두 켜져 있어야
      notFlags: z.array(z.string()), // 하나도 켜져 있으면 안 됨
      semester: z.boolean(), // true=학기 중, false=방학
    })
    .partial()
    .default({}),
  choices: z.array(EventChoice).min(1),
});
export type GameEvent = z.infer<typeof GameEvent>;

export const Career = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  score: z.number().int(),
  hidden: z.boolean().default(false),
  req: z
    .object({
      minPaperScore: z.number(),
      minTopTier: z.number().int(),
      minResearch: z.number(),
      minNetwork: z.number(),
      minTrust: z.number(),
      minIndustryLab: z.number(),
      maxStress: z.number(),
      minMoney: z.number(),
    })
    .partial(),
});
export type Career = z.infer<typeof Career>;

export const Balance = z.object({
  weeksPerMonth: z.literal(4),
  masterSemesters: z.number().int(),
  requiredCredits: z.number().int(),
  creditsPerSemester: z.number().int(),
  classHoursPerWeek: z.number(),
  livingHoursPerWeek: z.number(),
  baseChoreHoursPerStar: z.number(),
  projectHoursPerStar: z.number(),
  projectStipendPerStar: z.number(),
  livingCostPerMonth: z.number(),
  startMoney: z.number(),
  counselingCost: z.number(),
  counselingHours: z.number(),
  counselingStressRelief: z.number(),
  stressPerWeek: z.number(),
  stressDeadline: z.number(),
  stressPerChoreHour: z.number(),
  stressPerMissingHumanity: z.number(),
  stressReliefPerRestHour: z.number(),
  stressPerSleepDeficitHour: z.number(),
  stressReliefPerSleepHourOver6: z.number(),
  staminaPerSleepHourOver6: z.number(),
  staminaPerRestHour: z.number(),
  overworkThreshold: z.number(),
  staminaPerOverworkHour: z.number(),
  researchPerStudyHour: z.number(),
  researchPerResearchHour: z.number(),
  labMeetingPerTrackStar: z.number(),
  progressPerHour: z.number(),
  writingQualityBase: z.number(), // 작성 단계 전체에 걸쳐 얻는 완성도 (진척 비례)
  writingQualityPerResearch: z.number(),
  eventChancePerWeek: z.number(),
  burnoutStress: z.number(),
  counselingAlertStress: z.number(),
  counselingAlertWeeks: z.number().int(),
  dropoutStressWeeks: z.number().int(),
  tierScore: z.record(z.string(), z.number()),
  authorWeight: z.record(z.string(), z.number()),
  topicCandidates: z.number().int(),
  dualTaskResearch: z.number(), // 이 연구력 이상이면 두 작업 동시 진행
  multitaskEfficiency: z.number(),
  livingMin: z.number(),
  livingMax: z.number(),
  skipMealStamina: z.number(), // 생활시간(식사·이동)을 줄인 1시간당
  skipMealStress: z.number(),
  projectRatioMin: z.number(),
  projectRatioMax: z.number(),
  projectTrustPenalty: z.number(), // 과제 100% 대비 덜 했을 때 주당 신뢰 감소(비율 1당)
  projectTrustBonus: z.number(),
  choreRelationPenalty: z.number(),
  tuitionPerSemester: z.number(),
  thesisFee: z.number(),
  acceptIncentivePerTrack: z.number(),
});
export type Balance = z.infer<typeof Balance>;

export const ContentPack = z.object({
  major: z.string(),
  labs: z.array(Lab),
  venues: z.array(Venue),
  journals: z.array(Journal),
  topics: z.array(Topic),
  ideaSources: z.array(IdeaSource),
  events: z.array(GameEvent),
  careers: z.array(Career),
  flags: z.array(FlagDef),
  balance: Balance,
});
export type ContentPack = z.infer<typeof ContentPack>;

/** 참조 무결성 검사: 존재하지 않는 id 참조 등 */
export function checkIntegrity(pack: ContentPack): string[] {
  const errors: string[] = [];
  const dup = (kind: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`${kind}: 중복 id "${id}"`);
      seen.add(id);
    }
  };
  dup('labs', pack.labs.map((l) => l.id));
  dup('venues', pack.venues.map((v) => v.id));
  dup('journals', pack.journals.map((j) => j.id));
  dup('topics', pack.topics.map((t) => t.id));
  dup('ideaSources', pack.ideaSources.map((s) => s.id));
  dup('events', pack.events.map((e) => e.id));
  dup('careers', pack.careers.map((c) => c.id));

  const labIds = new Set(pack.labs.map((l) => l.id));
  const fields = new Set(pack.topics.map((t) => t.field));
  for (const e of pack.events) {
    for (const id of e.when.labIds ?? []) if (!labIds.has(id)) errors.push(`event ${e.id}: 없는 labId "${id}"`);
  }
  for (const l of pack.labs) {
    for (const f of l.fields) if (!fields.has(f)) errors.push(`lab ${l.id}: 주제 카드가 없는 분야 "${f}"`);
  }
  dup('flags', pack.flags.map((f) => f.id));
  const flagIds = new Set(pack.flags.map((f) => f.id));
  const eventIds = new Set(pack.events.map((e) => e.id));
  for (const e of pack.events) {
    const refs = [...(e.when.flags ?? []), ...(e.when.notFlags ?? [])];
    for (const ch of e.choices) {
      refs.push(...ch.setFlags.map((f) => f.id), ...ch.clearFlags);
      if (ch.schedule && !eventIds.has(ch.schedule.eventId)) errors.push(`event ${e.id}: 없는 후속 이벤트 "${ch.schedule.eventId}"`);
      for (const o of ch.outcomes) {
        refs.push(...o.setFlags.map((f) => f.id), ...o.clearFlags);
        if (o.schedule && !eventIds.has(o.schedule.eventId)) errors.push(`event ${e.id}: 없는 후속 이벤트 "${o.schedule.eventId}"`);
      }
    }
    for (const f of refs) if (!flagIds.has(f)) errors.push(`event ${e.id}: 없는 플래그 "${f}"`);
  }
  for (const v of [...pack.venues, ...pack.journals]) {
    for (const f of v.fields) if (!fields.has(f)) errors.push(`${v.id}: 주제 카드가 없는 분야 "${f}"`);
  }
  return errors;
}
