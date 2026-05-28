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
import { REVENUECAT_ENTITLEMENT_IDENTIFIER } from '@/lib/revenuecat';
import {
  hasLegacyTrialAnchor,
  setTrialNudgeAnchor,
} from '@/lib/subscription';
import { scheduleTrialNudges } from '@/lib/notifications';

interface RCPurchaseError {
  userCancelled?: boolean | null;
  message?: string;
}

function isRCPurchaseError(err: unknown): err is RCPurchaseError {
  return typeof err === 'object' && err !== null;
}

interface SubscriptionSnapshot {
  isPaidPremium: boolean;
  isInTrial: boolean;
  trialDaysLeft: number;
  hasUsedTrial: boolean;
}

function deriveSubscriptionState(
  customerInfo: CustomerInfo,
  legacyTrialUsed: boolean,
): SubscriptionSnapshot {
  const activeEntitlement = customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_IDENTIFIER];
  const allEntitlement = customerInfo.entitlements.all[REVENUECAT_ENTITLEMENT_IDENTIFIER];
  const isPaidPremium = activeEntitlement !== undefined;
  const isInTrial =
    isPaidPremium &&
    (activeEntitlement.periodType === 'TRIAL' || activeEntitlement.periodType === 'INTRO');

  let trialDaysLeft = 0;
  if (isInTrial && activeEntitlement.expirationDateMillis) {
    trialDaysLeft = Math.max(
      0,
      Math.ceil((activeEntitlement.expirationDateMillis - Date.now()) / (1000 * 60 * 60 * 24)),
    );
  }

  const hasUsedTrial = allEntitlement !== undefined || legacyTrialUsed;

  return { isPaidPremium, isInTrial, trialDaysLeft, hasUsedTrial };
}

async function maybeScheduleTrialNudges(customerInfo: CustomerInfo): Promise<void> {
  const entitlement = customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_IDENTIFIER];
  if (!entitlement) return;
  if (entitlement.periodType !== 'TRIAL' && entitlement.periodType !== 'INTRO') return;

  const anchorMs = entitlement.originalPurchaseDateMillis || Date.now();
  await setTrialNudgeAnchor(anchorMs);
  await scheduleTrialNudges(anchorMs);
}

interface SubscriptionContextValue {
  isPremium: boolean;
  isInTrial: boolean;
  trialDaysLeft: number;
  hasUsedTrial: boolean;
  isLoading: boolean;
  offerings: PurchasesOfferings | null;
  startTrial: () => Promise<void>;
  purchaseMonthly: () => Promise<void>;
  purchaseYearly: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  devTogglePremium: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  isPremium: false,
  isInTrial: false,
  trialDaysLeft: 0,
  hasUsedTrial: false,
  isLoading: true,
  offerings: null,
  startTrial: async () => {},
  purchaseMonthly: async () => {},
  purchaseYearly: async () => {},
  restorePurchases: async () => {},
  devTogglePremium: () => {},
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPaidPremium, setIsPaidPremium] = useState(false);
  const [isInTrial, setIsInTrial] = useState(false);
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);
  const [hasUsedTrial, setHasUsedTrial] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [offerings, setOfferings] = useState<PurchasesOfferings | null>(null);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const pendingPurchaseRef = useRef<PurchasesPackage | null>(null);
  const legacyTrialUsedRef = useRef(false);

  const isPremium = isPaidPremium;

  const applyCustomerInfo = useCallback(async (customerInfo: CustomerInfo) => {
    const snapshot = deriveSubscriptionState(customerInfo, legacyTrialUsedRef.current);
    setIsPaidPremium(snapshot.isPaidPremium);
    setIsInTrial(snapshot.isInTrial);
    setTrialDaysLeft(snapshot.trialDaysLeft);
    setHasUsedTrial(snapshot.hasUsedTrial);
    await maybeScheduleTrialNudges(customerInfo);
  }, []);

  useEffect(() => {
    let mounted = true;
    const onCustomerInfoUpdate = (info: CustomerInfo) => {
      if (mounted) void applyCustomerInfo(info);
    };

    async function init() {
      try {
        legacyTrialUsedRef.current = await hasLegacyTrialAnchor();

        const [customerInfo, rcOfferings] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);

        if (mounted) {
          await applyCustomerInfo(customerInfo);
          setOfferings(rcOfferings);
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

  const executePurchase = useCallback(async (pkg: PurchasesPackage) => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      await applyCustomerInfo(customerInfo);
    } catch (err: unknown) {
      if (isRCPurchaseError(err) && err.userCancelled) return;
      const msg = isRCPurchaseError(err) ? (err.message ?? 'Something went wrong.') : 'Something went wrong.';
      Alert.alert('Purchase failed', msg);
    }
  }, [applyCustomerInfo]);

  const triggerPurchase = useCallback(
    async (packageId: string) => {
      const pkg = offerings?.current?.availablePackages?.find(
        (p) => p.identifier === packageId
      );

      if (__DEV__) {
        pendingPurchaseRef.current = pkg ?? null;
        setConfirmVisible(true);
        return;
      }

      if (Platform.OS === 'web') {
        Alert.alert('Unavailable', 'Purchases are only available in the iOS and Android apps.');
        return;
      }

      if (!pkg) {
        Alert.alert('Unavailable', 'This plan is not available right now. Please try again later.');
        return;
      }

      await executePurchase(pkg);
    },
    [offerings, executePurchase]
  );

  const purchaseMonthly = useCallback(async () => {
    await triggerPurchase('$rc_monthly');
  }, [triggerPurchase]);

  const purchaseYearly = useCallback(async () => {
    await triggerPurchase('$rc_annual');
  }, [triggerPurchase]);

  /** Starts the App Store / Play free trial via the annual subscription. */
  const startTrial = purchaseYearly;

  const devTogglePremium = useCallback(() => {
    if (!__DEV__) return;
    setIsPaidPremium(prev => !prev);
  }, []);

  const restorePurchases = useCallback(async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      await applyCustomerInfo(customerInfo);
      const hasEntitlement =
        customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;
      if (hasEntitlement) {
        Alert.alert('Restored', 'Your Pro subscription has been restored.');
      } else {
        Alert.alert('No purchases found', 'No previous Pro subscription was found.');
      }
    } catch (err: unknown) {
      const msg = isRCPurchaseError(err) ? (err.message ?? 'Could not connect to the store. Please try again.') : 'Could not connect to the store. Please try again.';
      Alert.alert('Restore failed', msg);
    }
  }, [applyCustomerInfo]);

  const handleConfirmPurchase = useCallback(async () => {
    const pkg = pendingPurchaseRef.current;
    setConfirmVisible(false);
    pendingPurchaseRef.current = null;
    if (pkg) {
      await executePurchase(pkg);
    } else {
      // Dev/preview: no real package available — mock the unlock directly
      setIsPaidPremium(true);
      setIsInTrial(true);
      setTrialDaysLeft(7);
      setHasUsedTrial(true);
      const anchorMs = Date.now();
      await setTrialNudgeAnchor(anchorMs);
      await scheduleTrialNudges(anchorMs);
    }
  }, [executePurchase]);

  const handleCancelPurchase = useCallback(() => {
    setConfirmVisible(false);
    pendingPurchaseRef.current = null;
  }, []);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      isPremium,
      isInTrial,
      trialDaysLeft,
      hasUsedTrial,
      isLoading,
      offerings,
      startTrial,
      purchaseMonthly,
      purchaseYearly,
      restorePurchases,
      devTogglePremium,
    }),
    [
      isPremium,
      isInTrial,
      trialDaysLeft,
      hasUsedTrial,
      isLoading,
      offerings,
      startTrial,
      purchaseMonthly,
      purchaseYearly,
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

export function useSubscription() {
  return useContext(SubscriptionContext);
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
    color: '#E8B84B',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  dialogBody: {
    color: '#ffffff',
    fontSize: 14,
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
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  confirmBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E8B84B',
    paddingVertical: 12,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#E8B84B',
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
});
