import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { SEVERITIES } from '@/lib/insult-severity';
import type { InsultTier } from '@/lib/insult-library';
import { fonts } from '@/lib/typography';
import { colors } from '@/lib/colors';
import { CenteredModalCard } from '@/components/CenteredModalCard';
import { SeverityTierRow } from '@/components/SeverityTierRow';

interface Props {
  visible: boolean;
  current: InsultTier;
  onConfirm: (tier: InsultTier) => void;
  onCancel: () => void;
}

export function SeveritySheet({ visible, current, onConfirm, onCancel }: Props) {
  return (
    <CenteredModalCard visible={visible} onClose={onCancel} header="PREPARE TO LAUGH" sub="How hard should Dr. MoodRx go?">
      <Text style={styles.frequencyNote}>He cuts in over your soundscape every minute or so.</Text>
      {SEVERITIES.map((s) => (
        <SeverityTierRow
          key={s.key}
          label={s.label}
          blurb={s.blurb}
          warning={s.warning}
          selected={s.key === current}
          onPress={() => onConfirm(s.key)}
          accent={colors.danger}
          selectedLabelColor="#ffffff"
        />
      ))}
    </CenteredModalCard>
  );
}

const styles = StyleSheet.create({
  frequencyNote: { fontFamily: fonts.mono.regular, fontSize: 16, color: '#cfcfcf', textAlign: 'center', lineHeight: 18, letterSpacing: 0.5, marginTop: 6, marginBottom: 4 },
});
