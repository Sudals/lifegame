/** 연출: 게임 상태 → 장면/화자/표정 */
import type { ContentPack } from '@grad-sim/content';
import { activePapers, getLab, inSemester, upcomingDeadlines, type GameState, type InboxItem, type LogEntry, type WeeklyPlan } from '@grad-sim/engine';
import { isCharacter, professorSprite, type CharacterId, type Expression, type SceneId } from './assets';

export function labScene(pack: ContentPack, g: GameState, plan?: WeeklyPlan): SceneId {
  const crunch = (plan?.sleepPerDay ?? 7) < 6 || (upcomingDeadlines(pack, g, 1).length > 0 && activePapers(g).some((p) => p.stage === 'writing'));
  if (g.stats.stress >= 75 || crunch) return 'lab-night';
  if (!inSemester(g.week)) return 'lab-dusk';
  return 'lab-day';
}

/** 주 단위 날씨 (결정적): 장마철·가을비 */
export function isRainy(g: GameState): boolean {
  const month = ((g.startMonth - 1 + Math.floor(g.week / 4)) % 12) + 1;
  const wet = month === 7 || month === 8 ? 2 : 5;
  return (g.week * 7 + g.seed.length) % wet === 0;
}

export function playerMood(g: GameState, line?: LogEntry): Expression {
  if (line?.tone === 'good') return 'happy';
  if (line?.tone === 'bad') return g.stats.stress >= 70 ? 'frustrated' : 'flustered';
  if (g.stats.stress >= 90) return 'frustrated';
  if (g.stats.stamina < 30 || g.hidden.sleepDebt > 20) return 'tired';
  if (g.stats.stress >= 70) return 'flustered';
  if (g.stats.stress < 25) return 'happy';
  return 'normal';
}

export interface Direction {
  scene: SceneId;
  speaker: CharacterId;
  name: string;
  mood: Expression;
  /** 화자 옆에 나도 서 있는가 */
  withPlayer: boolean;
}

export function inboxDirection(pack: ContentPack, g: GameState, item: InboxItem): Direction {
  const lab = getLab(pack, g.labId);
  const prof = professorSprite(g.labId);
  const me = { speaker: 'player' as CharacterId, name: g.player.name, withPlayer: false };
  switch (item.kind) {
    case 'event': {
      const e = pack.events.find((x) => x.id === item.eventId)!;
      const scene = (e.scene as SceneId | undefined) ?? labScene(pack, g);
      const mood = (e.mood as Expression | undefined) ?? 'normal';
      if (e.speaker === '교수') return { scene, speaker: prof, name: lab?.professor ?? '교수님', mood, withPlayer: true };
      if (e.speaker === '선배') return { scene, speaker: 'senior', name: '선배', mood, withPlayer: true };
      if (e.id === 'reviewer-invite') return { scene, speaker: 'reviewer', name: '리뷰어 2', mood, withPlayer: true };
      return { scene, mood, ...me };
    }
    case 'rebuttal':
      return { scene: 'lab-night', speaker: 'reviewer', name: 'Reviewer 2', mood: 'angry', withPlayer: true };
    case 'experiment-fail':
      return { scene: 'lab-night', mood: 'frustrated', ...me };
    case 'counseling':
    case 'leave':
      return { scene: 'counseling', speaker: 'counselor', name: '상담 선생님', mood: 'happy', withPlayer: true };
    case 'notice':
      return item.title.includes('쓰러') ? { scene: 'counseling', mood: 'tired', ...me } : { scene: 'office', speaker: prof, name: lab?.professor ?? '교수님', mood: 'normal', withPlayer: true };
  }
}

export function speakerOrPlayer(id: string): CharacterId {
  return isCharacter(id) ? id : 'player';
}
