import { useEffect, useState } from 'react';
import {
  careerOffers,
  chooseCareer,
  computeLanding,
  findVenue,
  getLab,
  paperScore,
  type GameState,
} from '@grad-sim/engine';
import { professorSprite } from '../art/assets';
import { Character } from '../art/Character';
import { useFx } from '../art/fx';
import { DialogueBox, Stage } from '../art/Stage';
import { Typewriter } from '../art/Typewriter';
import { Icon } from '../art/Sprite';
import { Panel, won } from '../components/ui';
import { submitRun } from '../net/api';
import { pack, useGame } from '../store/gameStore';

export function Career({ game }: { game: GameState }) {
  const { run } = useGame();
  const offers = careerOffers(pack, game);
  const locked = pack.careers.filter((c) => !c.hidden && !offers.includes(c));
  const lab = getLab(pack, game.labId);
  useEffect(() => {
    useFx.getState().play('pass');
    useFx.getState().play('firework', { delay: 600 });
  }, []);
  return (
    <div className="center-screen">
      <Panel title="🎓 학위 수여 — 진로 선택" className="form-panel">
        <Stage sceneId="office">
          <Character id="player" expr="happy" x={170} enter="left" />
          <Character id={professorSprite(game.labId)} expr="happy" x={330} talking enter="right" />
          <DialogueBox name={lab?.professor}>
            <Typewriter text={`"수고 많았어요, ${game.player.name}씨. 심사위원 전원 통과입니다. 이제 어디로 갈 건가요?"`} showCursor={false} />
          </DialogueBox>
        </Stage>
        <div className="choice-grid">
          {offers.map((c) => (
            <button key={c.id} className="card-btn" onClick={() => run((g) => chooseCareer(pack, g, c.id))}>
              <strong>
                {c.hidden ? '✨ ' : ''}
                {c.name}
              </strong>
              <small>{c.description}</small>
              <small className="dim">진로 점수 +{c.score}</small>
              <small className="info">적응 전망: {computeLanding(pack, game, c).label}</small>
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

/** 진로별 1년 후 장면 */
function landingScene(careerId: string | null): 'lab-day' | 'office' | 'cafe' | 'conference' | 'classroom' {
  switch (careerId) {
    case 'phd':
      return 'lab-day';
    case 'research-scientist':
      return 'conference';
    case 'outside':
      return 'cafe';
    case 'institute':
      return 'classroom';
    default:
      return 'office';
  }
}

export function Ending({ game }: { game: GameState }) {
  const { go, notify } = useGame();
  const [nickname, setNickname] = useState(game.player.name);
  const [submitted, setSubmitted] = useState(false);
  const e = game.ending!;
  const lab = getLab(pack, game.labId);
  const accepted = game.papers.filter((p) => p.kind === 'paper' && p.stage === 'accepted');

  const graduated = !!e.careerId;
  const assets = e.assets ?? { money: game.stats.money, debt: game.debt ?? 0, net: game.stats.money - (game.debt ?? 0) };
  const lines = graduated
    ? [`「${e.epithet}」 — ${e.title}. 길고 긴 대학원 생활이 끝났다.`, ...(e.landing ? [`1년 후... ${e.landing.story}`] : [])]
    : ['새벽 편의점. 삼각김밥을 들고 생각했다. 다시 시작하면 되지.'];
  const [li, setLi] = useState(0);
  const [typing, setTyping] = useState(true);
  useEffect(() => {
    if (graduated) {
      useFx.getState().play('firework');
      useFx.getState().play('firework', { delay: 2400 });
    }
  }, [graduated]);

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
        <Stage sceneId={graduated ? (li === 0 ? 'conference' : landingScene(e.careerId)) : 'store'}>
          <Character id="player" expr={!graduated ? 'tired' : li > 0 && e.landing && e.landing.tier >= 3 ? 'tired' : 'happy'} x={320} talking={typing} />
          <DialogueBox name={game.player.name} onClick={() => !typing && setLi((i) => Math.min(lines.length - 1, i + 1))}>
            <Typewriter key={li} text={lines[li]!} onTyping={setTyping} showCursor={li < lines.length - 1} />
            {lines.length > 1 && (
              <span className="stage-page">
                {li + 1}/{lines.length}
              </span>
            )}
          </DialogueBox>
        </Stage>
        <div className="resume-head">
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
          <div className={`grade grade-${e.grade} slam`}>{e.grade}</div>
        </div>
        {e.landing && (
          <section className={`landing tier-${e.landing.tier}`}>
            <h3>
              <Icon name="job" /> 졸업 1년 후 — {e.landing.label}
              <span className="dim small"> (안착도 {e.landing.score}/100)</span>
            </h3>
            <p className="landing-story">{e.landing.story}</p>
            <ul className="landing-notes">
              {e.landing.notes.map((n) => (
                <li key={n.text} className={n.good ? 'good' : 'bad'}>
                  {n.good ? '▲' : '▼'} {n.text}
                </li>
              ))}
            </ul>
          </section>
        )}
        <h3>
          <Icon name="paper" /> Publications
        </h3>
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
        <h3>
          <Icon name="trophy" /> 최종 점수 {e.score}
        </h3>
        <table className="breakdown">
          <tbody>
            {Object.entries(e.breakdown).map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td>{v > 0 ? `+${v}` : v}</td>
              </tr>
            ))}
            <tr className="dim">
              <td>잔고 · 학자금 대출</td>
              <td>
                {won(assets.money)} · {assets.debt > 0 ? `-${won(assets.debt)}` : '대출 없음'}
              </td>
            </tr>
            <tr className="dim">
              <td>순자산</td>
              <td className={assets.net < 0 ? 'bad' : 'good'}>{won(assets.net)}</td>
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
