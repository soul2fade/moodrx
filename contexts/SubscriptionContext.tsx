import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import {
  getPremiumStatus,
  setPremiumStatus,
  PRODUCT_IDS,
  startTrial as startTrialStorage,
  getTrialInfo,
} from '@/lib/subscription';

function getIAP() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-in-app-purchases') as typeof import('expo-in-app-purchases');
  } catch {
    return null;
  }
}

interface SubscriptionContextValue {
  isPremium: boolean;
  isInTrial: boolean;
  trialDaysLeft: number;
  hasUsedTrial: boolean;
  isLoading: boolean;
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

  const isPremium = isPaidPremium || isInTrial;

  const loadTrialInfo = useCallback(async () => {
    const info = await getTrialInfo();
    setIsInTrial(info.isInTrial);
    setTrialDaysLeft(info.daysLeft);
    setHasUsedTrial(info.hasUsedTrial);
  }, []);

  useEffect(() => {
    let mounted = true;
    let connected = false;

    async function init() {
      try {
        const [cached, trialInfo] = await Promise.all([
          getPremiumStatus(),
          getTrialInfo(),
        ]);
        if (mounted) {
          setIsPaidPremium(cached);
          setIsInTrial(trialInfo.isInTrial);
          setTrialDaysLeft(trialInfo.daysLeft);
          setHasUsedTrial(trialInfo.hasUsedTrial);
        }

        const IAP = getIAP();
        if (!IAP) return;

        await IAP.connectAsync();
        connected = true;

        IAP.setPurchaseListener(({ responseCode, results }: {
          responseCode: number;
          results?: Array<{ acknowledged: boolean }>;
          errorCode?: number;
        }) => {
          if (responseCode === IAP.IAPResponseCode.OK && results) {
            for (const purchase of results) {
              if (!purchase.acknowledged) {
                IAP.finishTransactionAsync(purchase as never, true);
              }
            }
            setPremiumStatus(true);
            if (mounted) setIsPaidPremium(true);
          }
        });
      } catch {
        // Silently fall back to cached status
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
      if (connected) {
        const IAP = getIAP();
        IAP?.disconnectAsync().catch(() => {});
      }
    };
  }, []);

  const startTrial = useCallback(async () => {
    await startTrialStorage();
    await loadTrialInfo();
  }, [loadTrialInfo]);

  const purchaseMonthly = useCallback(async () => {
    try {
      const IAP = getIAP();
      if (!IAP) {
        const newVal = !isPaidPremium;
        await setPremiumStatus(newVal);
        setIsPaidPremium(newVal);
        return;
      }
      await IAP.purchaseItemAsync(PRODUCT_IDS.monthly);
    } catch {
      // handled by listener
    }
  }, [isPaidPremium]);

  const purchaseYearly = useCallback(async () => {
    try {
      const IAP = getIAP();
      if (!IAP) {
        const newVal = !isPaidPremium;
        await setPremiumStatus(newVal);
        setIsPaidPremium(newVal);
        return;
      }
      await IAP.purchaseItemAsync(PRODUCT_IDS.yearly);
    } catch {
      // handled by listener
    }
  }, [isPaidPremium]);

  const restorePurchases = useCallback(async () => {
    try {
      const IAP = getIAP();
      if (!IAP) {
        const cached = await getPremiumStatus();
        if (cached) {
          setIsPaidPremium(true);
          Alert.alert('Restored', 'Your Pro subscription has been restored.');
        } else {
          Alert.alert('No purchases found', 'No previous Pro subscription was found.');
        }
        return;
      }
      const { responseCode, results } = await IAP.getPurchaseHistoryAsync();
      if (responseCode === IAP.IAPResponseCode.OK && results && results.length > 0) {
        await setPremiumStatus(true);
        setIsPaidPremium(true);
        Alert.alert('Restored', 'Your Pro subscription has been restored.');
      } else {
        Alert.alert('No purchases found', 'No previous Pro subscription was found.');
      }
    } catch {
      Alert.alert('Restore failed', 'Could not connect to the store. Please try again.');
    }
  }, []);

  return (
    <SubscriptionContext.Provider value={{
      isPremium,
      isInTrial,
      trialDaysLeft,
      hasUsedTrial,
      isLoading,
      startTrial,
      purchaseMonthly,
      purchaseYearly,
      restorePurchases,
    }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
