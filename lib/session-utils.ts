/** Generate a collision-resistant Session id. Prefers crypto.randomUUID()
 *  (RN 0.74+ Hermes / web), falls back to a timestamp-plus-random suffix
 *  for any runtime that doesn't expose it. The previous Date.now().toString()
 *  collided when two synchronous tap handlers fired in the same millisecond
 *  ("Just Log It" + "Same as Yesterday" rapid-fire), producing duplicate
 *  ids that broke FlatList keying and future delete-by-id. */
export function createSessionId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) {
    try {
      return c.randomUUID();
    } catch {
      // fall through to fallback
    }
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Format mood intensity change: negative delta = improvement (feeling better). */
export function formatSessionDelta(intensity: number, postScore: number): string {
  const delta = postScore - intensity;
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export function sessionDelta(intensity: number, postScore: number): number {
  return postScore - intensity;
}

/** Lower post-score vs pre-score means the user feels better. */
export function isMoodImprovement(intensity: number, postScore: number): boolean {
  return postScore < intensity;
}

export function getWinMessage(intensity: number, postScore: number): string {
  const delta = sessionDelta(intensity, postScore);
  if (delta <= -3) return 'Major shift. Write that down.';
  if (delta < 0) return 'The data agrees with you.';
  if (delta === 0) return 'You moved. That counts.';
  return 'Rough session. You still showed up.';
}
