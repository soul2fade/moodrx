/**
 * Wire the two MoodRx+ subscriptions into RevenueCat for the **production**
 * stores (App Store + Google Play). The products were just created in App Store
 * Connect and Google Play; in RC they previously existed only for the Test Store
 * (see scripts/seedRevenueCatTestCatalog.ts). This script creates the real
 * app_store + play_store RC products and wires them into entitlements + the
 * `plus` offering's packages.
 *
 * Idempotent and non-destructive: it only creates/attaches what's missing.
 * `attachProductsTo*` is additive, so the existing Test-Store + base products on
 * `premium`/`all_access`/the packages are left intact. Auth: a secret key in
 * .env (REVENUECAT_V2_SECRET_KEY=sk_...) — see scripts/rcSecretClient.ts.
 *
 *   npx tsx scripts/seedRevenueCatProductionSubs.ts
 *
 * What it wires (production SKUs):
 *   app_store  : moodrx_plus_monthly         , moodrx_plus_annual          (subscription)
 *   play_store : moodrx_plus_monthly:monthly , moodrx_plus_annual:annual   (subscription)
 *
 *   premium      <- all 4 (the live-coach fix: coach-line.ts gates on `premium`)
 *   all_access   <- all 4 (MoodRx+ = everything)
 *   plus/$rc_monthly <- app_store moodrx_plus_monthly + play_store ...:monthly
 *   plus/$rc_annual  <- app_store moodrx_plus_annual  + play_store ...:annual
 *
 * NOTE: production app_store/play_store products take NO `subscription.duration`
 * (that input is "only supported for simulated store products") and NO price —
 * RC reads duration + price from the actual store listing. The 7-day free trial
 * is configured store-side (ASC/Play intro offer), not in RC.
 */
import { getRevenueCatSecretClient } from './rcSecretClient';
import {
  listProjects,
  listApps,
  listProducts,
  createProduct,
  listEntitlements,
  attachProductsToEntitlement,
  listOfferings,
  listPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Entitlement,
  type Offering,
  type Package,
} from '@replit/revenuecat-sdk';

const PROJECT_NAME = 'MoodRx';

function hasType(err: unknown): err is { type: string } {
  return typeof err === 'object' && err !== null && 'type' in err && typeof (err as { type: unknown }).type === 'string';
}

async function main() {
  const client = getRevenueCatSecretClient();

  const { data: projects, error: pErr } = await listProjects({ client, query: { limit: 20 } });
  if (pErr) throw new Error('listProjects: ' + JSON.stringify(pErr));
  const project = projects.items?.find((p) => p.name === PROJECT_NAME);
  if (!project) throw new Error(`Project "${PROJECT_NAME}" not found`);
  console.log(`Project: ${project.name} (${project.id})`);

  const { data: apps } = await listApps({ client, path: { project_id: project.id }, query: { limit: 20 } });
  const appStore = apps?.items?.find((a) => a.type === 'app_store');
  const playStore = apps?.items?.find((a) => a.type === 'play_store');
  if (!appStore) throw new Error('No app_store app found in project');
  if (!playStore) throw new Error('No play_store app found in project');
  console.log(`App Store app:  ${appStore.id}`);
  console.log(`Play Store app: ${playStore.id}\n`);

  // ---------- Products (per-app: map of "appId|storeId" -> Product) ----------
  const { data: existingProducts } = await listProducts({ client, path: { project_id: project.id }, query: { limit: 200 } });
  const prodByKey = new Map<string, Product>(
    (existingProducts?.items ?? []).map((p) => [`${p.app_id}|${p.store_identifier}`, p]),
  );

  const ensureProduct = async (app: App, storeId: string, displayName: string): Promise<Product> => {
    const key = `${app.id}|${storeId}`;
    const existing = prodByKey.get(key);
    if (existing) { console.log(`  product ok: ${app.type}/${storeId}`); return existing; }
    // Production store products: no `subscription.duration`, no price, no title —
    // RC pulls those from the live store listing.
    const { data, error } = await createProduct({
      client, path: { project_id: project.id },
      body: { store_identifier: storeId, app_id: app.id, type: 'subscription', display_name: displayName },
    });
    if (error || !data) throw new Error(`createProduct ${app.type}/${storeId}: ` + JSON.stringify(error));
    console.log(`  product CREATED: ${app.type}/${storeId} (subscription)`);
    prodByKey.set(key, data);
    return data;
  };

  console.log('Products (production stores):');
  const asMonthly = await ensureProduct(appStore, 'moodrx_plus_monthly', 'MoodRx+ Monthly');
  const asAnnual = await ensureProduct(appStore, 'moodrx_plus_annual', 'MoodRx+ Annual');
  const psMonthly = await ensureProduct(playStore, 'moodrx_plus_monthly:monthly', 'MoodRx+ Monthly');
  const psAnnual = await ensureProduct(playStore, 'moodrx_plus_annual:annual', 'MoodRx+ Annual');

  const allMonthly = [asMonthly, psMonthly];
  const allAnnual = [asAnnual, psAnnual];
  const allFour = [...allMonthly, ...allAnnual];

  // ---------- Attach products -> entitlements (additive) ----------
  const { data: existingEnts } = await listEntitlements({ client, path: { project_id: project.id }, query: { limit: 100 } });
  const entByKey = new Map<string, Entitlement>((existingEnts?.items ?? []).map((e) => [e.lookup_key, e]));
  const getEnt = (lookupKey: string): Entitlement => {
    const e = entByKey.get(lookupKey);
    if (!e) throw new Error(`Entitlement "${lookupKey}" not found (expected to already exist)`);
    return e;
  };

  // Attach one product at a time so an already-attached member of the set
  // doesn't block a genuinely-new one (the API errors on the whole batch).
  const attachEnt = async (ent: Entitlement, products: Product[], label: string) => {
    for (const product of products) {
      const { error } = await attachProductsToEntitlement({
        client, path: { project_id: project.id, entitlement_id: ent.id },
        body: { product_ids: [product.id] },
      });
      const tag = `${label}: ${product.store_identifier}`;
      if (error) {
        if (hasType(error) && error.type === 'unprocessable_entity_error') console.log(`  ent attach ok (already): ${tag}`);
        else throw new Error(`attach ${tag}: ` + JSON.stringify(error));
      } else {
        console.log(`  ent attached: ${tag}`);
      }
    }
  };

  console.log('\nEntitlement grants:');
  // premium too (not just all_access): the live coach (coach-line.ts isEntitled)
  // checks `premium` server-side, so a MoodRx+ subscriber must satisfy it.
  await attachEnt(getEnt('premium'), allFour, 'premium <- 4 production plus subs');
  await attachEnt(getEnt('all_access'), allFour, 'all_access <- 4 production plus subs');

  // ---------- Attach products -> plus offering packages (additive) ----------
  const { data: existingOffs } = await listOfferings({ client, path: { project_id: project.id }, query: { limit: 50 } });
  const offPlus = (existingOffs?.items ?? []).find((o: Offering) => o.lookup_key === 'plus');
  if (!offPlus) throw new Error('Offering "plus" not found (expected to already exist)');

  const { data: pkgs } = await listPackages({
    client, path: { project_id: project.id, offering_id: offPlus.id }, query: { limit: 50 },
  });
  const pkgByKey = new Map<string, Package>((pkgs?.items ?? []).map((p) => [p.lookup_key, p]));
  const getPkg = (lookupKey: string): Package => {
    const p = pkgByKey.get(lookupKey);
    if (!p) throw new Error(`Package "plus/${lookupKey}" not found (expected to already exist)`);
    return p;
  };

  const attachPkg = async (pkg: Package, products: Product[], label: string) => {
    for (const product of products) {
      const { error } = await attachProductsToPackage({
        client, path: { project_id: project.id, package_id: pkg.id },
        body: { products: [{ product_id: product.id, eligibility_criteria: 'all' as const }] },
      });
      const tag = `${label}: ${product.store_identifier}`;
      if (error) {
        if (hasType(error) && error.type === 'unprocessable_entity_error') console.log(`  pkg attach ok (already): ${tag}`);
        else throw new Error(`attach pkg ${tag}: ` + JSON.stringify(error));
      } else {
        console.log(`  pkg attached: ${tag}`);
      }
    }
  };

  console.log('\nPackages (plus offering):');
  await attachPkg(getPkg('$rc_monthly'), allMonthly, '$rc_monthly <- app_store + play_store monthly');
  await attachPkg(getPkg('$rc_annual'), allAnnual, '$rc_annual <- app_store + play_store annual');

  console.log('\n✅ Production MoodRx+ subs wired. Run `npx tsx scripts/inspectRevenueCat.ts` to verify.');
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
