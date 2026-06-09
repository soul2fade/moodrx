import React, { useRef, useEffect } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { router, usePathname, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fonts } from '@/lib/typography';

const TABS = [
  { label: 'HOME', path: '/home' },
  { label: 'INSIGHTS', path: '/insights' },
  { label: 'SUPPS', path: '/supplements' },
  { label: 'SETTINGS', path: '/settings' },
] as const;

const INACTIVE_LABEL_OPACITY = 0.4;
const ACTIVE_LABEL_OPACITY = 1.0;
const ANIMATION_DURATION = 150;

export function BottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labelOpacities/underlineOpacities are stable .current refs from useRef; pathname is the meaningful trigger.
  }, [pathname]);

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
      {TABS.map((tab, i) => {
        const isActive = pathname === tab.path;

        return (
          <TouchableOpacity
            key={tab.path}
            onPress={() => router.push(tab.path as Href)}
            activeOpacity={0.7}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <View style={styles.tabInner}>
              <Animated.Text style={[styles.label, { opacity: labelOpacities[i] }]}>
                {tab.label}
              </Animated.Text>
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
  activeLine: {
    width: 16,
    height: 1,
    backgroundColor: '#ffffff',
  },
});
