import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { VOICES, type VoiceOption } from '@/lib/voices';

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

const ACCENT = '#E11D48';

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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.header}>YOUR COACH</Text>
          <Text style={styles.sub}>Choose who coaches you through a workout.</Text>
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', justifyContent: 'center', paddingHorizontal: 24 },
  card: { backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#2a2a2a', paddingVertical: 22, paddingHorizontal: 18 },
  header: { color: '#f5f5f5', fontSize: 20, fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
  sub: { color: '#cfcfcf', fontSize: 16, textAlign: 'center', marginTop: 6, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#333333', borderRadius: 12, marginTop: 10, paddingRight: 10 },
  rowSelected: { borderColor: ACCENT, backgroundColor: '#E11D4818' },
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
