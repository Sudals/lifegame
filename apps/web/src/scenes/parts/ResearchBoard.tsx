import { useState } from 'react';
import { FIELD_LABELS, TOPIC_TYPE_LABELS } from '@grad-sim/content';
import {
  acceptanceHint,
  canExplore,
  chooseTopic,
  dropIdeas,
  explore,
  findVenue,
  getLab,
  getTopic,
  GPU_RANK,
  submit,
  submitTargets,
  type GameState,
  type Paper,
} from '@grad-sim/engine';
import { Progress, Stars } from '../../components/ui';
import { pack, useGame } from '../../store/gameStore';

const STAGE_LABEL: Record<Paper['stage'], string> = {
  experiment: '🧪 실험',
  writing: '✍ 작성',
  ready: '📮 투고 대기',
  review: '⏳ 심사 중',
  revision: '🔁 리비전',
  accepted: '🏆 채택',
  abandoned: '🗑 폐기',
};

function costText(cost: Record<string, number | undefined>): string {
  const names: Record<string, string> = { stamina: '체력', stress: '스트레스', trust: '신뢰', relation: '관계', research: '연구력', money: '돈' };
  return Object.entries(cost)
    .filter(([, v]) => v)
    .map(([k, v]) => `${names[k] ?? k} ${v! > 0 ? '+' : ''}${v}`)
    .join(', ');
}

function SubmitBox({ game, paper }: { game: GameState; paper: Paper }) {
  const { run } = useGame();
  const targets = submitTargets(pack, game);
  const [venueId, setVenueId] = useState(targets[0]?.venueId ?? '');
  const t = targets.find((x) => x.venueId === venueId);
  const v = t ? findVenue(pack, t.venueId) : null;
  const hint = v ? acceptanceHint(game, paper, v) : null;
  return (
    <div className="submit-box">
      <select value={venueId} onChange={(e) => setVenueId(e.target.value)}>
        {targets.map((x) => {
          const vv = findVenue(pack, x.venueId)!;
          return (
            <option key={x.venueId} value={x.venueId}>
              [{vv.tier}] {vv.displayName} {x.deadlineWeek !== null ? `· 마감 D-${(x.deadlineWeek - game.week) * 7}` : '· 저널(상시)'}
            </option>
          );
        })}
      </select>
      {hint && (
        <small className="dim">
          예상 채택률 {Math.round(hint.low * 100)}~{Math.round(hint.high * 100)}%
          {t?.kind === 'conference' ? ` · 결과 W${t.resultWeek + 1}` : ''}
        </small>
      )}
      <button className="btn small primary" disabled={!venueId} onClick={() => run((g) => submit(pack, g, paper.id, venueId))}>
        투고
      </button>
    </div>
  );
}

export function ResearchBoard({ game }: { game: GameState }) {
  const { run } = useGame();
  const cand = game.ideaCandidates;
  const papers = game.papers.filter((p) => p.stage !== 'abandoned');
  const lab = getLab(pack, game.labId);
  const labGpu = lab ? GPU_RANK[lab.gpu] : 4;

  return (
    <div className="research">
      <section>
        <h3>① 아이디어 탐색 {game.exploredWeek === game.week && <small className="dim">(이번 주 완료)</small>}</h3>
        <div className="idea-sources">
          {pack.ideaSources.map((s) => {
            const err = canExplore(pack, game, s.id);
            return (
              <button key={s.id} className="idea-btn" disabled={!!err} title={err ?? s.description} onClick={() => run((g) => explore(pack, g, s.id))}>
                <strong>{s.name}</strong>
                <small>{costText(s.cost) || '비용 없음'}</small>
              </button>
            );
          })}
        </div>
      </section>

      {cand && (
        <section>
          <h3>② 주제 카드 선택</h3>
          <div className="topic-cards">
            {cand.topicIds.map((id) => {
              const t = getTopic(pack, id);
              return (
                <button key={id} className="topic-card" onClick={() => run((g) => chooseTopic(pack, g, id))}>
                  <span className="tag">
                    {FIELD_LABELS[t.field]} · {TOPIC_TYPE_LABELS[t.type]}
                  </span>
                  <strong>{t.title}</strong>
                  <span>참신성 <Stars n={t.novelty} /></span>
                  <span>난이도 <Stars n={t.difficulty} /></span>
                  <span>트렌드 <Stars n={t.trend} /> 경쟁 <Stars n={t.competition} /></span>
                  <span className="dim">GPU {t.gpu} 이상 · 주 40h 기준 약 {t.weeks}주</span>
                  {labGpu < GPU_RANK[t.gpu] && <span className="warn">⚠ 연구실 GPU({lab?.gpu}) 부족 — 실험 속도 크게↓</span>}
                  {lab?.fields.includes(t.field) && <span className="ok">✓ 연구실 주력 분야</span>}
                </button>
              );
            })}
          </div>
          <button className="btn small ghost" onClick={() => run((g) => dropIdeas(g))}>
            전부 버리기
          </button>
        </section>
      )}

      <section>
        <h3>연구 보드</h3>
        {papers.length === 0 && <p className="dim">진행 중인 연구가 없다. 아이디어부터 찾아보자.</p>}
        <div className="papers">
          {papers.map((p) => {
            const venue = p.venueId ? findVenue(pack, p.venueId) : null;
            return (
              <article key={p.id} className={`paper ${p.stage}`}>
                <header>
                  <span className="stage">{STAGE_LABEL[p.stage]}</span>
                  {p.authorOrder > 1 && <span className="badge info">{p.authorOrder}저자</span>}
                  {p.kind === 'thesis' && <span className="badge good">학위논문</span>}
                </header>
                <strong>{p.title}</strong>
                {(p.stage === 'experiment' || p.stage === 'writing' || p.stage === 'revision') && <Progress value={p.progress} />}
                <small className="dim">
                  완성도 {Math.round(p.quality)}
                  {venue && ` · ${venue.displayName}`}
                  {p.stage === 'review' && p.resultWeek !== undefined && ` · 결과 D-${(p.resultWeek - game.week) * 7}`}
                  {p.stage === 'accepted' && p.presentation && p.presentation !== 'thesis' && ` · ${p.presentation.toUpperCase()}`}
                </small>
                {p.reviews.length > 0 && (
                  <small className="dim">
                    리뷰 이력: {p.reviews.map((r) => `${findVenue(pack, r.venueId)?.displayName ?? r.venueId} ${r.decision}(${r.scores.join('/')})`).join(' → ')}
                  </small>
                )}
                {p.stage === 'ready' && <SubmitBox game={game} paper={p} />}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
