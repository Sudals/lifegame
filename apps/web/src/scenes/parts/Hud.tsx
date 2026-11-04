import type React from 'react';
import { useState } from 'react';
import { dateOf, formatDate, getLab, inSemester, mentalState, upcomingDeadlines, type GameState } from '@grad-sim/engine';
import { Icon } from '../../art/Sprite';
import type { IconName } from '../../art/assets';
import { StatBar, won } from '../../components/ui';
import { cloudSave } from '../../net/api';
import { pack, useGame } from '../../store/gameStore';

function luckHint(luck: number): string {
  if (luck >= 65) return '요즘 왠지 운이 좋다';
  if (luck <= 35) return '왠지 되는 일이 없다';
  return '평범한 운세';
}

/** 주간 진행 직후 스탯 변화가 위로 떠오른다 */
function Delta({ k }: { k: string }) {
  const d = useGame((st) => st.deltas.find((x) => x.key === k));
  if (!d) return null;
  const up = d.value > 0;
  const good = k === 'stress' ? !up : up;
  const txt = k === 'money' ? `${up ? '+' : ''}${Math.round(d.value / 10000)}만` : `${up ? '+' : ''}${d.value.toFixed(1)}`;
  return (
    <span key={d.at} className={`delta ${good ? 'up' : 'down'}`}>
      {txt}
    </span>
  );
}

function Stat({ icon, k, children }: { icon: IconName; k: string; children: React.ReactNode }) {
  return (
    <div className="stat-wrap">
      <Icon name={icon} />
      {children}
      <Delta k={k} />
    </div>
  );
}

export function Hud({ game }: { game: GameState }) {
  const { slot, notify, go } = useGame();
  const [saving, setSaving] = useState(false);
  const d = dateOf(game, game.week);
  const lab = getLab(pack, game.labId);
  const s = game.stats;
  const deadlines = upcomingDeadlines(pack, game, 16).slice(0, 3);
  const weeksLeft = game.semesterDeadlineWeek - game.week;

  const save = async () => {
    setSaving(true);
    try {
      await cloudSave(slot, game);
      notify(`☁ 슬롯 ${slot}에 클라우드 저장 완료`);
    } catch (e) {
      notify(`클라우드 저장 실패: ${e instanceof Error ? e.message : e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <header className="hud">
      <div className="hud-date">
        <strong>{formatDate(d)}</strong>
        <span className="dim">
          {inSemester(game.week) ? '학기 중' : '방학'} · {lab?.name ?? ''} · 졸업 심사까지 {weeksLeft}주
        </span>
      </div>
      <div className="hud-stats">
        <Stat icon="research" k="research">
          <StatBar label="연구력" value={s.research} tone="var(--c-research)" />
        </Stat>
        <Stat icon="stress" k="stress">
          <StatBar label="스트레스" value={s.stress} tone="var(--c-stress)" hint={mentalState(pack, game)} />
        </Stat>
        <Stat icon="stamina" k="stamina">
          <StatBar label="체력" value={s.stamina} tone="var(--c-stamina)" />
        </Stat>
        <Stat icon="luck" k="luck">
          <div className="stat" title="운은 숨겨진 수치입니다">
            <span className="stat-label">운</span>
            <span className="luck">{luckHint(s.luck)}</span>
          </div>
        </Stat>
        <Stat icon="money" k="money">
          <div className={`stat money ${s.money < 0 ? 'bad' : ''}`}>
            <span className="stat-label">돈</span>
            <span>{won(s.money)}</span>
          </div>
        </Stat>
      </div>
      <div className="hud-sub">
        <span>
          <Icon name="trust" size={12} /> 교수 신뢰 {Math.round(game.hidden.trust)}
        </span>
        <span>
          <Icon name="relation" size={12} /> 랩 관계 {Math.round(game.hidden.relation)}
        </span>
        <span>
          <Icon name="network" size={12} /> 네트워크 {Math.round(game.hidden.network)}
        </span>
        <span className={`mental ${mentalState(pack, game)}`}>{mentalState(pack, game)}</span>
      </div>
      <div className="hud-deadlines">
        {deadlines.map((dl) => (
          <span key={`${dl.venueId}-${dl.year}`} className={dl.week - game.week <= 2 ? 'urgent' : ''}>
            {pack.venues.find((v) => v.id === dl.venueId)?.displayName.split(' ')[0]} D-{(dl.week - game.week) * 7}
          </span>
        ))}
      </div>
      <div className="hud-actions">
        <button className="btn small" disabled={saving} onClick={save}>
          ☁ 저장
        </button>
        <button className="btn small ghost" onClick={() => go('title')}>
          타이틀
        </button>
      </div>
    </header>
  );
}
