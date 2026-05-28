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
