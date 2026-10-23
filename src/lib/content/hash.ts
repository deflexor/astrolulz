/**
 * Deterministic hash utilities.
 *
 * `stableId` is a pure, non-cryptographic 64-bit-style fingerprint (two
 * independent FNV-1a 32-bit passes). It is used for composition IDs, which
 * only need stability and spread — never for security.
 */
export function fnv1a32(input: string, seed = 0x811c9dc5): number {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** 16 lowercase hex chars, stable for identical input. */
export function stableId(input: string): string {
  const h1 = fnv1a32(input);
  const h2 = fnv1a32(`${input}\u0000${h1.toString(36)}`, 0x9dc5811c);
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
}
