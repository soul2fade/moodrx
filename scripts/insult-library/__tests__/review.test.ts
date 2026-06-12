import { describe, it, expect } from 'vitest';
import { mergeCandidates, selectApproved, type ReviewEntry } from '../lib/review';

describe('mergeCandidates', () => {
  it('adds new candidates as pending with stable ids', () => {
    const merged = mergeCandidates([], ['Get up.', 'Move it.']);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ text: 'Get up.', status: 'pending' });
    expect(merged[0].id).toMatch(/^[0-9a-f]{12}$/);
  });

  it('never duplicates an existing line and never resets its review status', () => {
    const existing: ReviewEntry[] = [{ id: 'x', text: 'Get up.', status: 'rejected' }];
    const merged = mergeCandidates(existing, ['get UP!', 'Move it.']);
    expect(merged).toHaveLength(2); // 'get UP!' is a dup of 'Get up.' → skipped
    expect(merged.find((e) => e.text === 'Get up.')!.status).toBe('rejected');
    expect(merged.find((e) => e.text === 'Move it.')!.status).toBe('pending');
  });
});

describe('selectApproved', () => {
  it('returns only approved entries, in order', () => {
    const entries: ReviewEntry[] = [
      { id: 'a', text: 'one', status: 'approved' },
      { id: 'b', text: 'two', status: 'pending' },
      { id: 'c', text: 'three', status: 'rejected' },
      { id: 'd', text: 'four', status: 'approved' },
    ];
    expect(selectApproved(entries).map((e) => e.text)).toEqual(['one', 'four']);
  });
});
