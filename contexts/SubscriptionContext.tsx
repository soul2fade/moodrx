import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import {
  Alert,
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
} from 'react-native-purchases';
import {
  REVENUECAT_ENTITLEMENT_IDENTIFIER,
  ALL_ACCESS_ENTITLEMENT_IDENTIFIER,
  BASE_UNLOCK_PACKAGE_ID,
  PACKS_OFFERING_ID,
  packEntitlementId,
} from '@/lib/revenuecat';
import { colors } from '@/lib/colors';

interface RCPurchaseError {
  userCancelled?: boolean | null;
  message?: string;
}

function isRCPurchaseError(err: unknown): err is RCPurchaseError {
  return typeof err === 'object' && err !== null;
}

interface SubscriptionContextValue {
  /** True when the user holds the `premium` entitlement (owns the base unlock). */
  isPremium: boolean;
  /** True when the user owns the given pack (or has all-access). */
  ownsPack: (packId: string) => boolean;
  isLoading: boolean;
  offerings: PurchasesOfferings | null;
  /** Resolves true when the base unlock was actually granted. */
  purchaseBase: () => Promise<boolean>;
  /** Resolves true when the given pack was actually granted. */
  purchasePack: (packId: string) => Promise<boolean>;
  /** Resolves true when a previous purchase was found and restored. */
  restorePurchases: () => Promise<boolean>;
  devTogglePremium: () => void;
}

// Default is `null` so any consumer rendered outside <SubscriptionProvider>
// fails loudly in useSubscription() instead of silently reading
// `isPremium: false, isLoading: true` forever (which silently hides a real
// bug — a paywall screen sitting outside the provider would lock everyone
// out, or a gated check would briefly let users in then re-lock).
const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPaidPremium, setIsPaidPremium] = useState(false);
  const [ownedEntitlements, setOwnedEntitlements] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const pendingPurchaseRef = useRef<PurchasesPackage | null>(null);
  const pendingResolveRef = useRef<((granted: boolean) => void) | null>(null);
  const pendingGrantsRef = useRef<string | null>(null); // dev: entitlement to mock-grant

  const isPremium = isPaidPremium;

  const applyCustomerInfo = useCallback((customerInfo: CustomerInfo) => {
    const active = customerInfo.entitlements.active;
    setIsPaidPremium(active[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined);
    setOwnedEntitlements(new Set(Object.keys(active)));
  }, []);

  const ownsPack = useCallback(
    (packId: string): boolean =>
      ownedEntitlements.has(packEntitlementId(packId)) ||
      ownedEntitlements.has(ALL_ACCESS_ENTITLEMENT_IDENTIFIER),
    [ownedEntitlements],
  );

  useEffect(() => {
    let mounted = true;
    const onCustomerInfoUpdate = (info: CustomerInfo) => {
      if (mounted) applyCustomerInfo(info);
    };

    async function init() {
      try {
        const [customerInfo, rcOfferings] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);
        if (mounted) {
          setOfferings(rcOfferings);
          applyCustomerInfo(customerInfo);
        }
        Purchases.addCustomerInfoUpdateListener(onCustomerInfoUpdate);
      } catch (err: unknown) {
        console.warn('SubscriptionContext init error:', isRCPurchaseError(err) ? err.message : String(err));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    init();

    return () => {
      mounted = false;
      Purchases.removeCustomerInfoUpdateListener(onCustomerInfoUpdate);
    };
  }, [applyCustomerInfo]);

  const executePurchase = useCallback(
    async (pkg: PurchasesPackage, expectedEntitlement: string): Promise<boolean> => {
      try {
        const { customerInfo } = await Purchases.purchasePackage(pkg);
        applyCustomerInfo(customerInfo);
        return customerInfo.entitlements.active[expectedEntitlement] !== undefined;
      } catch (err: unknown) {
        if (isRCPurchaseError(err) && err.userCancelled) return false;
        const msg = isRCPurchaseError(err) ? (err.message ?? 'Something went wrong.') : 'Something went wrong.';
        Alert.alert('Purchase failed', msg);
        return false;
      }
    },
    [applyCustomerInfo],
  );

  const triggerPurchase = useCallback(
    async (pkg: PurchasesPackage | null | undefined, mockEntitlement: string): Promise<boolean> => {
      if (__DEV__) {
        return new Promise<boolean>((resolve) => {
          pendingPurchaseRef.current = pkg ?? null;
          pendingResolveRef.current = resolve;
          pendingGrantsRef.current = mockEntitlement;
          setConfirmVisible(true);
        });
      }
      if (Platform.OS === 'web') {
        Alert.alert('Unavailable', 'Purchases are only available in the iOS and Android apps.');
        return false;
      }
      if (!pkg) {
        Alert.alert('Unavailable', 'This item is not available right now. Please try again later.');
        return false;
      }
      return executePurchase(pkg, mockEntitlement);
    },
    [executePurchase],
  );

  const purchaseBase = useCallback((): Promise<boolean> => {
    const pkg = offerings?.current?.availablePackages?.find(
      (p) => p.identifier === BASE_UNLOCK_PACKAGE_ID,
    );
    return triggerPurchase(pkg, REVENUECAT_ENTITLEMENT_IDENTIFIER);
  }, [offerings, triggerPurchase]);

  const purchasePack = useCallback((packId: string): Promise<boolean> => {
    const pkg = offerings?.all?.[PACKS_OFFERING_ID]?.availablePackages?.find(
      (p) => p.identifier === packId,
    );
    return triggerPurchase(pkg, packEntitlementId(packId));
  }, [offerings, triggerPurchase]);

  const devTogglePremium = useCallback(() => {
    if (!__DEV__) return;
    setIsPaidPremium(prev => !prev);
  }, []);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      applyCustomerInfo(customerInfo);
      const hasEntitlement =
        customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;
      if (hasEntitlement) {
        Alert.alert('Restored', 'Your MoodRx Pro purchase has been restored.');
      } else {
        Alert.alert('No purchases found', 'No previous MoodRx Pro purchase was found.');
      }
      return hasEntitlement;
    } catch (err: unknown) {
      const msg = isRCPurchaseError(err) ? (err.message ?? 'Could not connect to the store. Please try again.') : 'Could not connect to the store. Please try again.';
      Alert.alert('Restore failed', msg);
      return false;
    }
  }, [applyCustomerInfo]);

  const handleConfirmPurchase = useCallback(async () => {
    const pkg = pendingPurchaseRef.current;
    const resolve = pendingResolveRef.current;
    setConfirmVisible(false);
    pendingPurchaseRef.current = null;
    pendingResolveRef.current = null;
    if (pkg) {
      const ent = pendingGrantsRef.current ?? '';
      pendingGrantsRef.current = null;
      const granted = await executePurchase(pkg, ent);
      resolve?.(granted);
    } else {
      // Dev/preview: no real package — mock-grant the pending entitlement.
      const ent = pendingGrantsRef.current;
      if (ent === REVENUECAT_ENTITLEMENT_IDENTIFIER) setIsPaidPremium(true);
      if (ent) setOwnedEntitlements((prev) => new Set(prev).add(ent));
      pendingGrantsRef.current = null;
      resolve?.(true);
    }
  }, [executePurchase]);

  const handleCancelPurchase = useCallback(() => {
    setConfirmVisible(false);
    pendingPurchaseRef.current = null;
    pendingGrantsRef.current = null;
    pendingResolveRef.current?.(false);
    pendingResolveRef.current = null;
  }, []);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      isPremium,
      ownsPack,
      isLoading,
      offerings,
      purchaseBase,
      purchasePack,
      restorePurchases,
      devTogglePremium,
    }),
    [
      isPremium,
      ownsPack,
      isLoading,
      offerings,
      purchaseBase,
      purchasePack,
      restorePurchases,
      devTogglePremium,
    ]
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCancelPurchase}
      >
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>TEST PURCHASE</Text>
            <Text style={styles.dialogBody}>
              You are in development mode. This will complete a mock purchase in the RevenueCat test store.
            </Text>
            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleCancelPurchase}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirmPurchase}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmBtnText}>CONFIRM</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used inside <SubscriptionProvider>');
  }
  return ctx;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  dialog: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#333333',
    padding: 24,
    width: '100%',
  },
  dialogTitle: {
    color: colors.premium,
    fontSize: 16,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  dialogBody: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 20,
    marginBottom: 24,
    fontFamily: 'SpaceGrotesk_400Regular',
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#333333',
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#ffffff',
    fontSize: 16,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  confirmBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.premium,
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: colors.premium,
    fontSize: 16,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
});
