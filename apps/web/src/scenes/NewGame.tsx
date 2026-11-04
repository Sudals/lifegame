import { useState } from 'react';
import { backgroundLabel, type Background, type StartTerm } from '@grad-sim/engine';
import { Panel } from '../components/ui';
import { useGame } from '../store/gameStore';

const BACKGROUNDS: { id: Background; desc: string }[] = [
  { id: 'cs', desc: '구현에 강하다. 초기 연구력 높음' },
  { id: 'math', desc: '이론에 강하다. 수식이 친구' },
  { id: 'ee', desc: '하드웨어 감각. 무난한 출발' },
  { id: 'other', desc: '맨땅에 헤딩. 대신 성장의 재미' },
];

export function NewGame() {
  const { start, go } = useGame();
  const [name, setName] = useState('');
  const [background, setBackground] = useState<Background>('cs');
  const [term, setTerm] = useState<StartTerm>(3);
  const [seed, setSeed] = useState('');
  const [slot, setSlot] = useState(1);

  return (
    <div className="center-screen">
      <Panel title="캐릭터 생성" className="form-panel">
        <label className="field">
          <span>이름</span>
          <input value={name} maxLength={12} placeholder="김석사" onChange={(e) => setName(e.target.value)} />
        </label>
        <fieldset className="field">
          <legend>학부 배경</legend>
          <div className="choice-grid">
            {BACKGROUNDS.map((b) => (
              <button key={b.id} className={`card-btn ${background === b.id ? 'selected' : ''}`} onClick={() => setBackground(b.id)}>
                <strong>{backgroundLabel(b.id)}</strong>
                <small>{b.desc}</small>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend>입학 시기</legend>
          <div className="row">
            {([3, 9] as const).map((t) => (
              <button key={t} className={`btn ${term === t ? 'primary' : ''}`} onClick={() => setTerm(t)}>
                {t === 3 ? '3월 (전기)' : '9월 (후기)'}
              </button>
            ))}
          </div>
          <small className="dim">입학 시기에 따라 학회 마감과 학기가 맞물리는 리듬이 달라집니다.</small>
        </fieldset>
        <div className="row">
          <label className="field grow">
            <span>시드 (선택)</span>
            <input value={seed} placeholder="비우면 랜덤" onChange={(e) => setSeed(e.target.value)} />
          </label>
          <label className="field">
            <span>세이브 슬롯</span>
            <select value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
              {[1, 2, 3].map((s) => (
                <option key={s} value={s}>
                  슬롯 {s}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row end">
          <button className="btn ghost" onClick={() => go('title')}>
            뒤로
          </button>
          <button className="btn primary" onClick={() => start({ name, background, startTerm: term, seed }, slot)}>
            컨택 메일 쓰러 가기 ▶
          </button>
        </div>
      </Panel>
    </div>
  );
}
