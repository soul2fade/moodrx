import React from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';

interface Props {
  visible: boolean;
  /** Tapping the backdrop (or the OS back gesture) closes the sheet. */
  onClose: () => void;
  header: string;
  sub?: string;
  children: React.ReactNode;
}

/** Shared centered fade-modal card used by the severity + voice pickers: a dim
 *  backdrop that dismisses on tap, a centered card (taps swallowed), a header,
 *  and an optional sub-line. Single-sources the backdrop/card/header/sub chrome
 *  the two sheets had copy-pasted (minor 2–4px padding drift standardized). */
export function CenteredModalCard({ visible, onClose, header, sub, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.header}>{header}</Text>
          {sub ? <Text style={styles.sub}>{sub}</Text> : null}
          {children}
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
});
