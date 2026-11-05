import type { Effects } from '@grad-sim/content';
import type { IconName } from '../art/assets';

const NAMES: Record<string, string> = {
  research: '연구력',
  stress: '스트레스',
  stamina: '체력',
  trust: '신뢰',
  relation: '관계',
  network: '네트워크',
  affection: '애정',
};

/** 효과 요약 (운은 숨김 수치라 표시하지 않는다) */
export function effectText(fx: Effects | undefined): string {
  if (!fx) return '';
  return Object.entries(fx)
    .filter(([k, v]) => v && k !== 'luck' && k !== 'money')
    .map(([k, v]) => `${NAMES[k] ?? k} ${v! > 0 ? '+' : ''}${v}`)
    .join(' · ');
}

export const manwon = (n: number) => (Math.abs(n) >= 10000 ? `${Math.round(n / 1000) / 10}만` : `${n.toLocaleString()}`) + '원';

export const ACTIVITY_ICONS: Record<string, IconName> = {
  health: 'shoe',
  leisure: 'game',
  social: 'relation',
  date: 'love',
  growth: 'sprout',
  money: 'job',
};

export const SHOP_ICONS: Record<string, IconName> = {
  food: 'food',
  health: 'pill',
  gear: 'monitor',
  study: 'research',
  gift: 'gift',
  fun: 'dice',
};
