import { describe, it, expect } from 'vitest';
import {
  classifyKeywordFloor,
  resolveRisk,
  validateAssessment,
  MOOD_KEYS,
  VENT_SYSTEM_PROMPT,
  ASSESS_TOOL,
} from '../lib/vent-grading';

describe('classifyKeywordFloor', () => {
  it('does NOT fire on hyperbole/frustration', () => {
    for (const t of [
      'this traffic is killing me',
      'my boss wants to kill me, I could scream',
      'I could die of embarrassment',
      "I'm so done with this job, I hate my life",
      'I am dead tired and everything sucks',
    ]) {
      expect(classifyKeywordFloor(t)).toBe('none');
    }
  });

  it('fires (elevated) on unambiguous self-harm phrasing', () => {
    for (const t of [
      'I want to kill myself',
      'I want to end my life',
      "I don't want to be alive anymore",
      'thinking about killing myself tonight',
    ]) {
      expect(classifyKeywordFloor(t)).toBe('elevated');
    }
  });

  it('is case- and whitespace-insensitive', () => {
    expect(classifyKeywordFloor('  I Want To KILL MYSELF  ')).toBe('elevated');
  });
});

describe('resolveRisk', () => {
  it('passes the model tier through when keyword floor is none', () => {
    expect(resolveRisk('none', 'none')).toBe('none');
    expect(resolveRisk('elevated', 'none')).toBe('elevated');
    expect(resolveRisk('acute', 'none')).toBe('acute');
  });

  it('raises none->elevated when the keyword net fires (model under-flagged)', () => {
    expect(resolveRisk('none', 'elevated')).toBe('elevated');
  });

  it('keyword net never downgrades or forces acute', () => {
    expect(resolveRisk('acute', 'elevated')).toBe('acute');
    expect(resolveRisk('elevated', 'elevated')).toBe('elevated');
  });
});

describe('validateAssessment', () => {
  const ok = { mood: 'stressed', intensity: 7, reply: 'You showed up. Noted.', risk: 'none' };

  it('accepts a well-formed assessment', () => {
    expect(validateAssessment(ok)).toEqual(ok);
  });

  it('exposes the 6 canonical mood keys', () => {
    expect(MOOD_KEYS).toEqual(['anxious', 'low', 'foggy', 'restless', 'stressed', 'good']);
  });

  it('rejects bad mood, out-of-range intensity, empty reply, bad risk', () => {
    expect(validateAssessment({ ...ok, mood: 'sad' })).toBeNull();
    expect(validateAssessment({ ...ok, intensity: 0 })).toBeNull();
    expect(validateAssessment({ ...ok, intensity: 11 })).toBeNull();
    expect(validateAssessment({ ...ok, reply: '   ' })).toBeNull();
    expect(validateAssessment({ ...ok, risk: 'panic' })).toBeNull();
    expect(validateAssessment(null)).toBeNull();
    expect(validateAssessment('nope')).toBeNull();
  });

  it('clamps/rounds intensity and trims reply', () => {
    const r = validateAssessment({ ...ok, intensity: 7.6, reply: '  hi  ' });
    expect(r).toEqual({ mood: 'stressed', intensity: 8, reply: 'hi', risk: 'none' });
  });
});

describe('prompt + tool schema', () => {
  it('tool enforces the 4 fields and the mood enum matches MOOD_KEYS', () => {
    const props = ASSESS_TOOL.input_schema.properties as Record<string, any>;
    expect(Object.keys(props).sort()).toEqual(['intensity', 'mood', 'reply', 'risk']);
    expect(props.mood.enum).toEqual([...MOOD_KEYS]);
    expect(props.risk.enum).toEqual(['none', 'elevated', 'acute']);
    expect(ASSESS_TOOL.input_schema.required.sort()).toEqual(['intensity', 'mood', 'reply', 'risk']);
  });

  it('system prompt anchors crisis calibration with both negative and positive examples', () => {
    const p = VENT_SYSTEM_PROMPT.toLowerCase();
    expect(p).toContain('hyperbole');
    expect(p).toContain('acute');
    expect(p).toContain('never');
  });
});
