import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { setNotifPromptShown } from '@/lib/storage';
import { getTrialNudgeAnchorMs } from '@/lib/subscription';
import { enableRemindersFromPrompt } from '@/lib/notifications';
import { type as t } from '@/lib/typography';

interface NotificationPromptProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationPrompt({ visible, onClose }: NotificationPromptProps) {
  const handleEnable = async () => {
    await setNotifPromptShown();
    const trialStartMs = await getTrialNudgeAnchorMs();
    await enableRemindersFromPrompt(trialStartMs);
    onClose();
  };

  const handleDismiss = async () => {
    await setNotifPromptShown();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleDismiss}>
      <Pressable
        style={styles.overlay}
        onPress={handleDismiss}
        accessibilityLabel="Dismiss"
        accessibilityRole="button"
      />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.label}>DAILY REMINDERS</Text>
        <Text style={styles.headline}>Streaks don&apos;t build themselves.</Text>
        <Text style={styles.body}>
          MoodRx can remind you to check in daily. One notification. No noise.
        </Text>
        <TouchableOpacity
          style={styles.enableButton}
          onPress={handleEnable}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Enable daily reminders"
        >
          <Text style={styles.enableText}>ENABLE REMINDERS</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dismissButton}
          onPress={handleDismiss}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        >
          <Text style={styles.dismissText}>NOT NOW</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#333333',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 48,
  },
  handle: {
    width: 32,
    height: 2,
    backgroundColor: '#333333',
    alignSelf: 'center',
    marginBottom: 24,
  },
  label: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 3,
    marginBottom: 8,
  },
  headline: {
    ...t.headlineMd,
    fontSize: 22,
    marginBottom: 10,
  },
  body: {
    ...t.bodyMuted,
    color: '#ffffff',
    marginBottom: 24,
  },
  enableButton: {
    borderWidth: 1,
    borderColor: '#ffffff',
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  enableText: {
    ...t.button,
    letterSpacing: 3,
  },
  dismissButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  dismissText: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 3,
  },
});
