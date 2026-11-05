import { useEffect, useMemo, useRef, useState } from 'react';
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
import { ActivityBoard } from './parts/ActivityBoard';
import { Planner } from './parts/Planner';
import { ResearchBoard } from './parts/ResearchBoard';
import { ShopBoard } from './parts/ShopBoard';

/** 연구실 무대: 지난 한 주의 일을 대사로 넘겨본다 */
function LabStage({ game }: { game: GameState }) {
  const plan = useGame((s) => s.plan);
  const lines = useMemo(() => {
    // 지난 진행(또는 입학) 이후에 생긴 로그만 — 컨택 기간·지난주 로그를 다시 틀지 않는다
    const fresh = game.log.slice(game.logMark ?? game.log.length);
    // 아무 일 없던 주: 그 주 상황에 맞는 혼잣말
    return fresh.length ? fresh : [{ week: game.week, ...weeklyMonologue(pack, game) }];
  }, [game]);
  const [idx, setIdx] = useState(0);
  const [typing, setTyping] = useState(false);
  const seen = useRef({ week: game.week, count: lines.length });
  useEffect(() => {
    // 새 주: 처음부터 / 같은 주에 구매·대출 등으로 대사가 늘면 새 대사로
    if (seen.current.week !== game.week) setIdx(0);
    else if (lines.length > seen.current.count) setIdx(lines.length - 1);
    seen.current = { week: game.week, count: lines.length };
  }, [game.week, lines.length]);
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
  const { tab, setTab } = useGame();
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
                  ['activity', '활동'],
                  ['shop', '상점 · 은행'],
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
            {tab === 'activity' && <ActivityBoard game={game} />}
            {tab === 'shop' && <ShopBoard game={game} />}
            {tab === 'calendar' && <Calendar game={game} />}
            {tab === 'log' && <LogFeed log={game.log} limit={60} />}
          </Panel>
        </div>
      </div>
      <InboxModal game={game} />
    </div>
  );
}
