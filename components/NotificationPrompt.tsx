import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import { setNotifPromptShown } from '@/lib/storage';
import { getTrialStartMs } from '@/lib/subscription';
import { type as t } from '@/lib/typography';

interface NotificationPromptProps {
  visible: boolean;
  onClose: () => void;
}

export function NotificationPrompt({ visible, onClose }: NotificationPromptProps) {
  const handleEnable = async () => {
    await setNotifPromptShown();
    if (Platform.OS !== 'web') {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          // Daily check-in reminder at 9am
          await Notifications.scheduleNotificationAsync({
            content: {
              title: 'MoodRx',
              body: 'Time to check in. How bad is it today?',
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DAILY,
              hour: 9,
              minute: 0,
            },
          });

          // Trial nurture notifications — scheduled to specific dates
          const trialStartMs = await getTrialStartMs();
          if (trialStartMs) {
            const now = Date.now();
            const nudges: Array<{ offsetDays: number; body: string }> = [
              { offsetDays: 2, body: "Day 2. Your brain's trying to trick you again. Check in." },
              { offsetDays: 5, body: "5 sessions deep. The data doesn't lie. Keep going." },
              { offsetDays: 6, body: "1 day left on your trial. Don't let momentum die here." },
            ];
            for (const nudge of nudges) {
              const triggerDate = new Date(trialStartMs + nudge.offsetDays * 24 * 60 * 60 * 1000);
              triggerDate.setHours(18, 0, 0, 0);
              if (triggerDate.getTime() > now) {
                await Notifications.scheduleNotificationAsync({
                  content: { title: 'MoodRx', body: nudge.body },
                  trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: triggerDate,
                  },
                });
              }
            }
          }
        }
      } catch {
        // ignore — may not work in Expo Go
      }
    }
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
    color: '#c8c8c8',
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
    color: '#c8c8c8',
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
    color: '#c8c8c8',
    letterSpacing: 3,
  },
});