import { describe, it, expect } from 'vitest';
import { parseVentResponse, ventAction, buildVentSession, joinTranscript, accumulateTranscript, pickRecognitionMode, decideSttRetry } from '@/lib/vent';

describe('parseVentResponse', () => {
  const ok = { mood: 'stressed', intensity: 7, reply: 'You showed up.', risk: 'none' };

  it('accepts a well-formed response', () => {
    expect(parseVentResponse(ok)).toEqual(ok);
  });
  it('clamps/rounds intensity and trims reply', () => {
    expect(parseVentResponse({ ...ok, intensity: 7.6, reply: '  hi  ' })).toEqual({
      mood: 'stressed', intensity: 8, reply: 'hi', risk: 'none',
    });
    expect(parseVentResponse({ ...ok, intensity: 0 })?.intensity).toBe(1);
    expect(parseVentResponse({ ...ok, intensity: 99 })?.intensity).toBe(10);
  });
  it('rejects bad mood, non-finite intensity, empty reply, bad risk, non-object', () => {
    expect(parseVentResponse({ ...ok, mood: 'sad' })).toBeNull();
    expect(parseVentResponse({ ...ok, intensity: NaN })).toBeNull();
    expect(parseVentResponse({ ...ok, reply: '   ' })).toBeNull();
    expect(parseVentResponse({ ...ok, risk: 'panic' })).toBeNull();
    expect(parseVentResponse(null)).toBeNull();
    expect(parseVentResponse('nope')).toBeNull();
  });
});

describe('ventAction', () => {
  it('routes only acute to the crisis screen', () => {
    expect(ventAction('none')).toBe('reply');
    expect(ventAction('elevated')).toBe('reply-with-resource');
    expect(ventAction('acute')).toBe('crisis-redirect');
  });
});

describe('buildVentSession', () => {
  it('builds a workout-less check-in tagged source:vent (postScore = intensity)', () => {
    const s = buildVentSession({ id: 'v1', mood: 'low', intensity: 6, timestamp: 1234 });
    expect(s).toEqual({
      id: 'v1',
      mood: 'low',
      intensity: 6,
      postScore: 6,
      workoutName: 'Vent',
      duration: 0,
      timestamp: 1234,
      lightDay: true,
      source: 'vent',
    });
  });
  it('spreads captured health fields when provided', () => {
    const s = buildVentSession({
      id: 'v2', mood: 'anxious', intensity: 8, timestamp: 9,
      health: { stepsToday: 5000, sleepHoursLastNight: 7 },
    });
    expect(s.stepsToday).toBe(5000);
    expect(s.sleepHoursLastNight).toBe(7);
    expect(s.source).toBe('vent');
  });
});

describe('joinTranscript', () => {
  it('joins two non-empty parts with a single space, trimming each', () => {
    expect(joinTranscript('hello', 'there')).toBe('hello there');
    expect(joinTranscript('  hello ', '  there  ')).toBe('hello there');
  });
  it('returns the other part when one is empty/whitespace', () => {
    expect(joinTranscript('', 'there')).toBe('there');
    expect(joinTranscript('hello', '')).toBe('hello');
    expect(joinTranscript('   ', 'there')).toBe('there');
    expect(joinTranscript('hello', '   ')).toBe('hello');
    expect(joinTranscript('', '')).toBe('');
  });
});

describe('accumulateTranscript', () => {
  it('interim segment updates display but NOT committed', () => {
    expect(accumulateTranscript('', 'hel', false)).toEqual({ committed: '', display: 'hel' });
    expect(accumulateTranscript('', 'hello', false)).toEqual({ committed: '', display: 'hello' });
  });
  it('final segment folds into committed', () => {
    expect(accumulateTranscript('', 'hello', true)).toEqual({ committed: 'hello', display: 'hello' });
  });
  it('accumulates across a pause: prior committed + new segment', () => {
    const a = accumulateTranscript('', 'I had a rough day', true);
    expect(a).toEqual({ committed: 'I had a rough day', display: 'I had a rough day' });
    const b = accumulateTranscript(a.committed, 'and I am exhausted', false);
    expect(b).toEqual({
      committed: 'I had a rough day',
      display: 'I had a rough day and I am exhausted',
    });
    const c = accumulateTranscript(a.committed, 'and I am exhausted', true);
    expect(c).toEqual({
      committed: 'I had a rough day and I am exhausted',
      display: 'I had a rough day and I am exhausted',
    });
  });
  it('empty segment leaves committed and shows committed as display', () => {
    expect(accumulateTranscript('so far', '', false)).toEqual({ committed: 'so far', display: 'so far' });
    expect(accumulateTranscript('so far', '', true)).toEqual({ committed: 'so far', display: 'so far' });
  });
  it('repeated interim results for one segment do not compound onto committed', () => {
    const committed = 'I had a rough day';
    // Same second segment arrives interim multiple times, growing each time:
    expect(accumulateTranscript(committed, 'and', false)).toEqual({
      committed: 'I had a rough day',
      display: 'I had a rough day and',
    });
    expect(accumulateTranscript(committed, 'and I am', false)).toEqual({
      committed: 'I had a rough day',
      display: 'I had a rough day and I am',
    });
    // Finalizes — folds in exactly once, no duplication:
    expect(accumulateTranscript(committed, 'and I am exhausted', true)).toEqual({
      committed: 'I had a rough day and I am exhausted',
      display: 'I had a rough day and I am exhausted',
    });
  });
});

describe('pickRecognitionMode', () => {
  it('uses on-device when supported and the locale is on-device-available', () => {
    expect(pickRecognitionMode({ supportsOnDevice: true, onDeviceLocales: ['en-US'], locale: 'en-US' }))
      .toEqual({ requiresOnDeviceRecognition: true, usingCloud: false });
  });
  it('falls back to cloud when on-device is unsupported', () => {
    expect(pickRecognitionMode({ supportsOnDevice: false, onDeviceLocales: [], locale: 'en-US' }))
      .toEqual({ requiresOnDeviceRecognition: false, usingCloud: true });
  });
  it('falls back to cloud when the locale model is not available on-device', () => {
    expect(pickRecognitionMode({ supportsOnDevice: true, onDeviceLocales: ['fr-FR'], locale: 'en-US' }))
      .toEqual({ requiresOnDeviceRecognition: false, usingCloud: true });
  });
  it('treats locale case/region loosely (en matches en-US)', () => {
    expect(pickRecognitionMode({ supportsOnDevice: true, onDeviceLocales: ['en'], locale: 'en-US' }).usingCloud).toBe(false);
  });
});

describe('decideSttRetry', () => {
  // Called when a recognition attempt ends without a usable transcript (the
  // `end` event always fires last — even after an error/nomatch — so it is the
  // single decision point). The observed device bug: on-device starts fine,
  // yields zero results, ends empty; the network recognizer (which works) must
  // still be attempted before giving up.
  it('retries with cloud when on-device produced nothing and cloud not yet tried', () => {
    expect(decideSttRetry({ usedOnDevice: true, triedCloud: false })).toBe('retry-cloud');
  });
  it('gives up to the form once cloud has already been tried', () => {
    expect(decideSttRetry({ usedOnDevice: true, triedCloud: true })).toBe('fallback-form');
  });
  it('gives up to the form when cloud was the only mode (on-device never used)', () => {
    expect(decideSttRetry({ usedOnDevice: false, triedCloud: false })).toBe('fallback-form');
    expect(decideSttRetry({ usedOnDevice: false, triedCloud: true })).toBe('fallback-form');
  });
});
