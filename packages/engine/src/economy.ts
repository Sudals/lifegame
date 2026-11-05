import type { ContentPack, ShopItem } from '@grad-sim/content';
import { hasFlag } from './flags';
import { applyChoice, borrowMoney } from './outcome';
import { log } from './research';
import type { Rng } from './rng';
import { clamp, type GameState, type Paper } from './state';

// ───────────────────────── 학자금 대출 ─────────────────────────

export interface LoanInfo {
  debt: number;
  limit: number;
  room: number; // 더 빌릴 수 있는 금액
  unit: number;
  annualRate: number;
  monthlyInterest: number;
}

export function loanInfo(pack: ContentPack, state: GameState): LoanInfo {
  const b = pack.balance;
  return {
    debt: state.debt,
    limit: b.loanLimit,
    room: Math.max(0, b.loanLimit - state.debt),
    unit: b.loanUnit,
    annualRate: b.loanAnnualRate,
    monthlyInterest: monthlyInterest(pack, state),
  };
}

export function monthlyInterest(pack: ContentPack, state: GameState): number {
  return Math.round((state.debt * pack.balance.loanAnnualRate) / 12 / 10) * 10;
}

/** 순자산 = 잔고 − 대출 */
export function netWorth(state: GameState): number {
  return state.stats.money - state.debt;
}

/** 잔고가 마이너스일 때 메울 만큼의 대출 제안액 (단위 올림, 한도 내) */
export function suggestedLoan(pack: ContentPack, state: GameState): number {
  const b = pack.balance;
  const need = Math.max(b.loanUnit, Math.ceil((-state.stats.money + b.loanUnit / 2) / b.loanUnit) * b.loanUnit);
  return Math.min(need, Math.floor((b.loanLimit - state.debt) / b.loanUnit) * b.loanUnit);
}

export function doBorrow(pack: ContentPack, s: GameState, amount: number): void {
  if (s.phase !== 'semester') throw new Error('재학 중에만 대출을 받을 수 있습니다.');
  if (amount <= 0 || amount % pack.balance.loanUnit !== 0) throw new Error(`${pack.balance.loanUnit.toLocaleString()}원 단위로 빌릴 수 있습니다.`);
  if (s.debt + amount > pack.balance.loanLimit) throw new Error('대출 한도를 넘습니다.');
  borrowMoney(pack, s, amount);
  log(s, `🏦 학자금 대출 ${amount.toLocaleString()}원을 받았다. (잔액 ${s.debt.toLocaleString()}원, 연 ${(pack.balance.loanAnnualRate * 100).toFixed(1)}%)`, 'info');
}

export function doRepay(pack: ContentPack, s: GameState, amount: number): void {
  const pay = Math.min(Math.round(amount), s.debt);
  if (pay <= 0) throw new Error('갚을 대출이 없습니다.');
  if (s.stats.money < pay) throw new Error('잔고가 부족합니다.');
  s.stats.money -= pay;
  s.debt -= pay;
  log(s, s.debt === 0 ? `🏦 학자금 대출을 모두 갚았다! 홀가분하다.` : `🏦 대출 ${pay.toLocaleString()}원을 갚았다. (잔액 ${s.debt.toLocaleString()}원)`, 'good');
  if (s.debt === 0) s.stats.stress = clamp(s.stats.stress - 3, 0, 100);
}

// ───────────────────────── 상점 ─────────────────────────

export interface ShopStatus {
  item: ShopItem;
  ok: boolean;
  reason?: string;
  boughtThisWeek: number;
  owned: boolean;
}

/** 영문 교정 등: 작성·리비전 중인 논문 (가장 많이 진행된 것) */
export function polishTarget(state: GameState): Paper | undefined {
  return state.papers
    .filter((p) => p.stage === 'writing' || p.stage === 'ready' || p.stage === 'revision')
    .sort((a, b) => b.progress - a.progress)[0];
}

export function shopStatus(pack: ContentPack, state: GameState, item: ShopItem): ShopStatus {
  const rec = state.purchases[item.id];
  const boughtThisWeek = rec && rec.week === state.week ? rec.count : 0;
  const owned = item.once && !!rec;
  const base = { item, boughtThisWeek, owned };
  if (state.phase !== 'semester') return { ...base, ok: false, reason: '재학 중에만' };
  if (owned) return { ...base, ok: false, reason: '보유 중' };
  if (item.requireFlags.some((f) => !hasFlag(state, f))) return { ...base, ok: false, reason: item.requireFlags.includes('relationship') ? '연인이 있어야' : '조건 미충족' };
  if (boughtThisWeek >= item.perWeek) return { ...base, ok: false, reason: '이번 주 한도' };
  if (item.paperQuality && !polishTarget(state)) return { ...base, ok: false, reason: '작성 중인 논문 없음' };
  if (state.stats.money < item.price) return { ...base, ok: false, reason: '잔고 부족' };
  return { ...base, ok: true };
}

export function shopList(pack: ContentPack, state: GameState): ShopStatus[] {
  return pack.shop.map((it) => shopStatus(pack, state, it));
}

export function doBuy(pack: ContentPack, s: GameState, itemId: string, rng: Rng): void {
  const item = pack.shop.find((x) => x.id === itemId);
  if (!item) throw new Error('없는 상품입니다.');
  const st = shopStatus(pack, s, item);
  if (!st.ok) throw new Error(`${item.name}: ${st.reason}`);
  s.stats.money -= item.price;
  const rec = s.purchases[item.id];
  s.purchases[item.id] = { week: s.week, count: st.boughtThisWeek + 1, total: (rec?.total ?? 0) + 1 };
  const { result, tone } = applyChoice(pack, s, item, rng);
  let extra = '';
  if (item.paperQuality) {
    const p = polishTarget(s)!;
    p.quality += item.paperQuality;
    extra = ` 「${p.title}」 완성도 +${item.paperQuality}`;
  }
  log(s, `🛒 ${item.name} (${item.price.toLocaleString()}원) — ${result}${extra}`, item.outcomes.length ? tone : 'info');
}
