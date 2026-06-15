/**
 * One-off: verify the deployed coach-line function's SUCCESS path end-to-end
 * WITHOUT a device. Grants `premium` to a throwaway RC customer, POSTs a
 * realistic context to the live function, asserts a 200 + line, then revokes
 * the grant. The function gates on `premium` via RC's REST API — it doesn't
 * care that the entitlement came from a promo grant rather than a purchase.
 *
 *   npx tsx scripts/verifyCoachLine.ts
 */
import { getRevenueCatSecretClient } from './rcSecretClient';
import {
  listProjects,
  listEntitlements,
  createCustomer,
  grantCustomerEntitlement,
  revokeCustomerGrantedEntitlement,
} from '@replit/revenuecat-sdk';

const PROJECT_NAME = 'MoodRx';
const COACH_ENDPOINT = 'https://moodrx-api.netlify.app/.netlify/functions/coach-line';
const TEST_USER = 'coach-verify-' + 'local'; // stable id so re-runs reuse the customer

// A realistic post-workout context (mirrors lib/coach-insight buildCoachContext
// output closely enough for the model; the function only requires it be truthy).
const context = {
  mood: 'anxious',
  intensity: 6,
  workout: 'a 20-minute walk',
  crisis: false,
  episode: false,
  history: { sessions: 12, streak: 3, bestForMood: 'a walk' },
};
const tone = 'sticks'; // Sticks and Stones (default trash-talk severity)

async function main() {
  const client = getRevenueCatSecretClient();

  const { data: projects } = await listProjects({ client, query: { limit: 20 } });
  const project = projects?.items?.find((p) => p.name === PROJECT_NAME);
  if (!project) throw new Error('Project not found');

  const { data: ents } = await listEntitlements({ client, path: { project_id: project.id }, query: { limit: 50 } });
  const premium = ents?.items?.find((e) => e.lookup_key === 'premium');
  if (!premium) throw new Error('premium entitlement not found');

  // Ensure the customer exists (ignore already-exists).
  const { error: custErr } = await createCustomer({
    client, path: { project_id: project.id }, body: { id: TEST_USER },
  });
  if (custErr && !(typeof custErr === 'object' && custErr !== null && 'type' in custErr && (custErr as any).type === 'resource_already_exists')) {
    console.warn('createCustomer warn:', JSON.stringify(custErr));
  }

  // Grant premium for 1 hour.
  const expires_at = Date.now() + 60 * 60 * 1000;
  const { error: grantErr } = await grantCustomerEntitlement({
    client,
    path: { project_id: project.id, customer_id: TEST_USER },
    body: { entitlement_id: premium.id, expires_at },
  });
  if (grantErr) throw new Error('grant failed: ' + JSON.stringify(grantErr));
  console.log(`Granted premium to "${TEST_USER}" (expires in 1h).`);

  // RC propagation can lag a beat; retry the call a few times.
  let status = 0;
  let line: string | null = null;
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(COACH_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context, tone, appUserId: TEST_USER }),
    });
    status = res.status;
    if (res.ok) {
      const data = (await res.json()) as { line?: string };
      line = data.line ?? null;
      break;
    }
    console.log(`  attempt ${attempt}: HTTP ${status} — retrying in 1.5s…`);
    await new Promise((r) => setTimeout(r, 1500));
  }

  console.log('\n========================================');
  if (status === 200 && line) {
    console.log('✅ LIVE COACH SUCCESS PATH WORKS');
    console.log('Dr. MoodRx says:\n  "' + line + '"');
  } else {
    console.log(`❌ Coach line did not return 200 (last status ${status}).`);
    console.log('   403 = entitlement not seen, 500 = missing fn env, 502 = Anthropic error.');
  }
  console.log('========================================\n');

  // Cleanup: revoke the promo grant.
  const { error: revokeErr } = await revokeCustomerGrantedEntitlement({
    client,
    path: { project_id: project.id, customer_id: TEST_USER },
    body: { entitlement_id: premium.id },
  });
  console.log(revokeErr ? 'revoke warn: ' + JSON.stringify(revokeErr) : 'Revoked the test grant (cleanup done).');
}

main().catch((err: unknown) => {
  console.error('verifyCoachLine failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
