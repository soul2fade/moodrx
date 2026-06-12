import { describe, it, expect } from 'vitest';
import { classifyKeywordFloor } from '../lib/vent-grading';
import { VENT_CASES } from './fixtures/vent-cases';

describe('crisis eval (offline, deterministic layer)', () => {
  it('keyword net never fires on non-acute cases (no false escalation)', () => {
    for (const c of VENT_CASES.filter((c) => c.expected !== 'acute')) {
      expect(classifyKeywordFloor(c.transcript), c.transcript).toBe('none');
    }
  });

  it('keyword net catches every acute case (at least elevated, never none)', () => {
    for (const c of VENT_CASES.filter((c) => c.expected === 'acute')) {
      expect(classifyKeywordFloor(c.transcript), c.transcript).not.toBe('none');
    }
  });
});
