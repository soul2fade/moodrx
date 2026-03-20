import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { getPremiumStatus, setPremiumStatus, PRODUCT_IDS } from '@/lib/subscription';

// Safely load expo-in-app-purchases — it crashes at import time in Expo Go,
// web preview, and any environment without the native module. We require()
// it lazily inside functions so the module boundary never throws.
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
  isLoading: boolean;
  purchaseMonthly: () => Promise<void>;
  purchaseYearly: () => Promise<void>;
  restorePurchases: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  isPremium: false,
  isLoading: true,
  purchaseMonthly: async () => {},
  purchaseYearly: async () => {},
  restorePurchases: async () => {},
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let connected = false;

    async function init() {
      try {
        const cached = await getPremiumStatus();
        if (mounted) setIsPremium(cached);

        const IAP = getIAP();
        if (!IAP) {
          // Native module not available (Expo Go / web) — use cached value only
          return;
        }

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
            if (mounted) setIsPremium(true);
          }
        });
      } catch {
        // Silently fall back to cached premium status
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

  const purchaseMonthly = useCallback(async () => {
    try {
      const IAP = getIAP();
      if (!IAP) {
        // Mock environment — toggle for testing
        const newVal = !isPremium;
        await setPremiumStatus(newVal);
        setIsPremium(newVal);
        return;
      }
      await IAP.purchaseItemAsync(PRODUCT_IDS.monthly);
    } catch {
      // handled by listener
    }
  }, [isPremium]);

  const purchaseYearly = useCallback(async () => {
    try {
      const IAP = getIAP();
      if (!IAP) {
        // Mock environment — toggle for testing
        const newVal = !isPremium;
        await setPremiumStatus(newVal);
        setIsPremium(newVal);
        return;
      }
      await IAP.purchaseItemAsync(PRODUCT_IDS.yearly);
    } catch {
      // handled by listener
    }
  }, [isPremium]);

  const restorePurchases = useCallback(async () => {
    try {
      const IAP = getIAP();
      if (!IAP) {
        // Mock environment — check cached status
        const cached = await getPremiumStatus();
        if (cached) {
          setIsPremium(true);
          Alert.alert('Restored', 'Your Pro subscription has been restored.');
        } else {
          Alert.alert('No purchases found', 'No previous Pro subscription was found.');
        }
        return;
      }
      const { responseCode, results } = await IAP.getPurchaseHistoryAsync();
      if (responseCode === IAP.IAPResponseCode.OK && results && results.length > 0) {
        await setPremiumStatus(true);
        setIsPremium(true);
        Alert.alert('Restored', 'Your Pro subscription has been restored.');
      } else {
        Alert.alert('No purchases found', 'No previous Pro subscription was found.');
      }
    } catch {
      Alert.alert('Restore failed', 'Could not connect to the store. Please try again.');
    }
  }, []);

  return (
    <SubscriptionContext.Provider value={{ isPremium, isLoading, purchaseMonthly, purchaseYearly, restorePurchases }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}