/**
 * Seeded pseudo-randomness for the composition engine.
 *
 * mulberry32 is small, fast, and reproducible across platforms, which keeps
 * compositions testable: the same seed and pool always produce the same pick
 * order. Seeded randomness balances variety (server nonce) with
 * reproducibility (tests, coverage estimation).
 */
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one item, biased by a non-negative weight (higher weight = likelier). */
export function weightedPick<T>(rng: Rng, items: readonly T[], weightOf: (item: T) => number): T {
  if (items.length === 0) throw new Error('weightedPick: empty items');
  if (items.length === 1) return items[0];
  const weights = items.map((item) => Math.max(weightOf(item), 0));
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return items[i];
  }
  return items[items.length - 1];
}
