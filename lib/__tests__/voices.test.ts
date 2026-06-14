import { describe, it, expect } from 'vitest';
import { VOICES, isVoiceName, normalizeVoice, effectiveVoice, ownsVoice, voiceEntitlementId } from '../voices';

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
    expect(effectiveVoice('rachel', new Set())).toBe('rachel');
  });
  it('a paid voice plays when its own entitlement is owned', () => {
    expect(effectiveVoice('grampa', new Set(['voice_grampa']))).toBe('grampa');
  });
  it('a paid voice plays when the bundle is owned', () => {
    expect(effectiveVoice('grampa', new Set(['pack_voice_pack']))).toBe('grampa');
  });
  it('a paid voice falls back to rachel when unowned', () => {
    expect(effectiveVoice('grampa', new Set())).toBe('rachel');
  });
  it('an unknown voice falls back to rachel', () => {
    expect(effectiveVoice('mystery', new Set(['voice_mystery']))).toBe('rachel');
  });
});

describe('voiceEntitlementId', () => {
  it('namespaces the voice id', () => {
    expect(voiceEntitlementId('ed')).toBe('voice_ed');
  });
});

describe('ownsVoice', () => {
  it('free voices are always owned', () => {
    expect(ownsVoice('rachel', new Set())).toBe(true);
  });
  it('owns a paid voice via its own entitlement', () => {
    expect(ownsVoice('ed', new Set(['voice_ed']))).toBe(true);
  });
  it('owns any paid voice via the bundle', () => {
    expect(ownsVoice('ed', new Set(['pack_voice_pack']))).toBe(true);
    expect(ownsVoice('ruthie', new Set(['pack_voice_pack']))).toBe(true);
  });
  it('owns any paid voice via all_access', () => {
    expect(ownsVoice('ed', new Set(['all_access']))).toBe(true);
  });
  it('does not own an unpurchased paid voice', () => {
    expect(ownsVoice('ed', new Set(['voice_deadpan']))).toBe(false);
    expect(ownsVoice('ed', new Set())).toBe(false);
  });
  it('an unknown voice is not owned', () => {
    expect(ownsVoice('mystery', new Set(['voice_mystery']))).toBe(false);
  });
});
