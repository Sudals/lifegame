import seedrandom from 'seedrandom';

/** seedrandom(alea)의 내부 상태. JSON 직렬화 가능 → 세이브에 그대로 저장. */
export type RngState = Record<string, unknown>;

/**
 * 게임의 유일한 랜덤 소스. Math.random 사용 금지.
 * 상태를 GameState에 저장/복원하므로 같은 시드 + 같은 선택 = 같은 결과.
 */
export class Rng {
  private readonly prng: seedrandom.StatefulPRNG<seedrandom.State.Alea>;

  private constructor(prng: seedrandom.StatefulPRNG<seedrandom.State.Alea>) {
    this.prng = prng;
  }

  static fromSeed(seed: string): Rng {
    return new Rng(seedrandom.alea(seed, { state: true }));
  }

  static restore(state: RngState): Rng {
    return new Rng(seedrandom.alea('', { state: state as unknown as seedrandom.State.Alea }));
  }

  save(): RngState {
    return this.prng.state() as unknown as RngState;
  }

  /** [0, 1) */
  next(): number {
    return this.prng();
  }

  /** [min, max] 정수 */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick: 빈 배열');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** 가중치 기반 선택 */
  weighted<T>(items: readonly T[], weight: (t: T) => number): T {
    const total = items.reduce((s, t) => s + Math.max(0, weight(t)), 0);
    if (total <= 0) return this.pick(items);
    let r = this.next() * total;
    for (const t of items) {
      r -= Math.max(0, weight(t));
      if (r < 0) return t;
    }
    return items[items.length - 1] as T;
  }

  /** 표준정규분포 (Box–Muller) */
  normal(mean = 0, sd = 1): number {
    const u = Math.max(this.next(), 1e-12);
    const v = this.next();
    return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}

/** 상태를 소비하지 않는 결정적 해시 (학회 마감 오프셋 등) */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
