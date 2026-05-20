import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { router, usePathname } from 'expo-router';
import { fonts } from '@/lib/typography';

const TABS = [
  { label: 'HOME', path: '/home' },
  { label: 'INSIGHTS', path: '/insights' },
  { label: 'SETTINGS', path: '/settings' },
] as const;

const INACTIVE_LABEL_OPACITY = 0.4;
const ACTIVE_LABEL_OPACITY = 1.0;
const ANIMATION_DURATION = 150;

export function BottomNav() {
  const pathname = usePathname();

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
        return (
          <TouchableOpacity
            key={tab.path}
            onPress={() => router.push(tab.path as any)}
            activeOpacity={0.7}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: isActive }}
          >
            <Animated.Text style={[styles.label, { opacity: labelOpacities[i] }]}>
              {tab.label}
            </Animated.Text>
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
  label: {
    fontFamily: fonts.mono.regular,
    fontSize: 14,
    color: '#ffffff',
    letterSpacing: 2,
    lineHeight: 20,
  },
  activeLine: {
    width: 16,
    height: 1,
    backgroundColor: '#ffffff',
  },
});
