import { useState } from 'react';
import { getLab, mentalState, type GameState } from '@grad-sim/engine';
import { PixelSprite } from '../components/PixelSprite';
import { Panel } from '../components/ui';
import { pack } from '../store/gameStore';
import { Calendar } from './parts/Calendar';
import { Hud } from './parts/Hud';
import { InboxModal } from './parts/InboxModal';
import { LogFeed } from './parts/LogFeed';
import { Planner } from './parts/Planner';
import { ResearchBoard } from './parts/ResearchBoard';

type Tab = 'research' | 'calendar' | 'log';

export function Main({ game }: { game: GameState }) {
  const [tab, setTab] = useState<Tab>('research');
  const lab = getLab(pack, game.labId);
  const mental = mentalState(pack, game);
  const mood = mental === '번아웃' ? 'tired' : mental === '피로' ? 'tired' : game.stats.stress < 30 ? 'happy' : 'normal';
  const latest = game.log.at(-1);

  return (
    <div className="game-screen">
      <Hud game={game} />
      <div className="game-body">
        <Planner game={game} />
        <div className="center-col">
          <div className={`scene-bg ${mental === '번아웃' ? 'night' : ''}`}>
            <div className="scene-label">{lab?.name} · 연구실</div>
            <div className="scene-chars">
              <PixelSprite kind="player" mood={mood} size={128} />
            </div>
            <div className="dialogue-box">
              <span className="nameplate">{game.player.name}</span>
              <p>{latest?.text ?? '...'}</p>
            </div>
          </div>
          <Panel className="tabs-panel">
            <nav className="tabs">
              {(
                [
                  ['research', '연구 보드'],
                  ['calendar', '학회 달력 · 졸업'],
                  ['log', '일지'],
                ] as const
              ).map(([id, label]) => (
                <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
                  {label}
                </button>
              ))}
            </nav>
            {tab === 'research' && <ResearchBoard game={game} />}
            {tab === 'calendar' && <Calendar game={game} />}
            {tab === 'log' && <LogFeed log={game.log} limit={60} />}
          </Panel>
        </div>
      </div>
      <InboxModal game={game} />
    </div>
  );
}
