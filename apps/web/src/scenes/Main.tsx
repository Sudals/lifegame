import { useEffect, useMemo, useState } from 'react';
import { getLab, weeklyMonologue, type GameState } from '@grad-sim/engine';
import { Character } from '../art/Character';
import { isRainy, labScene, playerMood } from '../art/direction';
import { Sprite } from '../art/Sprite';
import { DialogueBox, Stage } from '../art/Stage';
import { Typewriter } from '../art/Typewriter';
import { Panel } from '../components/ui';
import { pack, useGame } from '../store/gameStore';
import { Calendar } from './parts/Calendar';
import { Hud } from './parts/Hud';
import { InboxModal } from './parts/InboxModal';
import { LogFeed } from './parts/LogFeed';
import { Planner } from './parts/Planner';
import { ResearchBoard } from './parts/ResearchBoard';

type Tab = 'research' | 'calendar' | 'log';

/** 연구실 무대: 지난 한 주의 일을 대사로 넘겨본다 */
function LabStage({ game }: { game: GameState }) {
  const plan = useGame((s) => s.plan);
  const lines = useMemo(() => {
    const week = game.log.filter((l) => l.week === game.week - 1 || (game.week === 0 && l.week === 0));
    // 아무 일 없던 주: 지난 로그(예: 월급)를 반복하지 말고 그 주 상황에 맞는 혼잣말
    return week.length ? week : [{ week: game.week, ...weeklyMonologue(pack, game) }];
  }, [game]);
  const [idx, setIdx] = useState(0);
  const [typing, setTyping] = useState(false);
  useEffect(() => setIdx(0), [game.week, lines.length]);
  const line = lines[Math.min(idx, lines.length - 1)];
  const lab = getLab(pack, game.labId);
  const mood = playerMood(game, line);
  const tired = game.stats.stamina < 30 || plan.sleepPerDay < 5;

  return (
    <Stage sceneId={labScene(pack, game, plan)} rain={isRainy(game)} vignette={game.stats.stress >= pack.balance.burnoutStress}>
      <span className="stage-title">{lab?.name}</span>
      <Character id="player" expr={mood} talking={typing} x={320} />
      {tired && !typing && <Sprite id="fx-zzz" fps={3} className="abs" style={{ left: 352, top: 150 }} />}
      <DialogueBox name={game.player.name} onClick={() => !typing && setIdx((i) => Math.min(lines.length - 1, i + 1))}>
        <Typewriter text={line?.text ?? '…'} onTyping={setTyping} showCursor={idx < lines.length - 1} />
        {lines.length > 1 && (
          <span className="stage-page">
            {idx + 1}/{lines.length}
          </span>
        )}
      </DialogueBox>
    </Stage>
  );
}

export function Main({ game }: { game: GameState }) {
  const [tab, setTab] = useState<Tab>('research');
  return (
    <div className="game-screen">
      <Hud game={game} />
      <div className="game-body">
        <Planner game={game} />
        <div className="center-col">
          <LabStage game={game} />
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
