import { useState } from 'react';
import { describeInbox, resolveInbox, type GameState, type InboxItem } from '@grad-sim/engine';
import { Character } from '../../art/Character';
import { inboxDirection, type Direction } from '../../art/direction';
import { useFx } from '../../art/fx';
import { DialogueBox, Stage } from '../../art/Stage';
import { Typewriter } from '../../art/Typewriter';
import { pack, useGame } from '../../store/gameStore';

interface Afterword {
  text: string;
  tone?: 'good' | 'bad' | 'info';
  dir: Direction;
  title: string;
}

/** 이벤트·리버탈·실험 실패 등을 비주얼노벨 컷신으로. 선택 후 결과 대사를 한 번 보여준다. */
function Cutscene({ game, item, rest, onAfter }: { game: GameState; item: InboxItem; rest: number; onAfter: (a: Afterword) => void }) {
  const { run } = useGame();
  const [typing, setTyping] = useState(true);
  const [ready, setReady] = useState(false);
  const view = describeInbox(pack, game, item);
  const dir = inboxDirection(pack, game, item);
  const soloPlayer = dir.speaker === 'player';
  const playerExpr = item.kind === 'event' && !soloPlayer ? (dir.mood === 'angry' ? 'flustered' : dir.mood === 'happy' ? 'happy' : 'normal') : dir.mood;

  const choose = (i: number) => {
    const before = game.log.length;
    if (!run((g) => resolveInbox(pack, g, i))) return;
    const after = useGame.getState().game!;
    const line = after.log.length > before ? after.log.at(-1) : undefined;
    if (line && (item.kind === 'event' || item.kind === 'experiment-fail' || item.kind === 'rebuttal')) {
      useFx.getState().play(line.tone === 'bad' ? 'shake' : 'sparkle', { x: soloPlayer ? 200 : 250, y: 160 });
      onAfter({ text: line.text.replace(/^\[[^\]]*\]\s*/, ''), tone: line.tone, dir, title: view.title });
    }
  };

  return (
    <Stage sceneId={dir.scene}>
      <span className="stage-title">{view.title}</span>
      {dir.withPlayer && <Character id="player" expr={playerExpr} x={110} dim={typing} enter="left" />}
      <Character id={dir.speaker} expr={dir.mood} talking={typing} x={soloPlayer ? 200 : 250} enter={soloPlayer ? 'up' : 'right'} />
      <DialogueBox name={soloPlayer ? game.player.name : dir.name}>
        <Typewriter text={view.text} onTyping={setTyping} onDone={() => setReady(true)} />
        {rest > 0 && <span className="stage-page">+{rest}</span>}
      </DialogueBox>
      {ready && (
        <div className={`stage-choices ${view.choices.length > 4 ? 'many' : ''}`}>
          {view.choices.map((c, i) => (
            <button key={c.label} className="stage-choice" disabled={c.disabled} title={c.hint} style={{ animationDelay: `${i * 0.06}s` }} onClick={() => choose(i)}>
              ▸ {c.label}
              {c.hint && <small>{c.hint}</small>}
            </button>
          ))}
        </div>
      )}
    </Stage>
  );
}

/** 선택 결과: 같은 무대에서 주인공이 한마디 하고 닫힌다 */
function AfterwordScene({ a, game, onClose }: { a: Afterword; game: GameState; onClose: () => void }) {
  const [typing, setTyping] = useState(true);
  const mood = a.tone === 'good' ? 'happy' : a.tone === 'bad' ? 'frustrated' : 'normal';
  return (
    <Stage sceneId={a.dir.scene} onClick={() => !typing && onClose()}>
      <span className="stage-title">{a.title}</span>
      <Character id="player" expr={mood} talking={typing} x={a.dir.withPlayer ? 110 : 200} enter="none" />
      {a.dir.withPlayer && <Character id={a.dir.speaker} expr={a.dir.mood} x={250} enter="none" dim />}
      <DialogueBox name={game.player.name}>
        <Typewriter text={a.text} onTyping={setTyping} />
      </DialogueBox>
      {!typing && (
        <div className="stage-choices">
          <button className="stage-choice" onClick={onClose}>
            ▸ 계속
          </button>
        </div>
      )}
    </Stage>
  );
}

export function InboxModal({ game }: { game: GameState }) {
  const [after, setAfter] = useState<Afterword | null>(null);
  const item = game.inbox[0];
  if (!item && !after) return null;
  // 항목이 바뀌면 타자기·선택지 상태 초기화
  const key = item ? `${game.week}-${game.inbox.length}-${item.kind}-${'eventId' in item ? item.eventId : 'paperId' in item ? item.paperId : ''}` : 'after';
  return (
    <div className="cutscene-backdrop" role="dialog" aria-modal>
      <div className="cutscene">
        {after ? (
          <AfterwordScene key={`a-${game.log.length}`} a={after} game={game} onClose={() => setAfter(null)} />
        ) : (
          item && <Cutscene key={key} game={game} item={item} rest={game.inbox.length - 1} onAfter={setAfter} />
        )}
      </div>
    </div>
  );
}
