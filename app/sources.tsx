import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type as t } from '@/lib/typography';
import { CITATION_GROUPS, citationUrl } from '@/lib/citations';
import { openExternal } from '@/lib/links';

/** "The Science" — the central, easy-to-find home for every citation behind
 *  the app's health claims. Each reference links out to the source. */
export default function SourcesScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 48,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Text style={styles.back}>← BACK</Text>
        </TouchableOpacity>

        <Text style={styles.kicker}>THE SCIENCE</Text>
        <Text style={styles.headline}>Sources & references.</Text>
        <Text style={styles.intro}>
          Every health claim in MoodRx is backed by peer-reviewed research. Tap any reference to read the source.
        </Text>

        {CITATION_GROUPS.map((group) =>
          group.citations.length === 0 ? null : (
            <View key={group.title} style={styles.group}>
              <Text style={styles.groupTitle}>{group.title.toUpperCase()}</Text>
              {group.citations.map((c, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => openExternal(citationUrl(c))}
                  activeOpacity={0.7}
                  style={styles.citationRow}
                  accessibilityRole="link"
                  accessibilityLabel={`Open source: ${c}`}
                >
                  <Text style={styles.citation}>{c} ↗</Text>
                </TouchableOpacity>
              ))}
            </View>
          ),
        )}

        <Text style={styles.disclaimer}>
          MoodRx is educational and not a substitute for professional medical advice, diagnosis, or treatment. Supplements are not evaluated to diagnose, treat, cure, or prevent any disease. Talk to a clinician before starting one, especially if you take other medications.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  back: { ...t.label, color: '#ffffff', letterSpacing: 2, fontSize: 16, marginBottom: 24 },
  kicker: { ...t.label, color: '#8fd6b4', letterSpacing: 3, fontSize: 16, marginBottom: 6 },
  headline: { ...t.headlineMd, fontSize: 28, marginBottom: 12 },
  intro: { ...t.body, color: '#d8d8d8', fontSize: 16, lineHeight: 23, marginBottom: 28 },
  group: { marginBottom: 28 },
  groupTitle: {
    ...t.label,
    color: '#f0f0f0',
    letterSpacing: 2,
    fontSize: 16,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    paddingBottom: 8,
  },
  citationRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#141414' },
  citation: { ...t.body, color: '#cfe6da', fontSize: 16, lineHeight: 22 },
  disclaimer: { ...t.body, color: '#c8c8c8', fontSize: 16, lineHeight: 22, marginTop: 8 },
});
