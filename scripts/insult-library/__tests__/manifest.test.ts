import { describe, it, expect } from 'vitest';
import { emptyManifest, hasEntry, addEntry, validateManifest } from '../lib/manifest';

describe('manifest', () => {
  it('emptyManifest is valid and versioned with no voices', () => {
    const m = emptyManifest('mp3_44100_96');
    expect(m.version).toBe(1);
    expect(m.format).toBe('mp3_44100_96');
    expect(Object.keys(m.voices)).toHaveLength(0);
    expect(validateManifest(m)).toBe(true);
  });

  it('addEntry creates the voice/tier and records the clip; hasEntry then finds it', () => {
    let m = emptyManifest('mp3_44100_96');
    expect(hasEntry(m, 'noir', 'roast', 'abc')).toBe(false);
    m = addEntry(m, { name: 'noir', label: 'Dr. MoodRx', free: true }, 'roast', {
      id: 'abc',
      text: 'Move it.',
      file: 'audio/noir/roast/abc.mp3',
    });
    expect(hasEntry(m, 'noir', 'roast', 'abc')).toBe(true);
    expect(m.voices.noir.free).toBe(true);
    expect(m.voices.noir.tiers.roast[0]).toMatchObject({ id: 'abc', file: 'audio/noir/roast/abc.mp3' });
    expect(validateManifest(m)).toBe(true);
  });

  it('addEntry is idempotent — re-adding the same id does not duplicate', () => {
    let m = emptyManifest('mp3_44100_96');
    const meta = { name: 'noir', label: 'Dr. MoodRx', free: true };
    const clip = { id: 'abc', text: 'Move it.', file: 'audio/noir/roast/abc.mp3' };
    m = addEntry(m, meta, 'roast', clip);
    m = addEntry(m, meta, 'roast', clip);
    expect(m.voices.noir.tiers.roast).toHaveLength(1);
  });

  it('validateManifest rejects malformed input', () => {
    expect(validateManifest(null)).toBe(false);
    expect(validateManifest({ version: 1 })).toBe(false);
    expect(validateManifest({ version: 1, format: 'x', voices: 'nope' })).toBe(false);
  });
});
