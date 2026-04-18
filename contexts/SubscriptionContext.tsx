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
  type PurchasesOfferings,
  type PurchasesPackage,
} from 'react-native-purchases';
import { REVENUECAT_ENTITLEMENT_IDENTIFIER } from '@/lib/revenuecat';
import {
  startTrial as startTrialStorage,
  getTrialInfo,
} from '@/lib/subscription';

interface RCPurchaseError {
  userCancelled?: boolean | null;
  message?: string;
}

function isRCPurchaseError(err: unknown): err is RCPurchaseError {
  return typeof err === 'object' && err !== null;
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

  const isPremium = isPaidPremium || isInTrial;

  const loadTrialInfo = useCallback(async () => {
    const info = await getTrialInfo();
    setIsInTrial(info.isInTrial);
    setTrialDaysLeft(info.daysLeft);
    setHasUsedTrial(info.hasUsedTrial);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const trialInfo = await getTrialInfo();
        if (mounted) {
          setIsInTrial(trialInfo.isInTrial);
          setTrialDaysLeft(trialInfo.daysLeft);
          setHasUsedTrial(trialInfo.hasUsedTrial);
        }

        const [customerInfo, rcOfferings] = await Promise.all([
          Purchases.getCustomerInfo(),
          Purchases.getOfferings(),
        ]);

        if (mounted) {
          const hasEntitlement =
            customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;
          setIsPaidPremium(hasEntitlement);
          setOfferings(rcOfferings);
        }
      } catch (err: unknown) {
        console.warn('SubscriptionContext init error:', isRCPurchaseError(err) ? err.message : String(err));
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  const startTrial = useCallback(async () => {
    await startTrialStorage();
    await loadTrialInfo();
  }, [loadTrialInfo]);

  const executePurchase = useCallback(async (pkg: PurchasesPackage) => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const hasEntitlement =
        customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;
      setIsPaidPremium(hasEntitlement);
    } catch (err: unknown) {
      if (isRCPurchaseError(err) && err.userCancelled) return;
      const msg = isRCPurchaseError(err) ? (err.message ?? 'Something went wrong.') : 'Something went wrong.';
      Alert.alert('Purchase failed', msg);
    }
  }, []);

  const triggerPurchase = useCallback(
    async (packageId: string) => {
      const pkg = offerings?.current?.availablePackages?.find(
        (p) => p.identifier === packageId
      );

      if (!pkg) {
        Alert.alert('Unavailable', 'This plan is not available right now. Please try again later.');
        return;
      }

      if (__DEV__ || Platform.OS === 'web') {
        pendingPurchaseRef.current = pkg;
        setConfirmVisible(true);
      } else {
        await executePurchase(pkg);
      }
    },
    [offerings, executePurchase]
  );

  const purchaseMonthly = useCallback(async () => {
    await triggerPurchase('$rc_monthly');
  }, [triggerPurchase]);

  const purchaseYearly = useCallback(async () => {
    await triggerPurchase('$rc_annual');
  }, [triggerPurchase]);

  const restorePurchases = useCallback(async () => {
    try {
      const customerInfo = await Purchases.restorePurchases();
      const hasEntitlement =
        customerInfo.entitlements.active[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;
      setIsPaidPremium(hasEntitlement);
      if (hasEntitlement) {
        Alert.alert('Restored', 'Your Pro subscription has been restored.');
      } else {
        Alert.alert('No purchases found', 'No previous Pro subscription was found.');
      }
    } catch (err: unknown) {
      const msg = isRCPurchaseError(err) ? (err.message ?? 'Could not connect to the store. Please try again.') : 'Could not connect to the store. Please try again.';
      Alert.alert('Restore failed', msg);
    }
  }, []);

  const handleConfirmPurchase = useCallback(async () => {
    const pkg = pendingPurchaseRef.current;
    setConfirmVisible(false);
    pendingPurchaseRef.current = null;
    if (pkg) await executePurchase(pkg);
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
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: 12,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  dialogBody: {
    color: '#c8c8c8',
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
    color: '#737373',
    fontSize: 12,
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
    fontWeight: '700',
    letterSpacing: 2,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
});
