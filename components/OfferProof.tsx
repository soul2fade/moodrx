import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSessions } from '@/contexts/SessionsContext';
import { formatSessionDelta } from '@/lib/session-utils';
import { type as t, fonts } from '@/lib/typography';

/**
 * The outcome-proof block: the user's own avg shift once they have ≥3 sessions,
 * otherwise the illustrative "−3" example. Shared by the premium screen and the
 * offer sheet so the proof lives where the decision happens (spec §4).
 */
export function OfferProof() {
  const { sessionCount, avgChange } = useSessions();
  const hasPersonalStats = sessionCount >= 3;
  const personalDeltaLabel = formatSessionDelta(5, 5 + Math.round(avgChange * 10) / 10);

  return (
    <View style={styles.box}>
      <Text style={styles.stat}>{hasPersonalStats ? personalDeltaLabel : '−3'}</Text>
      <Text style={styles.label}>
        {hasPersonalStats ? 'YOUR AVG SHIFT PER SESSION' : 'EXAMPLE SHIFT (ONE SESSION)'}
      </Text>
      <Text style={styles.sub}>
        {hasPersonalStats
          ? `Based on ${sessionCount} logged sessions in your evidence file.`
          : 'Log a few sessions to see your own average here.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    borderLeftWidth: 3,
    borderLeftColor: '#059669',
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: '#0d0d0d',
  },
  stat: { fontSize: 36, fontWeight: '700', color: '#059669', fontFamily: fonts.mono.bold },
  label: { ...t.label, color: '#ffffff', letterSpacing: 2, fontSize: 16, lineHeight: 17, marginTop: 4 },
  sub: { ...t.label, color: '#ffffff', fontSize: 16, letterSpacing: 1, marginTop: 6, lineHeight: 16 },
});
