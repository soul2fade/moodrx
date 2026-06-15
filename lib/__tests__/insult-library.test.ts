import { describe, it, expect } from 'vitest';
import { validateManifest, pickClip, remoteUrl, localUri, type Manifest } from '../insult-library';

const M: Manifest = {
  version: 1,
  format: 'mp3_44100_96',
  voices: {
    rachel: {
      label: 'Rachel',
      free: true,
      tiers: {
        'glass-house': [{ id: 'a', text: 'x', file: 'audio/rachel/glass-house/a.mp3' }],
        sticks: [
          { id: 'b', text: 'y', file: 'audio/rachel/sticks/b.mp3' },
          { id: 'c', text: 'z', file: 'audio/rachel/sticks/c.mp3' },
        ],
        roast: [],
      },
    },
  },
};

describe('validateManifest', () => {
  it('accepts a well-formed manifest', () => {
    expect(validateManifest(M)).toBe(true);
  });
  it('rejects malformed input', () => {
    expect(validateManifest(null)).toBe(false);
    expect(validateManifest({ version: 1 })).toBe(false);
    expect(validateManifest({ version: 1, format: 'x', voices: [] })).toBe(false);
    expect(validateManifest({ version: '1', format: 'x', voices: {} })).toBe(false);
  });
});

describe('pickClip', () => {
  it('returns a clip from the requested voice+tier (deterministic rng)', () => {
    expect(pickClip(M, 'rachel', 'sticks', () => 0)).toEqual(M.voices.rachel.tiers.sticks[0]);
    expect(pickClip(M, 'rachel', 'sticks', () => 0.99)).toEqual(M.voices.rachel.tiers.sticks[1]);
  });
  it('returns null for unknown voice, unknown tier, or empty tier', () => {
    expect(pickClip(M, 'nobody', 'sticks')).toBeNull();
    expect(pickClip(M, 'rachel', 'roast')).toBeNull();
  });
});

describe('remoteUrl', () => {
  it('joins base + file with exactly one slash', () => {
    expect(remoteUrl('https://x.net', 'audio/r/s/a.mp3')).toBe('https://x.net/audio/r/s/a.mp3');
    expect(remoteUrl('https://x.net/', '/audio/r/s/a.mp3')).toBe('https://x.net/audio/r/s/a.mp3');
  });
});

describe('localUri', () => {
  it('builds <root>insults/<file>', () => {
    expect(localUri('file:///docs/', 'audio/r/s/a.mp3')).toBe('file:///docs/insults/audio/r/s/a.mp3');
  });
});
