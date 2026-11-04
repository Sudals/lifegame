/** 상황에 따라 바뀌는 멘트: 템플릿 변수 + 주간 독백 */
import type { ContentPack } from '@grad-sim/content';
import { hashString, type Rng } from './rng';
import { activePapers } from './research';
import { getLab } from './stats';
import type { GameState } from './state';
import { dateOf, inSemester, upcomingDeadlines } from './time';

const RIVALS = ['김도윤', '이서연', '박지훈', '최하은', '정민준', '윤지아', '강태오', '한소율'];
const SENIORS = ['민지 선배', '현우 선배', '수아 선배', '재원 선배'];

export function season(month: number): string {
  if (month >= 3 && month <= 5) return '봄';
  if (month >= 6 && month <= 8) return '여름';
  if (month >= 9 && month <= 11) return '가을';
  return '겨울';
}

const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`;

/** 다가오는 주요 학회(A+/A 우선) */
function headlineVenue(pack: ContentPack, state: GameState): { name: string; dday: number } {
  const dl = upcomingDeadlines(pack, state, 20);
  const pick =
    dl.find((d) => {
      const t = pack.venues.find((v) => v.id === d.venueId)?.tier;
      return t === 'A+' || t === 'A';
    }) ?? dl[0];
  if (!pick) return { name: 'NeurIPS', dday: 30 };
  const v = pack.venues.find((x) => x.id === pick.venueId)!;
  return { name: v.displayName.split(' (')[0]!, dday: (pick.week - state.week) * 7 };
}

/** 이벤트 발생 시점의 변수 (인박스에 저장해 다시 그려도 같은 문장) */
export function eventVars(pack: ContentPack, state: GameState, rng: Rng): Record<string, string> {
  const lab = getLab(pack, state.labId);
  const d = dateOf(state, state.week);
  const venue = headlineVenue(pack, state);
  const paper = activePapers(state).find((p) => p.kind === 'paper') ?? state.papers.find((p) => p.kind === 'paper' && p.stage !== 'abandoned');
  // 선배 이름은 회차 내내 고정
  const senior = SENIORS[hashString(state.seed + 'senior') % SENIORS.length]!;
  return {
    name: state.player.name,
    prof: lab?.professor ?? '교수',
    lab: lab?.name ?? '연구실',
    venue: venue.name,
    dday: String(Math.max(1, venue.dday)),
    rival: rng.pick(RIVALS),
    senior,
    month: String(d.month),
    season: season(d.month),
    paper: paper?.title ?? '내 연구',
    money: won(state.stats.money),
  };
}

export function fillTemplate(text: string, vars: Record<string, string> | undefined): string {
  if (!vars) return text.replace(/\{(\w+)\}/g, '');
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
}

/** 아무 일 없던 주의 혼잣말 — 마감·연구·돈·계절·체력에 따라 */
export function weeklyMonologue(pack: ContentPack, state: GameState): { text: string; tone?: 'good' | 'bad' | 'info' } {
  const d = dateOf(state, state.week);
  const venue = headlineVenue(pack, state);
  const active = activePapers(state).filter((p) => p.kind === 'paper');
  const inReview = state.papers.filter((p) => p.stage === 'review');
  const writing = active.find((p) => p.stage === 'writing');
  const exp = active.find((p) => p.stage === 'experiment');
  const thesis = state.papers.find((p) => p.kind === 'thesis' && p.stage === 'writing');
  const s = state.stats;
  const pool: string[] = [];

  if (writing && venue.dday <= 21) pool.push(`${venue.name} 마감 D-${venue.dday}. 「${writing.title}」 원고 커서가 깜빡일 때마다 심장도 같이 뛴다.`, `D-${venue.dday}. Related Work 섹션은 왜 써도 써도 끝이 없을까.`);
  if (writing) pool.push(`「${writing.title}」 작성 ${Math.round(writing.progress)}%. 그림 하나에 반나절을 썼다.`, `Introduction 첫 문장만 열두 번째 고쳐 쓰는 중이다.`);
  if (exp) pool.push(`「${exp.title}」 실험 ${Math.round(exp.progress)}%. GPU 팬 소리가 자장가처럼 들린다.`, `loss 그래프를 30분째 보고 있다. 내려가라... 내려가라...`, `하이퍼파라미터 표가 엑셀 세 시트를 넘어갔다.`);
  if (inReview.length) {
    const p = inReview[0]!;
    const left = Math.max(0, (p.resultWeek ?? state.week) - state.week);
    pool.push(`「${p.title}」 결과 발표까지 ${left}주. 메일함 새로고침 횟수를 세는 건 그만두기로 했다.`);
  }
  if (thesis) pool.push(`학위논문 ${Math.round(thesis.progress)}%. 목차만 보면 벌써 졸업한 기분이다.`);
  if (!active.length && !inReview.length) pool.push('다음 연구 주제를 찾아야 한다. 연구 보드에서 아이디어를 탐색해보자.', '빈 연구 보드를 보니 마음이 허전하다. arXiv를 열어볼까.');
  if (s.money < 500000) pool.push(`통장 잔고 ${won(s.money)}. 이번 주는 학식 3,500원 정식으로 버틴다.`);
  if (s.stress >= 75) pool.push('오늘따라 모니터 글자가 흐릿하다. 상담이나 휴식이 필요할지도.', '아무 이유 없이 한숨이 나온다. 잠깐 산책이라도 할까.');
  if (s.stamina < 35) pool.push('계단 두 층에 숨이 찬다. 잠을 좀 더 자야겠다.');
  if (!inSemester(state.week)) pool.push('방학이라 캠퍼스가 조용하다. 연구하기엔 딱 좋은 때.', '학부생들이 없는 학식당은 줄이 짧아서 좋다.');
  const se = season(d.month);
  if (se === '봄') pool.push('창밖 공기가 따뜻해졌다. 연구실 창문을 조금 열어두었다.');
  if (se === '여름') pool.push('에어컨 온도를 두고 연구실에 보이지 않는 전쟁이 벌어지고 있다.', '매미 소리와 키보드 소리가 섞인다.');
  if (se === '가을') pool.push('은행잎이 떨어진다. 이번 학기도 벌써 반이 지났다.');
  if (se === '겨울') pool.push('손이 시려서 타이핑이 느려진다. 히터 앞자리는 늘 만석이다.');
  pool.push('평범한 한 주였다. 평범한 게 제일 어렵다.', '커피 세 잔, 실험 두 번, 회의 한 번. 그렇게 한 주가 갔다.');

  const text = pool[hashString(`${state.seed}:${state.week}`) % pool.length]!;
  return { text, tone: 'info' };
}
