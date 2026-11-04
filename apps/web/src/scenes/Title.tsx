import { useEffect, useState } from 'react';
import type { GameState } from '@grad-sim/engine';
import { Character } from '../art/Character';
import { Sprite } from '../art/Sprite';
import { Stage } from '../art/Stage';
import { cloudList, cloudLoad, health, type CloudSaveMeta, type Health } from '../net/api';
import { storage, type SaveMeta } from '../platform/SaveStorage';
import { useGame } from '../store/gameStore';

export function Title() {
  const { go, loadState, notify } = useGame();
  const [saves, setSaves] = useState<SaveMeta[]>([]);
  const [cloud, setCloud] = useState<CloudSaveMeta[]>([]);
  const [server, setServer] = useState<Health | 'down' | null>(null);

  useEffect(() => {
    storage.list().then(setSaves).catch(() => setSaves([]));
    health().then(setServer).catch(() => setServer('down'));
    cloudList().then(setCloud).catch(() => setCloud([]));
  }, []);

  const loadLocal = async (slot: number) => {
    const raw = await storage.load(slot);
    if (raw) loadState(JSON.parse(raw) as GameState, slot);
  };
  const loadCloud = async (slot: number) => {
    try {
      loadState(await cloudLoad(slot), slot);
    } catch (e) {
      notify(String(e instanceof Error ? e.message : e));
    }
  };

  return (
    <div className="title-screen">
      <Stage sceneId="lab-dawn" fx={false} className="title-stage">
        <div className="title-logo">
          <p className="subtitle">대학원 시뮬레이션 · 인공지능학과</p>
          <h1>졸업할 수 있을까?</h1>
        </div>
        <Character id="player" expr="tired" x={430} />
        <Sprite id="fx-zzz" fps={3} className="abs" style={{ left: 462, top: 150 }} />
      </Stage>
      <div className="title-card">
        <div className="menu">
          <button className="btn primary" onClick={() => go('new')}>
            새 게임
          </button>
          <button className="btn" onClick={() => go('ranking')}>
            명예의 전당
          </button>
        </div>

        {saves.length > 0 && (
          <div className="save-list">
            <h3>이어하기</h3>
            {saves.map((s) => (
              <button key={s.slot} className="btn ghost" onClick={() => loadLocal(s.slot)}>
                슬롯 {s.slot} · {s.label}
              </button>
            ))}
          </div>
        )}
        {cloud.length > 0 && (
          <div className="save-list">
            <h3>☁ 클라우드 세이브</h3>
            {cloud.map((s) => (
              <button key={s.slot} className="btn ghost" onClick={() => loadCloud(s.slot)}>
                슬롯 {s.slot} · {new Date(s.updatedAt).toLocaleString('ko-KR')}
              </button>
            ))}
          </div>
        )}
        <p className={`server ${server === 'down' ? 'bad' : server ? 'good' : ''}`}>
          {server === null ? '서버 확인 중…' : server === 'down' ? '● 오프라인 (로컬 세이브만 사용)' : `● 온라인 · ${server.postgres} (${server.latencyMs}ms)`}
        </p>
      </div>
    </div>
  );
}
