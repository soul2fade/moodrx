import { describe, it, expect } from 'vitest';
import { selectEpisode, type Episode } from '@/lib/coach-insight';
import { buildVentEpisodeMap } from '@/lib/coach-insight';
import type { Session } from '@/lib/storage';

// Fixed "now" so daysAgo is deterministic. 2026-06-11T12:00:00Z.
const NOW = Date.UTC(2026, 5, 11, 12, 0, 0);
const DAY = 86_400_000;

function mkSession(over: Partial<Session>): Session {
  // localDateString drives dayLabel; default it to NOW's date.
  const base: Session = {
    id: Math.random().toString(36).slice(2),
    mood: 'stressed',
    intensity: 6,
    postScore: 5,
    workoutName: 'Box Breathing',
    duration: 5,
    timestamp: NOW,
    rating: 'yes',
    localDateString: '2026-06-11',
  };
  return { ...base, ...over };
}

describe('selectEpisode', () => {
  it('returns null when the log is empty', () => {
    expect(selectEpisode('stressed', 6, [], NOW)).toBeNull();
  });

  it('returns null when no prior session shares the mood', () => {
    const sessions = [mkSession({ mood: 'anxious', timestamp: NOW - 2 * DAY })];
    expect(selectEpisode('stressed', 6, sessions, NOW)).toBeNull();
  });

  it('ignores unrated and "somewhat" sessions (no clear lesson)', () => {
    const sessions = [
      mkSession({ rating: undefined, timestamp: NOW - 2 * DAY }),
      mkSession({ rating: 'somewhat', timestamp: NOW - 3 * DAY }),
    ];
    expect(selectEpisode('stressed', 6, sessions, NOW)).toBeNull();
  });

  it('ignores sessions older than the 30-day recency window', () => {
    const sessions = [mkSession({ rating: 'no', timestamp: NOW - 31 * DAY })];
    expect(selectEpisode('stressed', 6, sessions, NOW)).toBeNull();
  });

  it('returns a structured episode (facts only) for a qualifying win', () => {
    const sessions = [
      mkSession({
        mood: 'stressed',
        intensity: 7,
        workoutName: 'Heavy Bag',
        rating: 'yes',
        timestamp: NOW - 3 * DAY,
        localDateString: '2026-06-08', // a Monday
      }),
    ];
    const ep = selectEpisode('stressed', 6, sessions, NOW) as Episode;
    expect(ep).toEqual({
      mood: 'stressed',
      intensity: 7,
      workoutName: 'Heavy Bag',
      helped: 'yes',
      dayLabel: 'Monday',
      daysAgo: 3,
    });
  });

  it('surfaces a clear flop to avoid', () => {
    const sessions = [
      mkSession({ rating: 'no', workoutName: 'Cold Shower', timestamp: NOW - 5 * DAY }),
    ];
    const ep = selectEpisode('stressed', 6, sessions, NOW) as Episode;
    expect(ep.helped).toBe('no');
    expect(ep.workoutName).toBe('Cold Shower');
  });

  it('prefers the most recent among equally-close qualifiers', () => {
    const sessions = [
      mkSession({ workoutName: 'Old', intensity: 6, timestamp: NOW - 10 * DAY }),
      mkSession({ workoutName: 'Recent', intensity: 6, timestamp: NOW - 2 * DAY }),
    ];
    expect(selectEpisode('stressed', 6, sessions, NOW)?.workoutName).toBe('Recent');
  });

  it('prefers the closer-intensity qualifier when recency is equal', () => {
    const sessions = [
      mkSession({ workoutName: 'Far', intensity: 1, timestamp: NOW - 4 * DAY }),
      mkSession({ workoutName: 'Near', intensity: 7, timestamp: NOW - 4 * DAY }),
    ];
    expect(selectEpisode('stressed', 8, sessions, NOW)?.workoutName).toBe('Near');
  });
});

describe('buildVentEpisodeMap', () => {
  it('returns an empty map when nothing qualifies', () => {
    expect(buildVentEpisodeMap([], NOW)).toEqual({});
  });

  it('includes one qualifying episode per mood, omitting moods with none', () => {
    const sessions = [
      mkSession({ mood: 'stressed', rating: 'yes', workoutName: 'Bag', timestamp: NOW - 2 * DAY }),
      mkSession({ mood: 'anxious', rating: 'no', workoutName: 'Breathing', timestamp: NOW - 4 * DAY }),
      // 'somewhat' → does not qualify, so 'foggy' is absent.
      mkSession({ mood: 'foggy', rating: 'somewhat', timestamp: NOW - 1 * DAY }),
    ];
    const map = buildVentEpisodeMap(sessions, NOW);
    expect(Object.keys(map).sort()).toEqual(['anxious', 'stressed']);
    expect(map.stressed?.workoutName).toBe('Bag');
    expect(map.anxious?.helped).toBe('no');
  });

  it('anchors intensity closeness on the most recent same-mood session', () => {
    const sessions = [
      // Most recent stressed session is UNRATED — it can't be selected, but its
      // intensity (8) sets the closeness anchor for this mood.
      mkSession({ mood: 'stressed', intensity: 8, rating: undefined, workoutName: 'AnchorSetter', timestamp: NOW - 1 * DAY }),
      // Two equally-recent rated candidates — only the anchor breaks the tie.
      mkSession({ mood: 'stressed', intensity: 9, rating: 'yes', workoutName: 'NearAnchor', timestamp: NOW - 6 * DAY }),
      mkSession({ mood: 'stressed', intensity: 4, rating: 'yes', workoutName: 'FarFromAnchor', timestamp: NOW - 6 * DAY }),
    ];
    // Anchor intensity 8 → 'NearAnchor' (|8-9|=1) beats 'FarFromAnchor' (|8-4|=4).
    // A naive fixed anchor of 5 would instead pick 'FarFromAnchor' (|5-4|=1), so
    // this asserts the anchor really is the most-recent session's intensity.
    expect(buildVentEpisodeMap(sessions, NOW).stressed?.workoutName).toBe('NearAnchor');
  });
});
