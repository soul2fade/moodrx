import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { router, usePathname } from 'expo-router';
import { fonts } from '@/lib/typography';
import { useSubscription } from '@/contexts/SubscriptionContext';

const TABS = [
  { label: 'HOME', path: '/home' },
  { label: 'INSIGHTS', path: '/insights' },
  { label: 'SUPPS', path: '/supplements', requiresPremium: true },
  { label: 'SETTINGS', path: '/settings' },
] as const;

const INACTIVE_LABEL_OPACITY = 0.4;
const ACTIVE_LABEL_OPACITY = 1.0;
const ANIMATION_DURATION = 150;

export function BottomNav() {
  const pathname = usePathname();
  const { isPremium } = useSubscription();

  const labelOpacities = useRef(
    TABS.map((tab) =>
      new Animated.Value(pathname === tab.path ? ACTIVE_LABEL_OPACITY : INACTIVE_LABEL_OPACITY)
    )
  ).current;

  const underlineOpacities = useRef(
    TABS.map((tab) =>
      new Animated.Value(pathname === tab.path ? 1 : 0)
    )
  ).current;

  useEffect(() => {
    const animations = TABS.flatMap((tab, i) => {
      const isActive = pathname === tab.path;
      return [
        Animated.timing(labelOpacities[i], {
          toValue: isActive ? ACTIVE_LABEL_OPACITY : INACTIVE_LABEL_OPACITY,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(underlineOpacities[i], {
          toValue: isActive ? 1 : 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ];
    });
    Animated.parallel(animations).start();
  }, [pathname]);

  return (
    <View style={styles.container}>
      {TABS.map((tab, i) => {
        const isActive = pathname === tab.path;
        const isLocked = 'requiresPremium' in tab && tab.requiresPremium && !isPremium;

        const handlePress = () => {
          if (isLocked) {
            router.push('/premium' as any);
          } else {
            router.push(tab.path as any);
          }
        };

        return (
          <TouchableOpacity
            key={tab.path}
            onPress={handlePress}
            activeOpacity={0.7}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityLabel={isLocked ? `${tab.label} (Pro)` : tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <View style={styles.tabInner}>
              <Animated.Text style={[styles.label, { opacity: labelOpacities[i] }]}>
                {tab.label}
              </Animated.Text>
              {isLocked && (
                <Text style={styles.lockIcon}>🔒</Text>
              )}
            </View>
            <Animated.View style={[styles.activeLine, { opacity: underlineOpacities[i] }]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    backgroundColor: '#0a0a0a',
    paddingBottom: 32,
    paddingTop: 14,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  tabInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontFamily: fonts.mono.regular,
    fontSize: 13,
    color: '#ffffff',
    letterSpacing: 1.5,
    lineHeight: 20,
  },
  lockIcon: {
    fontSize: 12,
    lineHeight: 18,
  },
  activeLine: {
    width: 16,
    height: 1,
    backgroundColor: '#ffffff',
  },
});
