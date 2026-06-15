/**
 * READ-ONLY RevenueCat catalog inspector. Mutates nothing — lists the current
 * offerings, packages, attached products, and entitlements so we can confirm
 * the new purchase-flow catalog (base unlock / voices / MoodRx+) is configured
 * before on-device verification.
 *
 * Auth: a RevenueCat **secret API key** (v2 REST). Create one in the dashboard:
 *   Project Settings -> API keys -> + New -> Secret API key  (starts with `sk_`)
 * Put it in `.env` as REVENUECAT_V2_SECRET_KEY=sk_... (gitignored), then run:
 *   npx tsx scripts/inspectRevenueCat.ts
 * (No Replit needed — this does NOT use the connector-based revenueCatClient.ts.)
 */
import { getRevenueCatSecretClient } from './rcSecretClient';
import {
  listProjects,
  listApps,
  listEntitlements,
  listOfferings,
  listPackages,
  listProducts,
  getProductsFromPackage,
  getProductsFromEntitlement,
} from '@replit/revenuecat-sdk';

const PROJECT_NAME = 'MoodRx';

// What the app code (lib/revenuecat.tsx, contexts/SubscriptionContext.tsx,
// lib/voices.ts) actually looks up — the verification target.
const EXPECTED = {
  offerings: ['default', 'packs', 'plus'],
  packagesByOffering: {
    default: ['$rc_lifetime'],
    packs: ['voice_deadpan', 'voice_grampa', 'voice_ruthie', 'voice_ed', 'voice_pack'],
    plus: ['$rc_monthly', '$rc_annual'],
  } as Record<string, string[]>,
  entitlements: ['premium', 'all_access', 'pack_voice_pack',
    'voice_deadpan', 'voice_grampa', 'voice_ruthie', 'voice_ed'],
};

function mark(have: boolean): string {
  return have ? 'OK ' : 'MISSING';
}

async function main() {
  const client = getRevenueCatSecretClient();

  const { data: projects, error: pErr } = await listProjects({ client, query: { limit: 20 } });
  if (pErr) throw new Error('listProjects: ' + JSON.stringify(pErr));
  const project = projects.items?.find((p) => p.name === PROJECT_NAME);
  if (!project) throw new Error(`Project "${PROJECT_NAME}" not found`);
  console.log(`Project: ${project.name} (${project.id})\n`);

  // ----- Apps -----
  const { data: apps } = await listApps({ client, path: { project_id: project.id }, query: { limit: 20 } });
  console.log('APPS:');
  for (const a of apps?.items ?? []) console.log(`  - ${a.type.padEnd(11)} ${a.id}`);
  console.log();

  // ----- Entitlements -----
  const { data: ents } = await listEntitlements({ client, path: { project_id: project.id }, query: { limit: 50 } });
  const entKeys = new Set((ents?.items ?? []).map((e) => e.lookup_key));
  console.log('ENTITLEMENTS (expected vs present):');
  for (const k of EXPECTED.entitlements) console.log(`  [${mark(entKeys.has(k))}] ${k}`);
  const extraEnts = [...entKeys].filter((k) => !EXPECTED.entitlements.includes(k));
  if (extraEnts.length) console.log(`  (other present: ${extraEnts.join(', ')})`);
  console.log();

  // For the live-coach gating decision: does the `plus`-granting entitlement
  // chain include `premium`? We check by listing products on each entitlement.
  console.log('PRODUCTS PER ENTITLEMENT:');
  for (const e of ents?.items ?? []) {
    const { data: ep } = await getProductsFromEntitlement({
      client, path: { project_id: project.id, entitlement_id: e.id }, query: { limit: 50 },
    });
    const ids = (ep?.items ?? []).map((p) => p.store_identifier).join(', ') || '(none)';
    console.log(`  ${e.lookup_key.padEnd(16)} <- ${ids}`);
  }
  console.log();

  // ----- Offerings + packages + attached products -----
  const { data: offs } = await listOfferings({ client, path: { project_id: project.id }, query: { limit: 50 } });
  const offByKey = new Map((offs?.items ?? []).map((o) => [o.lookup_key, o]));
  console.log('OFFERINGS / PACKAGES / PRODUCTS (expected vs present):');
  for (const offKey of EXPECTED.offerings) {
    const off = offByKey.get(offKey);
    console.log(`  [${mark(!!off)}] offering "${offKey}"${off?.is_current ? '  (current)' : ''}`);
    if (!off) continue;
    const { data: pkgs } = await listPackages({
      client, path: { project_id: project.id, offering_id: off.id }, query: { limit: 50 },
    });
    const pkgByKey = new Map((pkgs?.items ?? []).map((p) => [p.lookup_key, p]));
    for (const wantPkg of EXPECTED.packagesByOffering[offKey]) {
      const pkg = pkgByKey.get(wantPkg);
      if (!pkg) { console.log(`      [MISSING] package "${wantPkg}"`); continue; }
      const { data: pp } = await getProductsFromPackage({
        client, path: { project_id: project.id, package_id: pkg.id }, query: { limit: 50 },
      });
      const prods = (pp?.items ?? [])
        .map((a) => `${a.product.store_identifier}${a.product.type ? ` (${a.product.type})` : ''}`)
        .join(', ') || '(no products attached)';
      console.log(`      [OK ] package "${wantPkg}" -> ${prods}`);
    }
    const extraPkgs = [...pkgByKey.keys()].filter((k) => !EXPECTED.packagesByOffering[offKey].includes(k));
    if (extraPkgs.length) console.log(`      (other packages: ${extraPkgs.join(', ')})`);
  }
  const extraOffs = [...offByKey.keys()].filter((k) => !EXPECTED.offerings.includes(k));
  if (extraOffs.length) console.log(`  (other offerings present: ${extraOffs.join(', ')})`);
  console.log();

  // ----- All products (raw) -----
  const { data: prods } = await listProducts({ client, path: { project_id: project.id }, query: { limit: 200 } });
  console.log('ALL PRODUCTS (store_identifier — app — type):');
  for (const p of prods?.items ?? []) {
    const appType = apps?.items?.find((a) => a.id === p.app_id)?.type ?? p.app_id;
    console.log(`  - ${p.store_identifier.padEnd(28)} ${String(appType).padEnd(11)} ${p.type ?? ''}`);
  }
}

main().catch((err: unknown) => {
  console.error('Inspect failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
