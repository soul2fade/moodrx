import { describe, it, expect } from 'vitest';
import { NO_VIOLENCE_GUARDRAIL } from '../lib/safety-guardrail';

describe('NO_VIOLENCE_GUARDRAIL', () => {
  it('names violence, weapons, and self-harm imagery and bans metaphor', () => {
    const g = NO_VIOLENCE_GUARDRAIL;
    expect(g).toContain('weapon');
    expect(g).toContain('self-harm imagery');
    expect(g.toLowerCase()).toContain('violence');
    expect(g.toLowerCase()).toContain('metaphor');
  });

  it('is a single non-trivial sentence-ish constant (no newlines that would break prompt structure)', () => {
    expect(NO_VIOLENCE_GUARDRAIL.length).toBeGreaterThan(80);
    expect(NO_VIOLENCE_GUARDRAIL).not.toContain('\n');
    expect(NO_VIOLENCE_GUARDRAIL).not.toContain('`');
  });
});
