import { describe, it, expect } from 'vitest';
import { coachSystemPrompt } from '../lib/coach-prompt';

describe('coachSystemPrompt', () => {
  it('crisis mode drops jokes and never adds the episode rule', () => {
    const p = coachSystemPrompt('roast', true, true).toLowerCase();
    expect(p).toContain('distress');
    expect(p).toContain('drop the roasting');
    expect(p).not.toContain('sharper');
    expect(p).not.toContain('episode');
  });

  it('adds an episode rule only when an episode is present', () => {
    const withEp = coachSystemPrompt('sticks', false, true).toLowerCase();
    const without = coachSystemPrompt('sticks', false, false).toLowerCase();
    expect(withEp).toContain('episode');
    expect(withEp).toContain('never invent');
    expect(without).not.toContain('episode');
  });

  it('renders three distinct intensities for the three tones', () => {
    const glass = coachSystemPrompt('glass-house', false, false).toLowerCase();
    const sticks = coachSystemPrompt('sticks', false, false).toLowerCase();
    const roast = coachSystemPrompt('roast', false, false).toLowerCase();
    expect(roast).toContain('sharper');   // sharpest
    expect(sticks).toContain('teasing');  // standard
    expect(glass).toContain('gentle');    // softest
    expect(glass).not.toContain('sharper');
    expect(new Set([glass, sticks, roast]).size).toBe(3);
  });

  it('tolerates legacy teasing/roasting + unknown tones (older app builds)', () => {
    expect(coachSystemPrompt('teasing', false, false)).toBe(coachSystemPrompt('sticks', false, false));
    expect(coachSystemPrompt('roasting', false, false)).toBe(coachSystemPrompt('roast', false, false));
    expect(coachSystemPrompt('whatever', false, false)).toBe(coachSystemPrompt('sticks', false, false));
  });

  it('forbids violence/weapon/self-harm imagery in every non-crisis tone', () => {
    for (const t of ['glass-house', 'sticks', 'roast']) {
      expect(coachSystemPrompt(t, false, false).toLowerCase()).toContain('weapon');
    }
  });
});
