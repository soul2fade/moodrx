/**
 * RevenueCat v2 management client authed by a plain **secret API key** (`sk_…`).
 * This is the non-Replit path: the repo's revenueCatClient.ts uses a Replit
 * connector, but this project isn't on Replit. Create a Secret API key in the
 * dashboard (Project Settings → API keys → + New → Secret) and put it in `.env`:
 *   REVENUECAT_V2_SECRET_KEY=sk_...
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@replit/revenuecat-sdk/client';

/** Read the secret key from the environment, falling back to a manual parse of
 *  .env (no dotenv dependency in this project). */
export function resolveSecretKey(): string {
  const fromEnv =
    process.env.REVENUECAT_V2_SECRET_KEY ||
    process.env.REVENUECAT_SECRET_KEY ||
    process.env.REVENUECAT_V2_API_KEY;
  if (fromEnv) return fromEnv;
  try {
    const text = readFileSync(join(process.cwd(), '.env'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*(REVENUECAT_V2_SECRET_KEY|REVENUECAT_SECRET_KEY|REVENUECAT_V2_API_KEY)\s*=\s*(.+?)\s*$/);
      if (m) return m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* no .env file — fall through */
  }
  throw new Error(
    'No RevenueCat secret key. Add REVENUECAT_V2_SECRET_KEY=sk_... to .env ' +
    '(Dashboard → Project Settings → API keys → + New → Secret API key).',
  );
}

export function getRevenueCatSecretClient() {
  return createClient({
    baseUrl: 'https://api.revenuecat.com/v2',
    headers: { Authorization: 'Bearer ' + resolveSecretKey() },
  });
}
