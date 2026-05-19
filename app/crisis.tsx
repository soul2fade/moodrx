import React, { useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Linking,
  Clipboard,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { fonts } from '../lib/typography';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { useHardwareBack } from '@/hooks/useHardwareBack';

const RESOURCES = [
  {
    title: '988 Suicide & Crisis Lifeline',
    detail: 'Call or text 988 (US)',
    number: '988',
    action: 'CALL' as const,
  },
  {
    title: 'Crisis Text Line',
    detail: 'Text HOME to 741741 (US)',
    number: '741741',
    action: 'COPY NUMBER' as const,
  },
];

export default function CrisisScreen() {
  const { fadeAnim, slideAnim } = useScreenAnimation();

  const backHandler = useCallback(() => {
    router.back();
    return true;
  }, []);
  useHardwareBack(backHandler);

  const handleAction = (resource: typeof RESOURCES[number]) => {
    if (resource.action === 'CALL') {
      Linking.openURL(`tel:${resource.number}`);
    } else {
      Clipboard.setString(resource.number);
    }
  };

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Header bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          style={styles.backBtn}
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
          THIS IS FOR WHEN MOVEMENT ISN'T THE ANSWER.
        </Text>

        <View style={styles.divider} />

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
              accessibilityLabel={`${resource.action} ${resource.number}`}
            >
              <Text style={styles.actionBtnText}>{resource.action}</Text>
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
    fontSize: 13,
    color: '#c8c8c8',
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
    fontSize: 13,
    color: '#888888',
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
    fontSize: 13,
    color: '#000000',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  groundingSection: {
    marginTop: 12,
  },
  groundingLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 11,
    color: '#c8c8c8',
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
    color: '#c8c8c8',
    marginBottom: 12,
  },
  groundingBody: {
    fontFamily: fonts.mono.regular,
    fontSize: 14,
    color: '#888888',
    lineHeight: 22,
  },
});
