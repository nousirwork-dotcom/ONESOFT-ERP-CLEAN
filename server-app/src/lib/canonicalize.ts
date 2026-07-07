/**
 * Canonical JSON — stable, deterministic key ordering for Ed25519 signing.
 *
 * Rules:
 *   - Object keys sorted alphabetically (recursive)
 *   - Array order preserved (never sorted)
 *   - No extra whitespace
 *   - Produces identical output to scripts/sign-test-license.js canonicalize()
 *
 * IMPORTANT: Never change this function after keys are issued.
 * Any change will invalidate all existing signed licenses.
 */
export function canonicalize(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + (obj as unknown[]).map(canonicalize).join(',') + ']';
  }
  const record = obj as Record<string, unknown>;
  const sorted = Object.keys(record).sort();
  return '{' + sorted.map(k => JSON.stringify(k) + ':' + canonicalize(record[k])).join(',') + '}';
}
