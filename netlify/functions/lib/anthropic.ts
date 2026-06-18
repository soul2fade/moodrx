import Anthropic from '@anthropic-ai/sdk';

/** Construct an Anthropic client pinned to the real API host.
 *
 *  Netlify's AI Gateway extension injects ANTHROPIC_BASE_URL into the function
 *  runtime; the SDK auto-reads it and would route our key through the gateway
 *  proxy (→ 401). Pinning baseURL here bypasses that. Single source of truth so
 *  the pin can't drift between the vent and coach functions. */
export function makeAnthropic(apiKey: string | undefined): Anthropic {
  return new Anthropic({ apiKey, baseURL: 'https://api.anthropic.com' });
}
