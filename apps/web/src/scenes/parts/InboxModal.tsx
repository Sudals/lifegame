import { describeInbox, resolveInbox, type GameState } from '@grad-sim/engine';
import { PixelSprite, speakerKind } from '../../components/PixelSprite';
import { pack, useGame } from '../../store/gameStore';

export function InboxModal({ game }: { game: GameState }) {
  const { run } = useGame();
  const item = game.inbox[0];
  if (!item) return null;
  const view = describeInbox(pack, game, item);
  const kind = item.kind === 'rebuttal' ? 'reviewer' : item.kind === 'counseling' ? 'counselor' : speakerKind(view.speaker);
  const mood = item.kind === 'experiment-fail' ? 'tired' : view.speaker?.includes('교수') && view.text.includes('비교') ? 'angry' : 'normal';
  return (
    <div className="modal-backdrop" role="dialog" aria-modal>
      <div className="dialogue-modal">
        <div className="dialogue-portrait">
          <PixelSprite kind={item.kind === 'experiment-fail' ? 'player' : kind} mood={mood} size={112} />
          {view.speaker && <span className="nameplate">{view.speaker}</span>}
        </div>
        <div className="dialogue-body">
          <h3>{view.title}</h3>
          <p className="typewriter">{view.text}</p>
          <div className="choices">
            {view.choices.map((c, i) => (
              <button key={c.label} className="choice" onClick={() => run((g) => resolveInbox(pack, g, i))}>
                ▸ {c.label}
                {c.hint && <small>{c.hint}</small>}
              </button>
            ))}
          </div>
          {game.inbox.length > 1 && <small className="dim">대기 중인 일 {game.inbox.length - 1}건 더</small>}
        </div>
      </div>
    </div>
  );
}
