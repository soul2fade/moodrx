import { describe, it, expect } from 'vitest';
import { VOICES, isVoiceName, normalizeVoice, effectiveVoice } from '../voices';

describe('VOICES', () => {
  it('has rachel free + four paid voices in order', () => {
    expect(VOICES.map((v) => v.name)).toEqual(['rachel', 'deadpan', 'grampa', 'ruthie', 'ed']);
    expect(VOICES.find((v) => v.name === 'rachel')!.free).toBe(true);
    expect(VOICES.filter((v) => !v.free).map((v) => v.name)).toEqual(['deadpan', 'grampa', 'ruthie', 'ed']);
    for (const v of VOICES) expect(v.label.length).toBeGreaterThan(0);
  });
});

describe('isVoiceName', () => {
  it('narrows known voice names, rejects junk', () => {
    expect(isVoiceName('rachel')).toBe(true);
    expect(isVoiceName('ed')).toBe(true);
    expect(isVoiceName('nope')).toBe(false);
    expect(isVoiceName(null)).toBe(false);
  });
});

describe('normalizeVoice', () => {
  it('passes known voices, defaults unknown/missing to rachel', () => {
    expect(normalizeVoice('grampa')).toBe('grampa');
    expect(normalizeVoice('nope')).toBe('rachel');
    expect(normalizeVoice(null)).toBe('rachel');
  });
});

describe('effectiveVoice', () => {
  it('a free voice always plays', () => {
    expect(effectiveVoice('rachel', false)).toBe('rachel');
  });
  it('a paid voice plays only when the bundle is owned', () => {
    expect(effectiveVoice('grampa', true)).toBe('grampa');
    expect(effectiveVoice('grampa', false)).toBe('rachel');
  });
  it('an unknown voice falls back to rachel', () => {
    expect(effectiveVoice('mystery', true)).toBe('rachel');
  });
});
