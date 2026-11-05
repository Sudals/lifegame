import { useMemo, useState } from 'react';
import { FIELD_LABELS } from '@grad-sim/content';
import {
  contactLab,
  contactProbability,
  enroll,
  fallbackLabId,
  followUp,
  followUpProbability,
  hashString,
  interview,
  interviewQuestions,
  MAX_CONTACTS,
  type GameState,
  type MailDraft,
} from '@grad-sim/engine';
import { professorSprite } from '../art/assets';
import { Character } from '../art/Character';
import { useFx } from '../art/fx';
import { DialogueBox, Stage } from '../art/Stage';
import { Typewriter } from '../art/Typewriter';
import { Panel, Stars, won } from '../components/ui';
import { pack, useGame } from '../store/gameStore';
import { LogFeed } from './parts/LogFeed';

const STYLE_LABEL = { handsoff: '방임형', micro: '마이크로매니징', collab: '협업형' } as const;

/** 선택지 표시 순서를 회차·연구실마다 섞는다 (모범 답안이 늘 첫 줄에 있지 않게) */
function shuffled<T>(items: readonly T[], key: string): { item: T; index: number }[] {
  return items.map((item, index) => ({ item, index })).sort((a, b) => hashString(`${key}:${a.index}`) - hashString(`${key}:${b.index}`));
}

/** 처음 보여줄 메일 초안: 각 항목의 무난한 중간 선택지 */
const initialDraft = (): MailDraft => Object.fromEntries(pack.contact.mail.map((p) => [p.id, Math.floor(p.options.length / 2)]));

/** 컨택 무대: 자취방에서 메일 → 교수실 면접 */
function ContactStage({ game, labId }: { game: GameState; labId: string }) {
  const [typing, setTyping] = useState(false);
  const lab = pack.labs.find((l) => l.id === labId)!;
  const record = game.contacts.find((c) => c.labId === labId);
  const interviewing = !!record?.replied && !record.interviewed;
  const admitted = !!record?.admitted;
  const rejected = !!record?.interviewed && !record.admitted;
  const atOffice = interviewing || admitted || rejected;
  const last = game.log.at(-1)?.text ?? '';
  const text = interviewing ? `${lab.professor}: "어서 와요. 앉아요. 몇 가지만 물어볼게요."` : atOffice ? last : record && !record.replied ? last : '어느 연구실에 메일을 보내볼까... 교수님 논문부터 읽어보자.';
  return (
    <Stage sceneId={atOffice ? 'office' : 'home'}>
      {atOffice ? (
        <>
          <Character id="player" expr={admitted ? 'happy' : rejected ? 'frustrated' : 'flustered'} x={150} dim={typing && interviewing} enter="left" />
          <Character id={professorSprite(labId)} expr={admitted ? 'happy' : 'normal'} talking={typing && interviewing} x={330} enter="right" />
        </>
      ) : (
        <Character id="player" expr={record && !record.replied ? 'frustrated' : 'normal'} talking={typing} x={470} />
      )}
      <DialogueBox name={interviewing ? lab.professor : game.player.name}>
        <Typewriter text={text} onTyping={setTyping} showCursor={false} />
      </DialogueBox>
    </Stage>
  );
}

export function Contact() {
  const { game, run } = useGame();
  const [labId, setLabId] = useState(pack.labs[1]!.id);
  const [mail, setMail] = useState<MailDraft>(initialDraft);
  const [answers, setAnswers] = useState<number[]>([-1, -1, -1]);
  const questions = useMemo(() => (game ? interviewQuestions(pack, game, labId) : []), [game?.seed, labId]);
  if (!game) return null;

  const lab = pack.labs.find((l) => l.id === labId)!;
  const record = game.contacts.find((c) => c.labId === labId);
  const left = MAX_CONTACTS - game.contacts.length;
  const fallback = fallbackLabId(pack, game);
  const pReply = contactProbability(pack, game, labId, mail);

  return (
    <div className="contact-screen">
      <Panel title={`연구실 탐색 — 컨택 기회 ${left}/${MAX_CONTACTS}`} className="lab-list">
        {pack.labs.map((l) => {
          const c = game.contacts.find((x) => x.labId === l.id);
          const badge = c ? (c.admitted ? '합격' : c.interviewed ? '불합격' : c.replied ? '면접 대기' : '무응답') : null;
          return (
            <button key={l.id} className={`lab-card ${l.id === labId ? 'selected' : ''}`} onClick={() => setLabId(l.id)}>
              <div className="lab-card-head">
                <strong>{l.name}</strong>
                <span className="dim">{l.professor}</span>
                {badge && <span className={`badge ${c?.admitted ? 'good' : c?.replied && !c.interviewed ? 'info' : 'bad'}`}>{badge}</span>}
              </div>
              <div className="lab-card-stats">
                <span>실적 <Stars n={l.track} /></span>
                <span>인간성 <Stars n={l.humanity} /></span>
                <span>잡무 <Stars n={l.chores} /></span>
                <span>과제 <Stars n={l.projectLoad} /></span>
              </div>
            </button>
          );
        })}
      </Panel>

      <Panel title={lab.name} className="lab-detail" right={<span className="dim">{STYLE_LABEL[lab.style]}</span>}>
        <ContactStage game={game} labId={labId} />
        <div className="lab-hero">
          <div>
            <p>{lab.description}</p>
            <ul className="facts">
              <li>월 인건비 {won(lab.salary)} (+ 과제 수당)</li>
              <li>GPU 등급 {lab.gpu} · 산학 <Stars n={lab.industry} /></li>
              <li>주력 분야: {lab.fields.map((f) => FIELD_LABELS[f] ?? f).join(', ')}</li>
              {lab.potential && <li>교수 잠재력 <Stars n={lab.potential} /></li>}
            </ul>
          </div>
        </div>
        <div className="rumors">
          <h3>선배 소문</h3>
          {lab.rumors.map((r) => (
            <p key={r} className="rumor">
              {r}
            </p>
          ))}
        </div>

        {!record && left > 0 && (
          <div className="mail">
            <h3>✉ 컨택 메일 작성</h3>
            {pack.contact.mail.map((part) => (
              <label key={part.id} className="field">
                <span>{part.label}</span>
                <select value={mail[part.id] ?? 0} onChange={(e) => setMail({ ...mail, [part.id]: Number(e.target.value) })}>
                  {shuffled(part.options, `${game.seed}:${part.id}`).map(({ item: o, index }) => (
                    <option key={o.label} value={index}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <div className="row between">
              <small className="dim">예상 답장 확률 약 {Math.round(pReply * 10) * 10}%</small>
              <button className="btn primary" onClick={() => run((g) => contactLab(pack, g, labId, mail)) && useFx.getState().play('mail', { x: 470, y: 190 })}>
                메일 보내기
              </button>
            </div>
          </div>
        )}

        {record && !record.replied && !record.followedUp && (
          <div className="mail">
            <h3>✉ 리마인드 메일</h3>
            <p className="dim small">메일함에 묻혔을지도 모른다. 정중하게 한 번 더 보내볼까? (연구실당 1회, 컨택 기회는 쓰지 않음)</p>
            <div className="row between">
              <small className="dim">예상 답장 확률 약 {Math.round(followUpProbability(pack, game, labId) * 10) * 10}%</small>
              <button className="btn" onClick={() => run((g) => followUp(pack, g, labId)) && useFx.getState().play('mail', { x: 470, y: 190 })}>
                리마인드 보내기
              </button>
            </div>
          </div>
        )}

        {record?.replied && !record.interviewed && (
          <div className="interview">
            <h3>🎤 면접</h3>
            {questions.map((q, qi) => (
              <fieldset key={q.id} className="field">
                <legend>{q.q}</legend>
                {shuffled(q.options, `${game.seed}:${labId}:${q.id}`).map(({ item: o, index: oi }) => (
                  <label key={o.label} className="radio">
                    <input type="radio" name={`q${qi}`} checked={answers[qi] === oi} onChange={() => setAnswers(answers.map((a, i) => (i === qi ? oi : a)))} />
                    {o.label}
                  </label>
                ))}
              </fieldset>
            ))}
            <button className="btn primary" disabled={answers.includes(-1)} onClick={() => {
                const ok = run((g) => interview(pack, g, labId, answers));
                const r = useGame.getState().game?.contacts.find((c) => c.labId === labId);
                if (ok && r) useFx.getState().play(r.admitted ? 'pass' : 'reject', { x: 150, y: 140 });
              }}>
              면접 마치기
            </button>
          </div>
        )}

        {record?.admitted && (
          <button className="btn primary big" onClick={() => run((g) => enroll(pack, g, labId))}>
            🎓 {lab.name}에 입학하기
          </button>
        )}
      </Panel>

      <div className="contact-side">
        {fallback && (
          <Panel title="추가 모집 공고">
            <p>컨택 기회를 모두 썼지만 합격한 곳이 없다... 그때, 학과 게시판에 추가 모집 공고가 올라왔다.</p>
            <button className="btn primary" onClick={() => run((g) => enroll(pack, g, fallback))}>
              {pack.labs.find((l) => l.id === fallback)!.name}에 지원·입학
            </button>
          </Panel>
        )}
        <Panel title="기록">
          <LogFeed log={game.log} limit={8} />
        </Panel>
      </div>
    </div>
  );
}
