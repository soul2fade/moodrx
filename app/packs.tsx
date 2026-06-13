import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { PACKS_OFFERING_ID } from '@/lib/revenuecat';
import { type as t, fonts } from '@/lib/typography';
import { colors } from '@/lib/colors';

export default function PacksScreen() {
  const insets = useSafeAreaInsets();
  const { offerings, ownsPack, purchasePack } = useSubscription();
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const packs = offerings?.all?.[PACKS_OFFERING_ID]?.availablePackages ?? [];

  const handleBuy = async (packId: string) => {
    if (purchasing) return;
    setPurchasing(packId);
    try {
      await purchasePack(packId);
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top + 8, 56) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButton}>← BACK</Text>
        </TouchableOpacity>

        {/* Header */}
        <Text style={styles.pageLabel}>PACKS</Text>
        <Text style={styles.headline}>Add-on content.</Text>

        <View style={styles.divider} />

        {packs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyHeadline}>Coming soon.</Text>
            <Text style={styles.emptyBody}>
              New MoodRx packs are coming soon — guided audio, focused programs, and more.
            </Text>
          </View>
        ) : (
          <View style={styles.packList}>
            {packs.map((pkg) => {
              const packId = pkg.identifier;
              const owned = ownsPack(packId);
              const isBuying = purchasing === packId;
              const title = pkg.product.title || packId;
              const price = pkg.product.priceString;

              return (
                <View key={packId} style={styles.packCard}>
                  <View style={styles.packInfo}>
                    <Text style={styles.packTitle}>{title}</Text>
                    <Text style={styles.packPrice}>{price}</Text>
                  </View>
                  {owned ? (
                    <View style={styles.ownedBadge}>
                      <Text style={styles.ownedBadgeText}>OWNED</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.buyButton, isBuying && styles.buyButtonDisabled]}
                      onPress={() => { void handleBuy(packId); }}
                      activeOpacity={0.7}
                      disabled={isBuying}
                      accessibilityRole="button"
                      accessibilityLabel={`Buy ${title} for ${price}`}
                    >
                      {isBuying ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.buyButtonText}>BUY →</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  backButton: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 2,
  },
  pageLabel: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 3,
    marginTop: 24,
  },
  headline: {
    fontFamily: fonts.primary.bold,
    fontSize: 32,
    color: '#ffffff',
    letterSpacing: 0,
    lineHeight: 40,
    marginTop: 8,
  },
  divider: {
    width: 32,
    height: 1,
    backgroundColor: '#333333',
    marginVertical: 20,
  },
  emptyState: {
    marginTop: 8,
  },
  emptyHeadline: {
    fontFamily: fonts.primary.bold,
    fontSize: 22,
    color: '#ffffff',
    lineHeight: 28,
    marginBottom: 12,
  },
  emptyBody: {
    fontFamily: fonts.primary.regular,
    fontSize: 16,
    color: '#d8d8d8',
    lineHeight: 24,
  },
  packList: {
    gap: 0,
  },
  packCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  packInfo: {
    flex: 1,
  },
  packTitle: {
    fontFamily: fonts.primary.regular,
    fontSize: 16,
    color: '#e8e8e8',
    lineHeight: 22,
  },
  packPrice: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: '#f0f0f0',
    letterSpacing: 1,
    lineHeight: 18,
    marginTop: 2,
  },
  ownedBadge: {
    borderWidth: 1,
    borderColor: colors.premium,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  ownedBadgeText: {
    ...t.label,
    color: colors.premium,
    letterSpacing: 2,
    fontSize: 16,
    lineHeight: 17,
  },
  buyButton: {
    borderWidth: 1,
    borderColor: '#ffffff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 72,
    alignItems: 'center',
  },
  buyButtonDisabled: {
    borderColor: '#555555',
  },
  buyButtonText: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 2,
  },
});
