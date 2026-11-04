import { useState } from 'react';
import { describeInbox, resolveInbox, type GameState, type InboxItem } from '@grad-sim/engine';
import { Character } from '../../art/Character';
import { inboxDirection } from '../../art/direction';
import { useFx } from '../../art/fx';
import { DialogueBox, Stage } from '../../art/Stage';
import { Typewriter } from '../../art/Typewriter';
import { pack, useGame } from '../../store/gameStore';

/** 이벤트·리버탈·실험 실패 등을 비주얼노벨 컷신으로 */
function Cutscene({ game, item, rest }: { game: GameState; item: InboxItem; rest: number }) {
  const { run } = useGame();
  const [typing, setTyping] = useState(true);
  const [ready, setReady] = useState(false);
  const view = describeInbox(pack, game, item);
  const dir = inboxDirection(pack, game, item);
  const soloPlayer = dir.speaker === 'player';
  const playerExpr = item.kind === 'event' && !soloPlayer ? (dir.mood === 'angry' ? 'flustered' : dir.mood === 'happy' ? 'happy' : 'normal') : dir.mood;

  const choose = (i: number) => {
    useFx.getState().play('sparkle', { x: soloPlayer ? 200 : 250, y: 160 });
    run((g) => resolveInbox(pack, g, i));
  };

  return (
    <div className="cutscene-backdrop" role="dialog" aria-modal aria-label={view.title}>
      <div className="cutscene">
        <Stage sceneId={dir.scene}>
          <span className="stage-title">{view.title}</span>
          {dir.withPlayer && <Character id="player" expr={playerExpr} x={110} dim={typing} enter="left" />}
          <Character id={dir.speaker} expr={dir.mood} talking={typing} x={soloPlayer ? 200 : 250} enter={soloPlayer ? 'up' : 'right'} />
          <DialogueBox name={soloPlayer ? game.player.name : dir.name}>
            <Typewriter text={view.text} onTyping={setTyping} onDone={() => setReady(true)} />
            {rest > 0 && <span className="stage-page">+{rest}</span>}
          </DialogueBox>
          {ready && (
            <div className="stage-choices">
              {view.choices.map((c, i) => (
                <button key={c.label} className="stage-choice" style={{ animationDelay: `${i * 0.06}s` }} onClick={() => choose(i)}>
                  ▸ {c.label}
                  {c.hint && <small>{c.hint}</small>}
                </button>
              ))}
            </div>
          )}
        </Stage>
      </div>
    </div>
  );
}

export function InboxModal({ game }: { game: GameState }) {
  const item = game.inbox[0];
  if (!item) return null;
  // 항목이 바뀌면 타자기·선택지 상태 초기화
  const key = `${game.week}-${game.inbox.length}-${item.kind}-${'eventId' in item ? item.eventId : 'paperId' in item ? item.paperId : ''}`;
  return <Cutscene key={key} game={game} item={item} rest={game.inbox.length - 1} />;
}
