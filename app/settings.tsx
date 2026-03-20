import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Platform,
  Linking,
  BackHandler,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { type as t, fonts } from '../lib/typography';
import { clearAllData } from '@/lib/storage';
import { useSubscription } from '@/contexts/SubscriptionContext';

const NOTIFICATIONS_KEY = 'notifications_enabled';
const REMINDER_TIME_KEY = 'reminder_time';

const PRESET_TIMES = [
  { label: '8:00 AM', hour: 8, minute: 0 },
  { label: '12:00 PM', hour: 12, minute: 0 },
  { label: '6:00 PM', hour: 18, minute: 0 },
  { label: '9:00 PM', hour: 21, minute: 0 },
];

export default function SettingsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [selectedTime, setSelectedTime] = useState('8:00 AM');
  const [permDenied, setPermDenied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const { restorePurchases } = useSubscription();
  const toggleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Android hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    // Load persisted state
    Promise.all([
      AsyncStorage.getItem(NOTIFICATIONS_KEY),
      AsyncStorage.getItem(REMINDER_TIME_KEY),
    ]).then(([notifVal, timeVal]) => {
      const enabled = notifVal === 'true';
      setNotificationsEnabled(enabled);
      toggleAnim.setValue(enabled ? 1 : 0);
      if (timeVal) setSelectedTime(timeVal);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animateToggle = (toValue: number) => {
    Animated.spring(toggleAnim, {
      toValue,
      useNativeDriver: false,
      speed: 20,
      bounciness: 4,
    }).start();
  };

  const handleToggle = async () => {
    if (!notificationsEnabled) {
      // Turn on
      if (Platform.OS !== 'web') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          setPermDenied(true);
          return;
        }
      }
      setPermDenied(false);
      setNotificationsEnabled(true);
      animateToggle(1);
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, 'true');
      await scheduleNotification(selectedTime);
    } else {
      // Turn off
      setNotificationsEnabled(false);
      animateToggle(0);
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, 'false');
      if (Platform.OS !== 'web') {
        await Notifications.cancelAllScheduledNotificationsAsync();
      }
    }
  };

  const scheduleNotification = async (timeLabel: string) => {
    if (Platform.OS === 'web') return;
    const preset = PRESET_TIMES.find((p) => p.label === timeLabel);
    if (!preset) return;
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'MoodRx',
          body: 'Time to check in. How bad is it today?',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: preset.hour,
          minute: preset.minute,
        },
      });
    } catch {
      // ignore — may not work in Expo Go
    }
  };

  const handleSelectTime = async (timeLabel: string) => {
    setSelectedTime(timeLabel);
    await AsyncStorage.setItem(REMINDER_TIME_KEY, timeLabel);
    if (notificationsEnabled) {
      await scheduleNotification(timeLabel);
    }
  };

  const handleDeleteAll = async () => {
    await clearAllData();
    setShowDeleteConfirm(false);
    router.replace('/onboarding');
  };

  const translateX = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 25],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backButton}>← HOME</Text>
        </TouchableOpacity>

        <Text style={styles.settingsLabel}>SETTINGS</Text>
        <Text style={styles.headline}>Preferences.</Text>

        {/* Reminders section */}
        <Text style={styles.sectionHeader}>REMINDERS</Text>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Daily check-in reminder</Text>
          <TouchableOpacity
            onPress={handleToggle}
            activeOpacity={0.8}
            style={[styles.toggle, notificationsEnabled ? styles.toggleOn : styles.toggleOff]}
            accessibilityRole="switch"
            accessibilityState={{ checked: notificationsEnabled }}
            accessibilityLabel="Daily check-in reminder"
          >
            <Animated.View style={[styles.toggleCircle, { transform: [{ translateX }] }]} />
          </TouchableOpacity>
        </View>

        {permDenied && (
          <Text style={styles.permDenied}>
            Notifications blocked. Enable in your device settings.
          </Text>
        )}

        {notificationsEnabled && (
          <View style={styles.timeSection}>
            <Text style={styles.timeSectionLabel}>REMINDER TIME</Text>
            <View style={styles.timeChips}>
              {PRESET_TIMES.map((p) => (
                <TouchableOpacity
                  key={p.label}
                  onPress={() => handleSelectTime(p.label)}
                  activeOpacity={0.7}
                  style={[
                    styles.timeChip,
                    selectedTime === p.label ? styles.timeChipSelected : styles.timeChipUnselected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedTime === p.label }}
                  accessibilityLabel={`Reminder at ${p.label}`}
                >
                  <Text
                    style={[
                      styles.timeChipText,
                      selectedTime === p.label ? styles.timeChipTextSelected : styles.timeChipTextUnselected,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* About section */}
        <Text style={styles.sectionHeader}>ABOUT</Text>
        <Text style={styles.appName}>MoodRx</Text>
        <Text style={styles.appTagline}>Move for your mind.</Text>
        <Text style={styles.appVersion}>Version 1.0.0</Text>

        {/* Data section */}
        <Text style={styles.sectionHeader}>DATA</Text>

        <TouchableOpacity
          onPress={restorePurchases}
          activeOpacity={0.7}
          style={styles.dataRow}
          accessibilityRole="button"
          accessibilityLabel="Restore purchases"
        >
          <Text style={styles.dataRowText}>RESTORE PURCHASES</Text>
        </TouchableOpacity>

        {!showDeleteConfirm ? (
          <TouchableOpacity
            onPress={() => setShowDeleteConfirm(true)}
            activeOpacity={0.7}
            style={styles.dataRow}
            accessibilityRole="button"
            accessibilityLabel="Delete all data"
          >
            <Text style={styles.deleteRowText}>DELETE ALL DATA</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.deleteConfirm} accessibilityRole="alert">
            <Text style={styles.deleteConfirmTitle}>Permanently delete all data?</Text>
            <Text style={styles.deleteConfirmSub}>Sessions, streaks, supplements. Gone.</Text>
            <View style={styles.deleteConfirmButtons}>
              <TouchableOpacity
                onPress={() => setShowDeleteConfirm(false)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Cancel deletion"
              >
                <Text style={styles.neverMindText}>KEEP IT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteAll}
                activeOpacity={0.7}
                style={styles.deleteItButton}
                accessibilityRole="button"
                accessibilityLabel="Confirm delete all data"
              >
                <Text style={styles.deleteItText}>DELETE</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Legal section */}
        <Text style={styles.sectionHeader}>LEGAL</Text>
        <Text style={styles.disclaimer}>
          MoodRx is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider with questions about a medical condition. If you are experiencing a mental health crisis, contact the 988 Suicide & Crisis Lifeline (call or text 988) or go to your nearest emergency room.
        </Text>
        <TouchableOpacity
          onPress={() => Linking.openURL('https://courageous-gingersnap-6f23d7.netlify.app/privacy')}
          activeOpacity={0.7}
          style={styles.legalLink}
          accessibilityRole="link"
          accessibilityLabel="Privacy Policy"
        >
          <Text style={styles.legalLinkText}>PRIVACY POLICY</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Linking.openURL('https://courageous-gingersnap-6f23d7.netlify.app/terms')}
          activeOpacity={0.7}
          style={styles.legalLink}
          accessibilityRole="link"
          accessibilityLabel="Terms of Service"
        >
          <Text style={styles.legalLinkText}>TERMS OF SERVICE</Text>
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  backButton: {
    ...t.label,
    color: '#737373',
    letterSpacing: 2,
  },
  settingsLabel: {
    ...t.label,
    color: '#737373',
    letterSpacing: 3,
    marginTop: 24,
  },
  headline: {
    ...t.headlineMd,
    fontSize: 24,
    marginTop: 8,
  },
  sectionHeader: {
    ...t.label,
    color: '#737373',
    letterSpacing: 3,
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingTop: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  toggleLabel: {
    ...t.body,
    fontSize: 15,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 0,
    justifyContent: 'center',
  },
  toggleOff: {
    backgroundColor: '#1a1a1a',
  },
  toggleOn: {
    backgroundColor: '#059669',
  },
  toggleCircle: {
    width: 22,
    height: 22,
    backgroundColor: '#ffffff',
    borderRadius: 0,
  },
  permDenied: {
    ...t.bodySm,
    color: '#E11D48',
    marginTop: 8,
  },
  timeSection: {
    marginTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  timeSectionLabel: {
    ...t.label,
    color: '#737373',
    letterSpacing: 3,
    marginBottom: 12,
  },
  timeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeChip: {
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  timeChipSelected: {
    borderColor: '#059669',
  },
  timeChipUnselected: {
    borderColor: '#1a1a1a',
  },
  timeChipText: {
    ...t.label,
    letterSpacing: 1,
  },
  timeChipTextSelected: {
    color: '#ffffff',
  },
  timeChipTextUnselected: {
    color: '#737373',
  },
  appName: {
    ...t.headlineSm,
    marginTop: 12,
  },
  appTagline: {
    ...t.bodyMuted,
    fontSize: 14,
    marginTop: 4,
  },
  appVersion: {
    ...t.label,
    color: '#737373',
    letterSpacing: 2,
    marginTop: 8,
  },
  dataRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  dataRowText: {
    ...t.label,
    color: '#737373',
    letterSpacing: 2,
  },
  deleteRowText: {
    ...t.label,
    color: '#E11D48',
    letterSpacing: 2,
  },
  deleteConfirm: {
    borderWidth: 1,
    borderColor: '#E11D48',
    padding: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  deleteConfirmTitle: {
    ...t.body,
    fontSize: 14,
  },
  deleteConfirmSub: {
    ...t.bodySm,
    color: '#737373',
    marginTop: 4,
  },
  deleteConfirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  neverMindText: {
    ...t.label,
    color: '#737373',
  },
  deleteItButton: {
    borderWidth: 1,
    borderColor: '#E11D48',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  deleteItText: {
    ...t.label,
    color: '#E11D48',
    letterSpacing: 1,
  },
  disclaimer: {
    ...t.label,
    fontFamily: fonts.mono.regular,
    color: '#525252',
    fontSize: 9,
    letterSpacing: 0.5,
    lineHeight: 14,
    textAlign: 'center',
    marginTop: 12,
    textTransform: 'none' as const,
  },
  legalLink: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  legalLinkText: {
    ...t.label,
    color: '#737373',
    letterSpacing: 2,
  },
});