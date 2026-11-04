import { useState } from 'react';
import {
  careerOffers,
  chooseCareer,
  findVenue,
  getLab,
  paperScore,
  type GameState,
} from '@grad-sim/engine';
import { PixelSprite } from '../components/PixelSprite';
import { Panel, won } from '../components/ui';
import { submitRun } from '../net/api';
import { pack, useGame } from '../store/gameStore';

export function Career({ game }: { game: GameState }) {
  const { run } = useGame();
  const offers = careerOffers(pack, game);
  const locked = pack.careers.filter((c) => !c.hidden && !offers.includes(c));
  return (
    <div className="center-screen">
      <Panel title="🎓 학위 수여 — 진로 선택" className="form-panel">
        <p>심사위원들이 고개를 끄덕였다. 이제 어디로 갈까?</p>
        <div className="choice-grid">
          {offers.map((c) => (
            <button key={c.id} className="card-btn" onClick={() => run((g) => chooseCareer(pack, g, c.id))}>
              <strong>
                {c.hidden ? '✨ ' : ''}
                {c.name}
              </strong>
              <small>{c.description}</small>
              <small className="dim">진로 점수 +{c.score}</small>
            </button>
          ))}
          {locked.map((c) => (
            <div key={c.id} className="card-btn locked">
              <strong>🔒 {c.name}</strong>
              <small className="dim">조건 미달</small>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

export function Ending({ game }: { game: GameState }) {
  const { go, notify } = useGame();
  const [nickname, setNickname] = useState(game.player.name);
  const [submitted, setSubmitted] = useState(false);
  const e = game.ending!;
  const lab = getLab(pack, game.labId);
  const accepted = game.papers.filter((p) => p.kind === 'paper' && p.stage === 'accepted');

  const register = async () => {
    try {
      await submitRun(game, nickname);
      setSubmitted(true);
      notify('명예의 전당에 등록했습니다!');
    } catch (err) {
      notify(`등록 실패: ${err instanceof Error ? err.message : err}`);
    }
  };

  return (
    <div className="center-screen">
      <Panel title="이력서" className="form-panel resume">
        <div className="resume-head">
          <PixelSprite kind="player" mood={e.careerId ? 'happy' : 'tired'} size={112} />
          <div>
            <h2>{game.player.name}</h2>
            <p>
              {lab?.name} 석사{e.careerId ? '' : ' (수료)'} · {Math.ceil(game.week / 48 * 10) / 10}년
            </p>
            <p className="epithet">「{e.epithet}」</p>
            <p>
              진로: <strong>{e.title}</strong>
            </p>
          </div>
          <div className={`grade grade-${e.grade}`}>{e.grade}</div>
        </div>
        <h3>Publications</h3>
        {accepted.length === 0 ? (
          <p className="dim">없음</p>
        ) : (
          <ol className="pubs">
            {accepted.map((p) => (
              <li key={p.id}>
                {p.authorOrder === 1 ? <strong>{game.player.name}</strong> : <>선배, <strong>{game.player.name}</strong></>}, "{p.title}", <em>{findVenue(pack, p.venueId!)?.displayName}</em>
                {p.presentation && p.presentation !== 'journal' && p.presentation !== 'poster' ? ` (${p.presentation})` : ''} — {Math.round(paperScore(pack, p))}점
              </li>
            ))}
          </ol>
        )}
        <h3>최종 점수 {e.score}</h3>
        <table className="breakdown">
          <tbody>
            {Object.entries(e.breakdown).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{v > 0 ? `+${v}` : v}</td>
              </tr>
            ))}
            <tr>
              <td>잔고</td>
              <td>{won(game.stats.money)}</td>
            </tr>
          </tbody>
        </table>
        <div className="row end">
          <input value={nickname} maxLength={20} onChange={(ev) => setNickname(ev.target.value)} aria-label="닉네임" />
          <button className="btn primary" disabled={submitted || !nickname.trim()} onClick={register}>
            {submitted ? '등록 완료' : '명예의 전당 등록'}
          </button>
          <button className="btn" onClick={() => go('ranking')}>
            랭킹 보기
          </button>
          <button className="btn ghost" onClick={() => go('title')}>
            타이틀로
          </button>
        </div>
      </Panel>
    </div>
  );
}
