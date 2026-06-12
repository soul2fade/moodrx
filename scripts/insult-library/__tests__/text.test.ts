import { describe, it, expect } from 'vitest';
import { normalizeInsult, insultId, dedupeNew } from '../lib/text';

describe('normalizeInsult', () => {
  it('lowercases, strips punctuation, and collapses whitespace', () => {
    expect(normalizeInsult('  Oh, GREAT.   Another "rest" day?! ')).toBe('oh great another rest day');
  });
  it('treats casing/punctuation-only differences as equal', () => {
    expect(normalizeInsult('Quit stalling!')).toBe(normalizeInsult('quit   stalling'));
  });
});

describe('insultId', () => {
  it('is stable for the same normalized text across calls', () => {
    expect(insultId('Quit stalling!')).toBe(insultId('quit stalling'));
  });
  it('differs for different text and is a short hex string', () => {
    expect(insultId('a')).not.toBe(insultId('b'));
    expect(insultId('whatever')).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('dedupeNew', () => {
  it('drops candidates already present (by normalized form) and intra-batch dupes', () => {
    const existing = ['Quit stalling.'];
    const candidates = ['quit STALLING!', 'Get up.', 'get up', 'Move it.'];
    expect(dedupeNew(existing, candidates)).toEqual(['Get up.', 'Move it.']);
  });
  it('returns all candidates when nothing overlaps', () => {
    expect(dedupeNew([], ['One', 'Two'])).toEqual(['One', 'Two']);
  });
});
