import { describe, it, expect } from 'vitest';
import { coachSystemPrompt } from '../lib/coach-prompt';

describe('coachSystemPrompt', () => {
  it('crisis mode drops jokes and never adds the episode rule', () => {
    const p = coachSystemPrompt('roasting', true, true).toLowerCase();
    expect(p).toContain('distress');
    expect(p).toContain('drop the roasting');  // explicitly instructs no roasting
    expect(p).not.toContain('sharper');        // the roasting-tone block is absent
    expect(p).not.toContain('episode');        // no callbacks in crisis
  });

  it('adds an episode rule only when an episode is present', () => {
    const withEp = coachSystemPrompt('teasing', false, true).toLowerCase();
    const without = coachSystemPrompt('teasing', false, false).toLowerCase();
    expect(withEp).toContain('episode');
    expect(withEp).toContain('never invent');
    expect(without).not.toContain('episode');
  });

  it('reflects tone (teasing vs roasting) in the non-crisis prompt', () => {
    expect(coachSystemPrompt('roasting', false, false).toLowerCase()).toContain('sharper');
    expect(coachSystemPrompt('teasing', false, false).toLowerCase()).toContain('teasing');
  });
});
