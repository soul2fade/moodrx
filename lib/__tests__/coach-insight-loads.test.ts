import { describe, it, expect } from 'vitest';
import { buildCoachContext } from '@/lib/coach-insight';

describe('coach-insight loads under Node (vitest alias + AsyncStorage stub)', () => {
  it('buildCoachContext runs on an empty log without touching native modules', () => {
    const ctx = buildCoachContext({ mood: 'stressed', intensity: 6, workout: undefined }, []);
    expect(ctx.mood).toBe('stressed');
    expect(ctx.intensity).toBe(6);
    expect(ctx.recentTrend).toBe('new');
    expect(ctx.crisis).toBe(false);
  });
});
