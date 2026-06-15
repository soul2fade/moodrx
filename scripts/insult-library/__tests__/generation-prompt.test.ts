import { describe, it, expect } from 'vitest';
import { buildGenerationPrompt } from '../lib/generation-prompt';
import { TIERS } from '../lib/tiers';
import { NO_VIOLENCE_GUARDRAIL } from '../../../netlify/functions/lib/safety-guardrail';

const roast = TIERS.find((t) => t.key === 'roast')!;

describe('buildGenerationPrompt', () => {
  it('embeds the shared guardrail verbatim (cannot drift from the live surfaces)', () => {
    expect(buildGenerationPrompt(roast, 50, [])).toContain(NO_VIOLENCE_GUARDRAIL);
  });

  it('includes the tier guidance, the persona, and the requested count', () => {
    const p = buildGenerationPrompt(roast, 42, []);
    expect(p).toContain(roast.guidance);
    expect(p.toLowerCase()).toContain('dr. moodrx');
    expect(p).toContain('42');
  });

  it('passes an avoid-list of existing lines so re-runs add novelty', () => {
    const p = buildGenerationPrompt(roast, 10, ['Quit stalling.', 'Move it.']);
    expect(p).toContain('Quit stalling.');
    expect(p).toContain('Move it.');
    expect(p.toLowerCase()).toContain('avoid');
  });

  it('omits the avoid-list section entirely when there are no existing lines', () => {
    const p = buildGenerationPrompt(roast, 10, []);
    expect(p.toLowerCase()).not.toContain('avoid repeating');
  });
});
