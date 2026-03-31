import { getUncachableRevenueCatClient } from './revenueCatClient';

import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
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
  type Project,
  type Entitlement,
  type Offering,
  type Package,
  type CreateProductData,
} from '@replit/revenuecat-sdk';

const PROJECT_NAME = 'MoodRx';

const MONTHLY_IDENTIFIER = 'moodrx_monthly_699';
const MONTHLY_PLAY_IDENTIFIER = 'moodrx_monthly_699:monthly';
const MONTHLY_DISPLAY_NAME = 'MoodRx Pro Monthly';
const MONTHLY_TITLE = 'MoodRx Pro Monthly';

const YEARLY_IDENTIFIER = 'moodrx_yearly_4999';
const YEARLY_PLAY_IDENTIFIER = 'moodrx_yearly_4999:yearly';
const YEARLY_DISPLAY_NAME = 'MoodRx Pro Yearly';
const YEARLY_TITLE = 'MoodRx Pro Yearly';

const APP_STORE_APP_NAME = 'MoodRx iOS';
const APP_STORE_BUNDLE_ID = 'com.moodrx.app';
const PLAY_STORE_APP_NAME = 'MoodRx Android';
const PLAY_STORE_PACKAGE_NAME = 'com.moodrx.app';

const ENTITLEMENT_IDENTIFIER = 'premium';
const ENTITLEMENT_DISPLAY_NAME = 'Premium Access';

const OFFERING_IDENTIFIER = 'default';
const OFFERING_DISPLAY_NAME = 'Default Offering';

const MONTHLY_PACKAGE_IDENTIFIER = '$rc_monthly';
const MONTHLY_PACKAGE_DISPLAY_NAME = 'Monthly';

const YEARLY_PACKAGE_IDENTIFIER = '$rc_annual';
const YEARLY_PACKAGE_DISPLAY_NAME = 'Yearly';

const MONTHLY_PRICES = [
  { amount_micros: 6990000, currency: 'USD' },
];

const YEARLY_PRICES = [
  { amount_micros: 49990000, currency: 'USD' },
];

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  // ----- Project -----
  let project: Project;
  const { data: existingProjects, error: listProjectsError } = await listProjects({
    client,
    query: { limit: 20 },
  });
  if (listProjectsError) throw new Error('Failed to list projects: ' + JSON.stringify(listProjectsError));

  const existingProject = existingProjects.items?.find((p) => p.name === PROJECT_NAME);
  if (existingProject) {
    console.log('Project already exists:', existingProject.id);
    project = existingProject;
  } else {
    const { data: newProject, error } = await createProject({
      client,
      body: { name: PROJECT_NAME },
    });
    if (error) throw new Error('Failed to create project: ' + JSON.stringify(error));
    console.log('Created project:', newProject.id);
    project = newProject;
  }

  // ----- Apps -----
  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listAppsError || !apps || apps.items.length === 0) {
    throw new Error('No apps found');
  }

  let testStoreApp: App | undefined = apps.items.find((a) => a.type === 'test_store');
  let appStoreApp: App | undefined = apps.items.find((a) => a.type === 'app_store');
  let playStoreApp: App | undefined = apps.items.find((a) => a.type === 'play_store');

  if (!testStoreApp) throw new Error('No test store app found — RevenueCat should create one automatically');
  console.log('Test store app found:', testStoreApp.id);

  if (!appStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: APP_STORE_APP_NAME, type: 'app_store', app_store: { bundle_id: APP_STORE_BUNDLE_ID } },
    });
    if (error) throw new Error('Failed to create App Store app: ' + JSON.stringify(error));
    appStoreApp = newApp;
    console.log('Created App Store app:', appStoreApp.id);
  } else {
    console.log('App Store app found:', appStoreApp.id);
  }

  if (!playStoreApp) {
    const { data: newApp, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: { name: PLAY_STORE_APP_NAME, type: 'play_store', play_store: { package_name: PLAY_STORE_PACKAGE_NAME } },
    });
    if (error) throw new Error('Failed to create Play Store app: ' + JSON.stringify(error));
    playStoreApp = newApp;
    console.log('Created Play Store app:', playStoreApp.id);
  } else {
    console.log('Play Store app found:', playStoreApp.id);
  }

  // ----- Products -----
  const { data: existingProducts, error: listProductsError } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });
  if (listProductsError) throw new Error('Failed to list products');

  const ensureProduct = async (
    targetApp: App,
    label: string,
    storeId: string,
    displayName: string,
    title: string,
    duration: string,
    isTestStore: boolean
  ): Promise<Product> => {
    const existing = existingProducts.items?.find(
      (p) => p.store_identifier === storeId && p.app_id === targetApp.id
    );
    if (existing) {
      console.log(label + ' product already exists:', existing.id);
      return existing;
    }
    const body: CreateProductData['body'] = {
      store_identifier: storeId,
      app_id: targetApp.id,
      type: 'subscription',
      display_name: displayName,
    };
    if (isTestStore) {
      body.subscription = { duration };
      body.title = title;
    }
    const { data: created, error } = await createProduct({
      client,
      path: { project_id: project.id },
      body,
    });
    if (error) throw new Error('Failed to create ' + label + ' product: ' + JSON.stringify(error));
    console.log('Created ' + label + ' product:', created.id);
    return created;
  };

  // Monthly products
  const testMonthly = await ensureProduct(testStoreApp, 'Test/Monthly', MONTHLY_IDENTIFIER, MONTHLY_DISPLAY_NAME, MONTHLY_TITLE, 'P1M', true);
  const iosMonthly = await ensureProduct(appStoreApp, 'iOS/Monthly', MONTHLY_IDENTIFIER, MONTHLY_DISPLAY_NAME, MONTHLY_TITLE, 'P1M', false);
  const androidMonthly = await ensureProduct(playStoreApp, 'Android/Monthly', MONTHLY_PLAY_IDENTIFIER, MONTHLY_DISPLAY_NAME, MONTHLY_TITLE, 'P1M', false);

  // Yearly products
  const testYearly = await ensureProduct(testStoreApp, 'Test/Yearly', YEARLY_IDENTIFIER, YEARLY_DISPLAY_NAME, YEARLY_TITLE, 'P1Y', true);
  const iosYearly = await ensureProduct(appStoreApp, 'iOS/Yearly', YEARLY_IDENTIFIER, YEARLY_DISPLAY_NAME, YEARLY_TITLE, 'P1Y', false);
  const androidYearly = await ensureProduct(playStoreApp, 'Android/Yearly', YEARLY_PLAY_IDENTIFIER, YEARLY_DISPLAY_NAME, YEARLY_TITLE, 'P1Y', false);

  // ----- Test store prices -----
  const addPrices = async (productId: string, prices: typeof MONTHLY_PRICES, label: string) => {
    const { data: priceData, error: priceError } = await client.post<TestStorePricesResponse>({
      url: '/projects/{project_id}/products/{product_id}/test_store_prices',
      path: { project_id: project.id, product_id: productId },
      body: { prices },
    });
    if (priceError) {
      if (typeof priceError === 'object' && 'type' in priceError && (priceError as any).type === 'resource_already_exists') {
        console.log(label + ' test store prices already exist');
      } else {
        console.warn(label + ' price error (non-fatal):', JSON.stringify(priceError));
      }
    } else {
      console.log(label + ' test store prices added');
    }
  };

  await addPrices(testMonthly.id, MONTHLY_PRICES, 'Monthly');
  await addPrices(testYearly.id, YEARLY_PRICES, 'Yearly');

  // ----- Entitlement -----
  let entitlement: Entitlement | undefined;
  const { data: existingEntitlements, error: listEntitlementsError } = await listEntitlements({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listEntitlementsError) throw new Error('Failed to list entitlements');

  const existingEntitlement = existingEntitlements.items?.find((e) => e.lookup_key === ENTITLEMENT_IDENTIFIER);
  if (existingEntitlement) {
    console.log('Entitlement already exists:', existingEntitlement.id);
    entitlement = existingEntitlement;
  } else {
    const { data: newEnt, error } = await createEntitlement({
      client,
      path: { project_id: project.id },
      body: { lookup_key: ENTITLEMENT_IDENTIFIER, display_name: ENTITLEMENT_DISPLAY_NAME },
    });
    if (error) throw new Error('Failed to create entitlement: ' + JSON.stringify(error));
    console.log('Created entitlement:', newEnt.id);
    entitlement = newEnt;
  }

  const { error: attachEntErr } = await attachProductsToEntitlement({
    client,
    path: { project_id: project.id, entitlement_id: entitlement.id },
    body: {
      product_ids: [testMonthly.id, iosMonthly.id, androidMonthly.id, testYearly.id, iosYearly.id, androidYearly.id],
    },
  });
  if (attachEntErr) {
    if ((attachEntErr as any).type === 'unprocessable_entity_error') {
      console.log('Products already attached to entitlement');
    } else {
      throw new Error('Failed to attach products to entitlement: ' + JSON.stringify(attachEntErr));
    }
  } else {
    console.log('Attached all products to entitlement');
  }

  // ----- Offering -----
  let offering: Offering | undefined;
  const { data: existingOfferings, error: listOfferingsError } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listOfferingsError) throw new Error('Failed to list offerings');

  const existingOffering = existingOfferings.items?.find((o) => o.lookup_key === OFFERING_IDENTIFIER);
  if (existingOffering) {
    console.log('Offering already exists:', existingOffering.id);
    offering = existingOffering;
  } else {
    const { data: newOff, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: { lookup_key: OFFERING_IDENTIFIER, display_name: OFFERING_DISPLAY_NAME },
    });
    if (error) throw new Error('Failed to create offering: ' + JSON.stringify(error));
    console.log('Created offering:', newOff.id);
    offering = newOff;
  }

  if (!offering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error('Failed to set offering as current');
    console.log('Set offering as current');
  }

  // ----- Packages -----
  const { data: existingPackages, error: listPkgError } = await listPackages({
    client,
    path: { project_id: project.id, offering_id: offering.id },
    query: { limit: 20 },
  });
  if (listPkgError) throw new Error('Failed to list packages');

  const ensurePackage = async (lookupKey: string, displayName: string): Promise<Package> => {
    const existing = existingPackages.items?.find((p) => p.lookup_key === lookupKey);
    if (existing) {
      console.log('Package already exists:', existing.id, lookupKey);
      return existing;
    }
    const { data: newPkg, error } = await createPackages({
      client,
      path: { project_id: project.id, offering_id: offering!.id },
      body: { lookup_key: lookupKey, display_name: displayName },
    });
    if (error) throw new Error('Failed to create package ' + lookupKey + ': ' + JSON.stringify(error));
    console.log('Created package:', newPkg.id, lookupKey);
    return newPkg;
  };

  const monthlyPkg = await ensurePackage(MONTHLY_PACKAGE_IDENTIFIER, MONTHLY_PACKAGE_DISPLAY_NAME);
  const yearlyPkg = await ensurePackage(YEARLY_PACKAGE_IDENTIFIER, YEARLY_PACKAGE_DISPLAY_NAME);

  // Attach products to monthly package
  const { error: attachMonthlyErr } = await attachProductsToPackage({
    client,
    path: { project_id: project.id, package_id: monthlyPkg.id },
    body: {
      products: [
        { product_id: testMonthly.id, eligibility_criteria: 'all' },
        { product_id: iosMonthly.id, eligibility_criteria: 'all' },
        { product_id: androidMonthly.id, eligibility_criteria: 'all' },
      ],
    },
  });
  if (attachMonthlyErr) {
    if ((attachMonthlyErr as any).type === 'unprocessable_entity_error') {
      console.log('Monthly products already attached to package');
    } else {
      throw new Error('Failed to attach monthly products to package: ' + JSON.stringify(attachMonthlyErr));
    }
  } else {
    console.log('Attached monthly products to package');
  }

  // Attach products to yearly package
  const { error: attachYearlyErr } = await attachProductsToPackage({
    client,
    path: { project_id: project.id, package_id: yearlyPkg.id },
    body: {
      products: [
        { product_id: testYearly.id, eligibility_criteria: 'all' },
        { product_id: iosYearly.id, eligibility_criteria: 'all' },
        { product_id: androidYearly.id, eligibility_criteria: 'all' },
      ],
    },
  });
  if (attachYearlyErr) {
    if ((attachYearlyErr as any).type === 'unprocessable_entity_error') {
      console.log('Yearly products already attached to package');
    } else {
      throw new Error('Failed to attach yearly products to package: ' + JSON.stringify(attachYearlyErr));
    }
  } else {
    console.log('Attached yearly products to package');
  }

  // ----- Print API Keys -----
  const { data: testKeys, error: testKeysErr } = await listAppPublicApiKeys({
    client,
    path: { project_id: project.id, app_id: testStoreApp.id },
  });
  if (testKeysErr) throw new Error('Failed to get test store API keys');

  const { data: iosKeys, error: iosKeysErr } = await listAppPublicApiKeys({
    client,
    path: { project_id: project.id, app_id: appStoreApp.id },
  });
  if (iosKeysErr) throw new Error('Failed to get iOS API keys');

  const { data: androidKeys, error: androidKeysErr } = await listAppPublicApiKeys({
    client,
    path: { project_id: project.id, app_id: playStoreApp.id },
  });
  if (androidKeysErr) throw new Error('Failed to get Android API keys');

  console.log('\n====================');
  console.log('RevenueCat setup complete!');
  console.log('Project ID:', project.id);
  console.log('Test Store App ID:', testStoreApp.id);
  console.log('App Store App ID:', appStoreApp.id);
  console.log('Play Store App ID:', playStoreApp.id);
  console.log('Entitlement Identifier:', ENTITLEMENT_IDENTIFIER);
  console.log('EXPO_PUBLIC_REVENUECAT_TEST_API_KEY:', testKeys?.items.map((k) => k.key).join(', ') ?? 'N/A');
  console.log('EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:', iosKeys?.items.map((k) => k.key).join(', ') ?? 'N/A');
  console.log('EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY:', androidKeys?.items.map((k) => k.key).join(', ') ?? 'N/A');
  console.log('====================\n');
}

seedRevenueCat().catch((err) => {
  console.error('Seed failed:', err?.message ?? err);
  process.exit(1);
});
