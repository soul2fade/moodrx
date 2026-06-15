import React from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { SEVERITIES } from '@/lib/insult-severity';
import type { InsultTier } from '@/lib/insult-library';
import { fonts } from '@/lib/typography';
import { colors } from '@/lib/colors';

interface Props {
  visible: boolean;
  current: InsultTier;
  onConfirm: (tier: InsultTier) => void;
  onCancel: () => void;
}

const ACCENT = '#E11D48';

export function SeveritySheet({ visible, current, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.header}>PREPARE TO LAUGH</Text>
          <Text style={styles.sub}>How hard should Dr. MoodRx go?</Text>
          <Text style={styles.frequencyNote}>He cuts in over your soundscape every minute or so.</Text>
          {SEVERITIES.map((s) => {
            const selected = s.key === current;
            return (
              <Pressable
                key={s.key}
                onPress={() => onConfirm(s.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.row, selected && styles.rowSelected]}
              >
                <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{s.label}</Text>
                <Text style={styles.rowBlurb}>{s.blurb}</Text>
                {s.warning ? <Text style={styles.rowWarning}>{s.warning}</Text> : null}
              </Pressable>
            );
          })}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  card: {
    backgroundColor: '#141414',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingVertical: 22,
    paddingHorizontal: 20,
  },
  header: {
    color: '#f5f5f5',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  sub: {
    color: '#cfcfcf',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
  },
  frequencyNote: { fontFamily: fonts.mono.regular, fontSize: 16, color: '#cfcfcf', textAlign: 'center', lineHeight: 18, letterSpacing: 0.5, marginTop: 6, marginBottom: 4 },
  row: {
    borderWidth: 1,
    borderColor: '#333333',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 10,
  },
  rowSelected: {
    borderColor: ACCENT,
    backgroundColor: '#E11D4818',
  },
  rowLabel: {
    color: '#f0f0f0',
    fontSize: 17,
    fontWeight: '700',
  },
  rowLabelSelected: {
    color: '#ffffff',
  },
  rowBlurb: {
    color: '#cfcfcf',
    fontSize: 16,
    marginTop: 3,
  },
  rowWarning: { color: colors.premium, fontSize: 16, marginTop: 4, fontFamily: fonts.mono.regular, letterSpacing: 0.5 },
});
