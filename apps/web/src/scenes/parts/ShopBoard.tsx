import { useState } from 'react';
import { SHOP_CATEGORY_LABELS, type ShopItem } from '@grad-sim/content';
import { borrow, buy, hasFlag, loanInfo, netWorth, repay, shopList, type GameState } from '@grad-sim/engine';
import { useFx } from '../../art/fx';
import { Icon } from '../../art/Sprite';
import { effectText, manwon, SHOP_ICONS } from '../../components/effects';
import { won } from '../../components/ui';
import { pack, useGame } from '../../store/gameStore';

function itemHint(it: ShopItem): string {
  const parts = [effectText(it.effects)];
  if (it.setFlags.length) {
    const f = it.setFlags[0]!;
    parts.push(f.weeks ? `${f.weeks}주 지속` : '영구');
  }
  if (it.paperQuality) parts.push(`논문 완성도 +${it.paperQuality}`);
  if (it.perWeek > 1) parts.push(`주 ${it.perWeek}회`);
  return parts.filter(Boolean).join(' · ');
}

/** 학자금 대출: 빌리고 갚기 */
function Bank({ game }: { game: GameState }) {
  const { run, notify } = useGame();
  const info = loanInfo(pack, game);
  const u = info.unit;
  return (
    <section className="bank">
      <h3>
        <Icon name="bank" /> 학자금 대출
      </h3>
      <div className="bank-grid">
        <span>잔고</span>
        <strong className={game.stats.money < 0 ? 'bad' : ''}>{won(game.stats.money)}</strong>
        <span>대출 잔액</span>
        <strong>
          {won(info.debt)} <small className="dim">/ 한도 {manwon(info.limit)}</small>
        </strong>
        <span>이자</span>
        <span>
          연 {(info.annualRate * 100).toFixed(1)}% · 매달 월급날 {won(info.monthlyInterest)}
        </span>
        <span>순자산</span>
        <strong className={netWorth(game) < 0 ? 'bad' : 'good'}>{won(netWorth(game))}</strong>
      </div>
      <div className="row">
        {[1, 3].map((n) => (
          <button key={n} className="btn small" disabled={info.room < u * n} onClick={() => run((g) => borrow(pack, g, u * n)) && notify(`${manwon(u * n)} 대출 실행`)}>
            {manwon(u * n)} 빌리기
          </button>
        ))}
        <button className="btn small" disabled={info.debt <= 0 || game.stats.money < Math.min(u, info.debt)} onClick={() => run((g) => repay(pack, g, Math.min(u, g.debt)))}>
          {manwon(Math.min(u, info.debt || u))} 갚기
        </button>
        <button className="btn small ghost" disabled={info.debt <= 0 || game.stats.money < info.debt} onClick={() => run((g) => repay(pack, g, g.debt))}>
          전액 상환
        </button>
      </div>
      <small className="dim">졸업할 때 남은 대출은 순자산에서 빠지고, 진로 안착 평가(재정)에도 반영됩니다.</small>
    </section>
  );
}

export function ShopBoard({ game }: { game: GameState }) {
  const { run } = useGame();
  const [cat, setCat] = useState<string>('food');
  const list = shopList(pack, game).filter((x) => x.item.category === cat);

  const purchase = (it: ShopItem) => {
    if (run((g) => buy(pack, g, it.id))) useFx.getState().play('sparkle', { x: 320, y: 170 });
  };

  return (
    <div className="shop-board">
      <Bank game={game} />
      <nav className="shop-cats">
        {Object.entries(SHOP_CATEGORY_LABELS).map(([k, label]) => (
          <button key={k} className={`tab ${cat === k ? 'active' : ''}`} onClick={() => setCat(k)}>
            <Icon name={SHOP_ICONS[k]!} size={12} /> {label}
          </button>
        ))}
      </nav>
      {cat === 'gift' && !hasFlag(game, 'relationship') && <p className="dim small">선물은 연인이 있을 때 살 수 있어요.</p>}
      <div className="act-grid">
        {list.map(({ item: it, ok, reason, owned, boughtThisWeek }) => (
          <div key={it.id} className={`act-card shop-item ${owned ? 'selected' : ''}`}>
            <strong>
              <Icon name={SHOP_ICONS[it.category]!} size={12} /> {it.name}
            </strong>
            <small className="act-meta">{won(it.price)}</small>
            <small className="dim">{it.description}</small>
            <small className="info">{itemHint(it)}</small>
            <button className="btn small" disabled={!ok} onClick={() => purchase(it)}>
              {owned ? '보유 중' : ok ? `구매${boughtThisWeek ? ` (${boughtThisWeek}/${it.perWeek})` : ''}` : reason}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
