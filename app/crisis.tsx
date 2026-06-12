import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Animated,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { fonts } from '../lib/typography';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Resource = {
  title: string;
  detail: string;
  number: string;
  url?: string;
  action: 'CALL' | 'COPY NUMBER' | 'OPEN DIRECTORY';
};

const RESOURCES: Resource[] = [
  {
    title: 'Find a helpline in your country',
    detail: 'findahelpline.com — local crisis lines worldwide',
    number: 'findahelpline',
    url: 'https://findahelpline.com',
    action: 'OPEN DIRECTORY',
  },
  {
    title: '988 Suicide & Crisis Lifeline',
    detail: 'Call or text 988 (US)',
    number: '988',
    action: 'CALL',
  },
  {
    title: 'Crisis Text Line',
    detail: 'Text HOME to 741741 (US)',
    number: '741741',
    action: 'COPY NUMBER',
  },
];

export default function CrisisScreen() {
  const insets = useSafeAreaInsets();
  const { fadeAnim, slideAnim } = useScreenAnimation();
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  const backHandler = useCallback(() => {
    router.back();
    return true;
  }, []);
  useHardwareBack(backHandler);

  // Returns whether the copy succeeded. Never throws — on a device where
  // the clipboard write rejects, callers must still be able to surface the
  // number to the user (this is the crisis screen; a silent failure here is
  // the worst-case outcome).
  // Timer that clears the "copied" confirmation. Held in a ref + cleared on
  // unmount so it never calls setState after the screen is gone.
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
    },
    [],
  );

  const copyNumber = useCallback(async (number: string): Promise<boolean> => {
    try {
      await Clipboard.setStringAsync(number);
      setCopiedNumber(number);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => setCopiedNumber(null), 2000);
      return true;
    } catch {
      return false;
    }
  }, []);

  const handleAction = async (resource: Resource) => {
    if (resource.action === 'OPEN DIRECTORY' && resource.url) {
      const url = resource.url;
      // Same graceful-degradation contract as CALL below: probe canOpenURL
      // first, and if the link can't be opened (or throws), copy the address
      // to the clipboard and tell the user where to go. A silent failure on
      // the crisis screen is the worst-case outcome.
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
          return;
        }
      } catch {
        // canOpenURL/openURL can throw on some platforms; treat as "can't open"
      }
      const copied = await copyNumber(url);
      Alert.alert(
        "Couldn't open the link",
        copied
          ? `${url} has been copied to your clipboard. Open it in your browser to find a crisis helpline in your country.`
          : `Open ${url} in your browser to find a crisis helpline in your country.`,
      );
      return;
    }
    if (resource.action === 'CALL') {
      const url = `tel:${resource.number}`;
      // High-stakes context — silent failure is not acceptable. Probe
      // canOpenURL first (iPad, Wi-Fi-only iPhone, or any device without
      // a phone app returns false), and fall back to copying the number
      // to the clipboard with a clear Alert explaining why the call
      // didn't dial.
      try {
        const canCall = await Linking.canOpenURL(url);
        if (canCall) {
          await Linking.openURL(url);
          return;
        }
      } catch {
        // canOpenURL itself can throw on web; treat as "can't call"
      }
      const copied = await copyNumber(resource.number);
      Alert.alert(
        "This device can't make calls",
        copied
          ? `${resource.number} has been copied to your clipboard. Dial it from a phone, or text HOME to 741741 for the Crisis Text Line.`
          : `Dial ${resource.number} from a phone, or text HOME to 741741 for the Crisis Text Line.`,
      );
      return;
    }
    const copied = await copyNumber(resource.number);
    if (!copied) {
      Alert.alert(
        'Copy unavailable',
        `Text HOME to ${resource.number} from your messaging app to reach the Crisis Text Line.`,
      );
    }
  };

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Header bar */}
      <View style={[styles.headerBar, { paddingTop: Math.max(insets.top + 8, 56) }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={styles.backBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backBtnText}>← BACK</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.headline}>
          THIS IS FOR WHEN MOVEMENT ISN&apos;T THE ANSWER.
        </Text>

        <View style={styles.divider} />

        {/* Local emergency services — plain text so it can never fail */}
        <Text style={styles.emergencyText}>
          In immediate danger? Call your local emergency number — 911 (US/CA) · 112 (EU) · 999 (UK) · 000 (AU).
        </Text>

        {/* Resource cards */}
        {RESOURCES.map((resource) => (
          <View key={resource.number} style={styles.card}>
            <Text style={styles.cardTitle}>{resource.title}</Text>
            <Text style={styles.cardDetail}>{resource.detail}</Text>
            <TouchableOpacity
              onPress={() => handleAction(resource)}
              activeOpacity={0.8}
              style={styles.actionBtn}
              accessibilityRole="button"
              accessibilityLabel={`${resource.action} — ${resource.title}`}
            >
              <Text style={styles.actionBtnText}>
                {copiedNumber === resource.number ? 'COPIED ✓' : resource.action}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Grounding technique */}
        <View style={styles.groundingSection}>
          <Text style={styles.groundingLabel}>TRY THIS FIRST</Text>
          <View style={styles.groundingBox}>
            <Text style={styles.groundingTitle}>Box Breathing</Text>
            <Text style={styles.groundingBody}>
              Breathe in for 4 counts.{'\n'}
              Hold for 4 counts.{'\n'}
              Breathe out for 4 counts.{'\n'}
              Hold for 4 counts.{'\n\n'}
              Repeat until you feel steadier.
            </Text>
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  headerBar: {
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backBtn: {
    alignSelf: 'flex-start',
  },
  backBtnText: {
    fontFamily: fonts.mono.regular,
    fontSize: 14,
    color: '#ffffff',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
  },
  headline: {
    fontFamily: fonts.primary.bold,
    fontSize: 22,
    color: '#ffffff',
    letterSpacing: 0.5,
    lineHeight: 30,
    textTransform: 'uppercase',
  },
  divider: {
    width: 32,
    height: 1,
    backgroundColor: '#333333',
    marginTop: 20,
    marginBottom: 28,
  },
  emergencyText: {
    fontFamily: fonts.mono.regular,
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 22,
    marginBottom: 28,
  },
  card: {
    borderWidth: 1,
    borderColor: '#222222',
    padding: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontFamily: fonts.primary.bold,
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 6,
  },
  cardDetail: {
    fontFamily: fonts.mono.regular,
    fontSize: 14,
    color: '#ffffff',
    letterSpacing: 1,
    marginBottom: 18,
  },
  actionBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnText: {
    fontFamily: fonts.mono.regular,
    fontSize: 14,
    // eslint-disable-next-line local/no-dark-text-color
    color: '#000000',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  groundingSection: {
    marginTop: 12,
  },
  groundingLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    lineHeight: 17,
    color: '#ffffff',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  groundingBox: {
    borderLeftWidth: 2,
    borderLeftColor: '#2a2a2a',
    paddingLeft: 16,
    paddingVertical: 4,
  },
  groundingTitle: {
    fontFamily: fonts.primary.bold,
    fontSize: 15,
    color: '#ffffff',
    marginBottom: 12,
  },
  groundingBody: {
    fontFamily: fonts.mono.regular,
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 22,
  },
});
