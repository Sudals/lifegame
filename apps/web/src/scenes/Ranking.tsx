import { useEffect, useState } from 'react';
import { Panel } from '../components/ui';
import { ranking, type RankRow } from '../net/api';
import { pack, useGame } from '../store/gameStore';

export function Ranking() {
  const { go } = useGame();
  const [rows, setRows] = useState<RankRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    ranking().then(setRows).catch((e) => setErr(String(e instanceof Error ? e.message : e)));
  }, []);
  return (
    <div className="center-screen">
      <Panel title="🏆 명예의 전당 — 인공지능학과" className="form-panel">
        {err && <p className="bad">랭킹을 불러오지 못했습니다: {err}</p>}
        {!rows && !err && <p className="dim">불러오는 중…</p>}
        {rows && rows.length === 0 && <p className="dim">아직 기록이 없습니다. 첫 졸업생이 되어보세요!</p>}
        {rows && rows.length > 0 && (
          <table className="ranking">
            <thead>
              <tr>
                <th>#</th>
                <th>닉네임</th>
                <th>연구실</th>
                <th>진로</th>
                <th>등급</th>
                <th>점수</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>{r.nickname}</td>
                  <td>{pack.labs.find((l) => l.id === r.labId)?.name ?? r.labId}</td>
                  <td>{pack.careers.find((c) => c.id === r.career)?.name ?? '중도 포기'}</td>
                  <td>{r.grade}</td>
                  <td>{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="row end">
          <button className="btn ghost" onClick={() => go('title')}>
            타이틀로
          </button>
        </div>
      </Panel>
    </div>
  );
}
