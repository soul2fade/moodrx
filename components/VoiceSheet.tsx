import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { VOICES, type VoiceOption } from '@/lib/voices';
import { colors, tintFill } from '@/lib/colors';
import { CenteredModalCard } from '@/components/CenteredModalCard';

interface Props {
  visible: boolean;
  selected: string;
  /** False until the library manifest is loaded — disables the sample buttons. */
  previewAvailable: boolean;
  isOwned: (name: string) => boolean;
  onSelect: (name: string) => void;
  onPreview: (name: string) => void;
  onClose: () => void;
  onPlus: () => void;
}

function VoiceRow({
  voice, isSelected, owned, previewAvailable, onSelect, onPreview,
}: {
  voice: VoiceOption;
  isSelected: boolean;
  owned: boolean;
  previewAvailable: boolean;
  onSelect: (name: string) => void;
  onPreview: (name: string) => void;
}) {
  return (
    <View style={[styles.row, isSelected && styles.rowSelected]}>
      <Pressable
        style={styles.rowMain}
        onPress={() => owned && onSelect(voice.name)}
        disabled={!owned}
        accessibilityRole="button"
        accessibilityState={{ selected: isSelected, disabled: !owned }}
      >
        <Text style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}>{voice.label}</Text>
        <Text style={styles.rowState}>{isSelected ? 'Selected' : owned ? 'Tap to use' : 'MoodRx+'}</Text>
      </Pressable>
      <Pressable
        style={[styles.sampleBtn, !previewAvailable && styles.sampleBtnDisabled]}
        onPress={() => onPreview(voice.name)}
        disabled={!previewAvailable}
        accessibilityRole="button"
        accessibilityState={{ disabled: !previewAvailable }}
        accessibilityLabel={`Play ${voice.label} sample`}
      >
        <Text style={styles.sampleText}>Sample</Text>
      </Pressable>
    </View>
  );
}

export function VoiceSheet({
  visible, selected, previewAvailable, isOwned, onSelect, onPreview, onClose, onPlus,
}: Props) {
  return (
    <CenteredModalCard visible={visible} onClose={onClose} header="YOUR COACH" sub="Choose who coaches you through a workout.">
      {VOICES.map((v) => (
        <VoiceRow
          key={v.name}
          voice={v}
          isSelected={v.name === selected}
          owned={isOwned(v.name)}
          previewAvailable={previewAvailable}
          onSelect={onSelect}
          onPreview={onPreview}
        />
      ))}
      <Pressable onPress={onPlus} accessibilityRole="button" accessibilityLabel="Unlock every coach with MoodRx Plus" style={styles.plusLink}>
        <Text style={styles.plusLinkText}>Every coach is included with MoodRx+ →</Text>
      </Pressable>
    </CenteredModalCard>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#333333', borderRadius: 12, marginTop: 10, paddingRight: 10 },
  rowSelected: tintFill(colors.danger, '18'),
  rowMain: { flex: 1, paddingVertical: 13, paddingLeft: 16 },
  rowLabel: { color: '#f0f0f0', fontSize: 17, fontWeight: '700' },
  rowLabelSelected: { color: '#ffffff' },
  rowState: { color: '#cfcfcf', fontSize: 16, lineHeight: 16, marginTop: 2 },
  sampleBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: '#3a3a3a' },
  sampleBtnDisabled: { opacity: 0.4 },
  sampleText: { color: '#e8e8e8', fontSize: 16, fontWeight: '600' },
  plusLink: { marginTop: 12, alignItems: 'center' },
  plusLinkText: { color: '#E8B84B', fontSize: 16, fontWeight: '600' },
});
