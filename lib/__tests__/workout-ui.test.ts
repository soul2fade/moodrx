import { describe, it, expect } from 'vitest';
import { appendDictation } from '@/lib/workout-ui';

describe('appendDictation', () => {
  it('uses the transcript when the base is empty', () => {
    expect(appendDictation('', 'hello there', 140)).toBe('hello there');
  });
  it('appends to existing text with a single space, trimming', () => {
    expect(appendDictation('rough day', 'felt better after', 140)).toBe('rough day felt better after');
    expect(appendDictation('  rough day ', '  felt better  ', 140)).toBe('rough day felt better');
  });
  it('returns the trimmed-capped base when the transcript is empty', () => {
    expect(appendDictation('note', '   ', 140)).toBe('note');
    expect(appendDictation('', '', 140)).toBe('');
  });
  it('truncates the result to the cap', () => {
    const base = 'a'.repeat(135);
    expect(appendDictation(base, 'bbbbbbbbbb', 140)).toHaveLength(140);
    expect(appendDictation(base, 'bbbbbbbbbb', 140).startsWith(base)).toBe(true);
  });
});
