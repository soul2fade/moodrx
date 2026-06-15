import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { type as t } from '@/lib/typography';
import { purchaseButtonLabel } from '@/lib/purchase-ui';
import type { PurchaseButtonController } from '@/hooks/usePurchaseButton';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Restore-purchase button controller, rendered in the shared footer. */
  restoreBtn: PurchaseButtonController;
  children: React.ReactNode;
}

/** Shared bottom-sheet shell for the purchase sheets (PlusSheet / PremiumSheet):
 *  the slide-up Modal + dim overlay + sheet container + grab handle, and the
 *  standard "RESTORE PURCHASE · MAYBE LATER" footer. Each sheet renders its own
 *  tier-specific body (incl. its LegalLinksRow) as children. */
export function PurchaseSheetShell({ visible, onClose, restoreBtn, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Dismiss" accessibilityRole="button" />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        {children}
        <View style={styles.footerRow}>
          <TouchableOpacity
            onPress={restoreBtn.onPress}
            disabled={restoreBtn.disabled}
            activeOpacity={0.7}
            style={styles.footerBtn}
            accessibilityRole="button"
            accessibilityState={{ disabled: restoreBtn.disabled, busy: restoreBtn.busy }}
            accessibilityLabel="Restore purchase"
          >
            {restoreBtn.busy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.closeText}>{purchaseButtonLabel(restoreBtn.status, { idle: 'RESTORE PURCHASE', success: 'RESTORED ✓' })}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={styles.footerBtn} accessibilityRole="button" accessibilityLabel="Maybe later">
            <Text style={styles.closeText}>MAYBE LATER</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet: { backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: '#333333', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 48 },
  handle: { width: 32, height: 2, backgroundColor: '#333333', alignSelf: 'center', marginBottom: 24 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  footerBtn: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  closeText: { ...t.label, color: '#ffffff', letterSpacing: 3 },
});
