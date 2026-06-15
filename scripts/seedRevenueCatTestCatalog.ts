/**
 * Seed the NEW purchase-flow catalog into the RevenueCat **Test Store** so the
 * base unlock / à la carte voices / MoodRx+ flows can be verified on the local
 * debug build (no EAS build, no real store products needed).
 *
 * Idempotent and non-destructive: it only creates what's missing and leaves the
 * existing `default` subscriptions alone. Auth: a secret key in .env
 * (REVENUECAT_V2_SECRET_KEY=sk_...) — see scripts/rcSecretClient.ts.
 *
 *   npx tsx scripts/seedRevenueCatTestCatalog.ts
 *
 * NOT handled here (separate real-release punch-list items, store-side only):
 *   - App Store Connect / Google Play products mirroring these identifiers.
 *   - The MoodRx+ 7-day free trial — a real-store intro offer (ASC/Play); the
 *     Test Store can't simulate trial timing. Test-store verification confirms
 *     the sub GRANTS all_access+premium; trial UX is validated on a store build.
 */
import { getRevenueCatSecretClient } from './rcSecretClient';
import {
  listProjects,
  listApps,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
  type Duration,
  type ProductType,
} from '@replit/revenuecat-sdk';

const PROJECT_NAME = 'MoodRx';

const PRICES_MICROS = {
  base: 9_990_000,
  voice: 990_000,
  voicePack: 2_990_000,
  plusMonthly: 3_990_000,
  plusAnnual: 24_990_000,
};

const VOICE_NAMES = ['deadpan', 'grampa', 'ruthie', 'ed'] as const;

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
  const testApp = apps?.items?.find((a) => a.type === 'test_store');
  if (!testApp) throw new Error('No test_store app found in project');
  console.log(`Test Store app: ${testApp.id}\n`);

  // ---------- Entitlements ----------
  const { data: existingEnts } = await listEntitlements({ client, path: { project_id: project.id }, query: { limit: 100 } });
  const entByKey = new Map<string, Entitlement>((existingEnts?.items ?? []).map((e) => [e.lookup_key, e]));

  const ensureEntitlement = async (lookupKey: string, displayName: string): Promise<Entitlement> => {
    const existing = entByKey.get(lookupKey);
    if (existing) { console.log(`  entitlement ok: ${lookupKey}`); return existing; }
    const { data, error } = await createEntitlement({
      client, path: { project_id: project.id }, body: { lookup_key: lookupKey, display_name: displayName },
    });
    if (error || !data) throw new Error(`createEntitlement ${lookupKey}: ` + JSON.stringify(error));
    console.log(`  entitlement CREATED: ${lookupKey}`);
    entByKey.set(lookupKey, data);
    return data;
  };

  console.log('Entitlements:');
  const entPremium = await ensureEntitlement('premium', 'Premium Access');
  const entAllAccess = await ensureEntitlement('all_access', 'MoodRx+ All Access');
  const entVoicePack = await ensureEntitlement('pack_voice_pack', 'All Coach Voices');
  const entVoice: Record<string, Entitlement> = {};
  for (const v of VOICE_NAMES) entVoice[v] = await ensureEntitlement(`voice_${v}`, `Voice: ${v}`);

  // ---------- Products (Test Store) ----------
  const { data: existingProducts } = await listProducts({ client, path: { project_id: project.id }, query: { limit: 200 } });
  const prodByStoreId = new Map<string, Product>(
    (existingProducts?.items ?? []).filter((p) => p.app_id === testApp.id).map((p) => [p.store_identifier, p]),
  );

  const ensureProduct = async (
    storeId: string, type: ProductType, title: string, duration?: Duration,
  ): Promise<Product> => {
    const existing = prodByStoreId.get(storeId);
    if (existing) { console.log(`  product ok: ${storeId}`); return existing; }
    const body: CreateProductData['body'] = {
      store_identifier: storeId,
      app_id: testApp.id,
      type,
      display_name: title,
      title, // required for Test Store products
    };
    if (type === 'subscription' && duration) body.subscription = { duration };
    const { data, error } = await createProduct({ client, path: { project_id: project.id }, body });
    if (error || !data) throw new Error(`createProduct ${storeId}: ` + JSON.stringify(error));
    console.log(`  product CREATED: ${storeId} (${type})`);
    prodByStoreId.set(storeId, data);
    return data;
  };

  const addPrice = async (product: Product, amount_micros: number) => {
    const { error } = await client.post({
      url: '/projects/{project_id}/products/{product_id}/test_store_prices',
      path: { project_id: project.id, product_id: product.id },
      body: { prices: [{ amount_micros, currency: 'USD' }] },
    });
    if (error) {
      if (hasType(error) && error.type === 'resource_already_exists') console.log(`    price ok: ${product.store_identifier}`);
      else console.warn(`    price WARN ${product.store_identifier}: ` + JSON.stringify(error));
    } else {
      console.log(`    price set: ${product.store_identifier} = $${(amount_micros / 1_000_000).toFixed(2)}`);
    }
  };

  console.log('\nProducts (Test Store):');
  // Mirror the existing real-store base product id so the test product joins the
  // already-configured `$rc_lifetime` package + `premium` entitlement.
  const pBase = await ensureProduct('moodrx_pro_lifetime', 'non_consumable', 'MoodRx — Lifetime Unlock');
  await addPrice(pBase, PRICES_MICROS.base);

  const pVoice: Record<string, Product> = {};
  for (const v of VOICE_NAMES) {
    pVoice[v] = await ensureProduct(`voice_${v}`, 'non_consumable', `Coach Voice: ${v}`);
    await addPrice(pVoice[v], PRICES_MICROS.voice);
  }
  const pVoicePack = await ensureProduct('voice_pack', 'non_consumable', 'All Coach Voices');
  await addPrice(pVoicePack, PRICES_MICROS.voicePack);

  const pPlusMonthly = await ensureProduct('moodrx_plus_monthly', 'subscription', 'MoodRx+ Monthly', 'P1M');
  await addPrice(pPlusMonthly, PRICES_MICROS.plusMonthly);
  const pPlusAnnual = await ensureProduct('moodrx_plus_annual', 'subscription', 'MoodRx+ Annual', 'P1Y');
  await addPrice(pPlusAnnual, PRICES_MICROS.plusAnnual);

  // ---------- Attach products → entitlements ----------
  const attachEnt = async (ent: Entitlement, products: Product[], label: string) => {
    const { error } = await attachProductsToEntitlement({
      client, path: { project_id: project.id, entitlement_id: ent.id },
      body: { product_ids: products.map((p) => p.id) },
    });
    if (error) {
      if (hasType(error) && error.type === 'unprocessable_entity_error') console.log(`  ent attach ok (already): ${label}`);
      else throw new Error(`attach ${label}: ` + JSON.stringify(error));
    } else {
      console.log(`  ent attached: ${label}`);
    }
  };

  console.log('\nEntitlement grants:');
  // MoodRx+ subs grant BOTH all_access AND premium (so the premium-gated live
  // coach works for MoodRx+ subscribers). The base unlock grants premium.
  await attachEnt(entPremium, [pBase, pPlusMonthly, pPlusAnnual], 'premium ← base + plus subs');
  await attachEnt(entAllAccess, [pPlusMonthly, pPlusAnnual], 'all_access ← plus subs');
  await attachEnt(entVoicePack, [pVoicePack], 'pack_voice_pack ← voice_pack');
  for (const v of VOICE_NAMES) await attachEnt(entVoice[v], [pVoice[v]], `voice_${v} ← voice_${v}`);

  // ---------- Offerings ----------
  const { data: existingOffs } = await listOfferings({ client, path: { project_id: project.id }, query: { limit: 50 } });
  const offByKey = new Map<string, Offering>((existingOffs?.items ?? []).map((o) => [o.lookup_key, o]));

  const ensureOffering = async (lookupKey: string, displayName: string, makeCurrent: boolean): Promise<Offering> => {
    let off = offByKey.get(lookupKey);
    if (!off) {
      const { data, error } = await createOffering({
        client, path: { project_id: project.id }, body: { lookup_key: lookupKey, display_name: displayName },
      });
      if (error || !data) throw new Error(`createOffering ${lookupKey}: ` + JSON.stringify(error));
      console.log(`  offering CREATED: ${lookupKey}`);
      off = data;
      offByKey.set(lookupKey, data);
    } else {
      console.log(`  offering ok: ${lookupKey}`);
    }
    if (makeCurrent && !off.is_current) {
      const { error } = await updateOffering({
        client, path: { project_id: project.id, offering_id: off.id }, body: { is_current: true },
      });
      if (error) throw new Error(`set current ${lookupKey}: ` + JSON.stringify(error));
      console.log(`    set current: ${lookupKey}`);
    }
    return off;
  };

  console.log('\nOfferings:');
  const offDefault = await ensureOffering('default', 'Default Offering', true);
  const offPacks = await ensureOffering('packs', 'Packs', false);
  const offPlus = await ensureOffering('plus', 'MoodRx+', false);

  // ---------- Packages + attach products ----------
  const ensurePackage = async (offering: Offering, lookupKey: string, displayName: string, product: Product) => {
    const { data: pkgs } = await listPackages({
      client, path: { project_id: project.id, offering_id: offering.id }, query: { limit: 50 },
    });
    let pkg: Package | undefined = pkgs?.items?.find((p) => p.lookup_key === lookupKey);
    if (!pkg) {
      const { data, error } = await createPackages({
        client, path: { project_id: project.id, offering_id: offering.id },
        body: { lookup_key: lookupKey, display_name: displayName },
      });
      if (error || !data) throw new Error(`createPackage ${lookupKey}: ` + JSON.stringify(error));
      console.log(`  package CREATED: ${offering.lookup_key}/${lookupKey}`);
      pkg = data;
    } else {
      console.log(`  package ok: ${offering.lookup_key}/${lookupKey}`);
    }
    const { error } = await attachProductsToPackage({
      client, path: { project_id: project.id, package_id: pkg.id },
      body: { products: [{ product_id: product.id, eligibility_criteria: 'all' as const }] },
    });
    if (error) {
      if (hasType(error) && error.type === 'unprocessable_entity_error') console.log(`    pkg attach ok (already): ${lookupKey}`);
      else throw new Error(`attach pkg ${lookupKey}: ` + JSON.stringify(error));
    } else {
      console.log(`    pkg attached: ${lookupKey} ← ${product.store_identifier}`);
    }
  };

  console.log('\nPackages:');
  await ensurePackage(offDefault, '$rc_lifetime', 'Lifetime Unlock', pBase);
  for (const v of VOICE_NAMES) await ensurePackage(offPacks, `voice_${v}`, `Voice: ${v}`, pVoice[v]);
  await ensurePackage(offPacks, 'voice_pack', 'All Voices', pVoicePack);
  await ensurePackage(offPlus, '$rc_monthly', 'Monthly', pPlusMonthly);
  await ensurePackage(offPlus, '$rc_annual', 'Annual', pPlusAnnual);

  console.log('\n✅ Test Store catalog seeded. Run `npx tsx scripts/inspectRevenueCat.ts` to verify.');
}

main().catch((err: unknown) => {
  console.error('Seed failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
