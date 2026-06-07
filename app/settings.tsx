import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Platform,
  Alert,
  Linking,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { type as t, fonts } from '../lib/typography';
import { getTrashTalkVolume, getUserProfile, getVoiceEnabled, setTrashTalkVolume, setUserProfile, setVoiceEnabled, UserProfile } from '@/lib/storage';
import { exportSessionsJson } from '@/lib/export-sessions';
import { resetAllAppData } from '@/lib/reset-app';
import { useSessions } from '@/contexts/SessionsContext';
import {
  PRESET_TIMES,
  NOTIFICATIONS_ENABLED_KEY,
  scheduleCheckinReminders,
  cancelReminders,
  getReminderSchedule,
  saveReminderSchedule,
  type ReminderSchedule,
} from '@/lib/notifications';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { useHardwareBack } from '@/hooks/useHardwareBack';
import { BottomNav } from '@/components/BottomNav';
import {
  getHealthPlatformLabel,
  getHealthSyncEnabled,
  isHealthBackendReady,
  isHealthSyncAvailable,
  requestHealthPermissions,
  setHealthSyncEnabled,
} from '@/lib/health';

const NOTIFICATIONS_KEY = NOTIFICATIONS_ENABLED_KEY;

export default function SettingsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [reminderSchedule, setReminderSchedule] = useState<ReminderSchedule>({
    weekdayLabel: '8:00 AM',
    weekendLabel: '10:00 AM',
    splitWeekends: false,
  });
  const [permDenied, setPermDenied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [preferredTime, setPreferredTimeState] = useState<UserProfile['preferredTime']>(undefined);
  const [primaryGoal, setPrimaryGoalState] = useState<UserProfile['primaryGoal']>(undefined);
  const [trashTalkVolume, setTrashTalkVolumeState] = useState(0.7);
  const [voiceEnabled, setVoiceEnabledState] = useState(true);
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [healthPlatformLabel, setHealthPlatformLabel] = useState('Health');
  const [healthEnabled, setHealthEnabledState] = useState(false);
  const voiceToggleAnim = useRef(new Animated.Value(1)).current;
  const healthToggleAnim = useRef(new Animated.Value(0)).current;
  const { restorePurchases, isPremium, isInTrial, trialDaysLeft, hasUsedTrial, devTogglePremium, isLoading: subLoading } = useSubscription();
  const { clearSessions, sessions } = useSessions();
  const versionTapCount = useRef(0);
  const versionTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toggleAnim = useRef(new Animated.Value(0)).current;
  const { fadeAnim, slideAnim } = useScreenAnimation();

  const backHandler = useCallback(() => {
    router.back();
    return true;
  }, []);
  useHardwareBack(backHandler);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(NOTIFICATIONS_KEY),
      getReminderSchedule(),
      getUserProfile(),
      getTrashTalkVolume(),
      getVoiceEnabled(),
    ]).then(([notifVal, schedule, profile, volume, voiceOn]) => {
      const enabled = notifVal === 'true';
      setNotificationsEnabled(enabled);
      toggleAnim.setValue(enabled ? 1 : 0);
      setReminderSchedule(schedule);
      if (profile.preferredTime) setPreferredTimeState(profile.preferredTime);
      if (profile.primaryGoal) setPrimaryGoalState(profile.primaryGoal);
      setTrashTalkVolumeState(volume);
      setVoiceEnabledState(voiceOn);
      voiceToggleAnim.setValue(voiceOn ? 1 : 0);
    });
    if (isHealthSyncAvailable()) {
      void isHealthBackendReady().then((ready) => {
        setHealthAvailable(ready);
        if (ready) setHealthPlatformLabel(getHealthPlatformLabel());
      });
      getHealthSyncEnabled().then((on) => {
        setHealthEnabledState(on);
        healthToggleAnim.setValue(on ? 1 : 0);
      }).catch(() => {});
    }
  }, [toggleAnim, voiceToggleAnim, healthToggleAnim]);

  const handleTrashTalkVolumeChange = async (value: number) => {
    setTrashTalkVolumeState(value);
    await setTrashTalkVolume(value);
  };

  const handleVoiceToggle = async () => {
    const next = !voiceEnabled;
    setVoiceEnabledState(next);
    await setVoiceEnabled(next);
    Animated.timing(voiceToggleAnim, {
      toValue: next ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleHealthToggle = async () => {
    if (!healthEnabled) {
      const { granted, mayBeDenied } = await requestHealthPermissions();
      setHealthEnabledState(granted);
      healthToggleAnim.setValue(granted ? 1 : 0);
      if (!granted) {
        Alert.alert(
          'Health access needed',
          Platform.OS === 'android'
            ? 'Install or update Health Connect, then allow MoodRx to read steps/sleep and write workouts.'
            : 'Enable MoodRx in Settings → Health to sync workouts and read steps/sleep.',
        );
      } else if (mayBeDenied && Platform.OS === 'ios') {
        // HealthKit doesn't tell apps when read scopes are denied — a probe
        // returning 0 might mean denied or might mean genuinely 0 today.
        // Surface the hint so users who denied reads aren't stuck looking
        // at empty data forever.
        Alert.alert(
          'Reading 0 steps so far',
          "If you have steps today and they're not showing up, open Settings → Health → Data Access & Devices → MoodRx and make sure steps and sleep are allowed.",
        );
      }
      return;
    }
    await setHealthSyncEnabled(false);
    setHealthEnabledState(false);
    Animated.timing(healthToggleAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  };

  const healthTranslateX = healthToggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 25],
  });

  const voiceTranslateX = voiceToggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  const handleSelectPreferredTime = async (value: UserProfile['preferredTime']) => {
    setPreferredTimeState(value);
    const current = await getUserProfile();
    await setUserProfile({ ...current, preferredTime: value });
  };

  const handleSelectPrimaryGoal = async (value: UserProfile['primaryGoal']) => {
    setPrimaryGoalState(value);
    const current = await getUserProfile();
    await setUserProfile({ ...current, primaryGoal: value });
  };

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
      await scheduleCheckinReminders(reminderSchedule);
    } else {
      setNotificationsEnabled(false);
      animateToggle(0);
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, 'false');
      await cancelReminders();
    }
  };

  const applyReminderSchedule = async (schedule: ReminderSchedule) => {
    setReminderSchedule(schedule);
    await saveReminderSchedule(schedule);
    if (notificationsEnabled) {
      await scheduleCheckinReminders(schedule);
    }
  };

  const handleSelectWeekdayTime = async (timeLabel: string) => {
    await applyReminderSchedule({ ...reminderSchedule, weekdayLabel: timeLabel });
  };

  const handleSelectWeekendTime = async (timeLabel: string) => {
    await applyReminderSchedule({ ...reminderSchedule, weekendLabel: timeLabel });
  };

  const handleToggleSplitWeekends = async () => {
    await applyReminderSchedule({
      ...reminderSchedule,
      splitWeekends: !reminderSchedule.splitWeekends,
    });
  };

  const handleExportSessions = async () => {
    if (sessions.length === 0) {
      Alert.alert('Nothing to export', 'Complete a session first.');
      return;
    }
    try {
      await exportSessionsJson(sessions);
    } catch {
      Alert.alert('Export failed', 'Could not create a share file on this device.');
    }
  };

  const handleDeleteAll = async () => {
    await resetAllAppData();
    await clearSessions();
    setShowDeleteConfirm(false);
    router.replace('/onboarding');
  };

  const translateX = toggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 25],
  });

  // `trialExpired` and the "FREE VERSION" CTA must wait for RC to load — otherwise
  // a paying user briefly sees "TRIAL ENDED / Upgrade to restore full access" on
  // cold start while customerInfo is in flight.
  const trialExpired = !subLoading && hasUsedTrial && !isInTrial && !isPremium;
  const showFreeVersionCTA = !subLoading && !hasUsedTrial && !isPremium;

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

        {/* Subscription section */}
        <Text style={styles.sectionHeader}>SUBSCRIPTION</Text>

        {isPremium && !isInTrial && (
          <View style={styles.subStatusRow}>
            <Text style={styles.subStatusLabel}>STATUS</Text>
            <View style={[styles.subStatusBadge, styles.proBadge]}>
              <Text style={styles.proBadgeText}>PRO</Text>
            </View>
          </View>
        )}

        {isInTrial && (
          <View style={styles.subStatusRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.subStatusLabel}>FREE TRIAL</Text>
              <Text style={styles.trialDaysText}>
                {trialDaysLeft === 1 ? '1 day remaining' : `${trialDaysLeft} days remaining`}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/premium')}
              activeOpacity={0.7}
              style={styles.upgradeBtn}
              accessibilityRole="button"
              accessibilityLabel="Upgrade to Pro"
            >
              <Text style={styles.upgradeBtnText}>UPGRADE →</Text>
            </TouchableOpacity>
          </View>
        )}

        {trialExpired && (
          <View style={styles.subStatusRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.subStatusLabel}>TRIAL ENDED</Text>
              <Text style={styles.expiredText}>Upgrade to restore full access</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/premium')}
              activeOpacity={0.7}
              style={[styles.upgradeBtn, styles.upgradeBtnUrgent]}
              accessibilityRole="button"
              accessibilityLabel="Upgrade to Pro"
            >
              <Text style={styles.upgradeBtnText}>UPGRADE →</Text>
            </TouchableOpacity>
          </View>
        )}

        {showFreeVersionCTA && (
          <View style={styles.subStatusRow}>
            <Text style={styles.subStatusLabel}>FREE VERSION</Text>
            <TouchableOpacity
              onPress={() => router.push('/premium')}
              activeOpacity={0.7}
              style={styles.upgradeBtn}
              accessibilityRole="button"
              accessibilityLabel="View Pro plans"
            >
              <Text style={styles.upgradeBtnText}>TRY PRO →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Training Preferences section */}
        <Text style={styles.sectionHeader}>TRAINING PREFERENCES</Text>

        <Text style={styles.prefLabel}>PREFERRED TIME</Text>
        <View style={styles.chipRow}>
          {(['Morning', 'Afternoon', 'Evening'] as UserProfile['preferredTime'][]).map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => handleSelectPreferredTime(opt)}
              activeOpacity={0.7}
              style={[styles.chip, preferredTime === opt ? styles.chipSelected : styles.chipUnselected]}
              accessibilityRole="radio"
              accessibilityState={{ selected: preferredTime === opt }}
              accessibilityLabel={`${opt} training time`}
            >
              <Text style={[styles.chipText, preferredTime === opt ? styles.chipTextSelected : styles.chipTextUnselected]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.prefLabel, { marginTop: 16 }]}>PRIMARY GOAL</Text>
        <View style={styles.chipRow}>
          {(['Stress relief', 'Energy', 'Sleep', 'Mood'] as UserProfile['primaryGoal'][]).map((opt) => (
            <TouchableOpacity
              key={opt}
              onPress={() => handleSelectPrimaryGoal(opt)}
              activeOpacity={0.7}
              style={[styles.chip, primaryGoal === opt ? styles.chipSelected : styles.chipUnselected]}
              accessibilityRole="radio"
              accessibilityState={{ selected: primaryGoal === opt }}
              accessibilityLabel={`${opt} primary goal`}
            >
              <Text style={[styles.chipText, primaryGoal === opt ? styles.chipTextSelected : styles.chipTextUnselected]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionHeader}>WORKOUT</Text>
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabelBlock}>
            <Text style={styles.toggleLabel}>Dr. MoodRx copy</Text>
            <Text style={styles.prefHint}>Pre/post lines on prescription and post-workout. Softer tone for anxious and low moods.</Text>
          </View>
          <TouchableOpacity
            onPress={handleVoiceToggle}
            activeOpacity={0.8}
            style={[styles.toggle, voiceEnabled ? styles.toggleOn : styles.toggleOff]}
            accessibilityRole="switch"
            accessibilityState={{ checked: voiceEnabled }}
            accessibilityLabel="Dr MoodRx copy"
          >
            <Animated.View style={[styles.toggleCircle, { transform: [{ translateX: voiceTranslateX }] }]} />
          </TouchableOpacity>
        </View>

        <Text style={styles.prefLabel}>TRASH TALK VOLUME</Text>
        <Text style={styles.prefHint}>Only plays when you turn on trash talk during a workout.</Text>
        <View style={styles.volumeRow}>
          <Text style={styles.volumeValue}>{Math.round(trashTalkVolume * 100)}%</Text>
          <Slider
            style={styles.volumeSlider}
            minimumValue={0}
            maximumValue={1}
            step={0.05}
            value={trashTalkVolume}
            onValueChange={handleTrashTalkVolumeChange}
            minimumTrackTintColor="#E8B84B"
            maximumTrackTintColor="#1a1a1a"
            thumbTintColor="#E8B84B"
            accessibilityLabel={`Trash talk volume ${Math.round(trashTalkVolume * 100)} percent`}
            accessibilityRole="adjustable"
          />
        </View>

        {healthAvailable && (
          <>
            <Text style={styles.sectionHeader}>{healthPlatformLabel.toUpperCase()}</Text>
            <Text style={styles.prefHint}>
              {Platform.OS === 'android'
                ? 'Saves workouts and breathing sessions. Reads steps and sleep for Insights. Requires Health Connect and a native Android build.'
                : 'Saves workouts and breathing sessions. Reads steps and sleep for Insights. Requires a device rebuild with HealthKit enabled.'}
            </Text>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Sync with {healthPlatformLabel}</Text>
              <TouchableOpacity
                onPress={handleHealthToggle}
                activeOpacity={0.8}
                style={[styles.toggle, healthEnabled ? styles.toggleOn : styles.toggleOff]}
                accessibilityRole="switch"
                accessibilityState={{ checked: healthEnabled }}
                accessibilityLabel={`${healthPlatformLabel} sync`}
              >
                <Animated.View style={[styles.toggleCircle, { transform: [{ translateX: healthTranslateX }] }]} />
              </TouchableOpacity>
            </View>
          </>
        )}

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
            <Text style={styles.timeSectionLabel}>
              {reminderSchedule.splitWeekends ? 'WEEKDAY REMINDER' : 'REMINDER TIME'}
            </Text>
            <View style={styles.timeChips}>
              {PRESET_TIMES.map((p) => (
                <TouchableOpacity
                  key={p.label}
                  onPress={() => handleSelectWeekdayTime(p.label)}
                  activeOpacity={0.7}
                  style={[
                    styles.timeChip,
                    reminderSchedule.weekdayLabel === p.label ? styles.timeChipSelected : styles.timeChipUnselected,
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: reminderSchedule.weekdayLabel === p.label }}
                  accessibilityLabel={`Weekday reminder at ${p.label}`}
                >
                  <Text
                    style={[
                      styles.timeChipText,
                      reminderSchedule.weekdayLabel === p.label ? styles.timeChipTextSelected : styles.timeChipTextUnselected,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              onPress={handleToggleSplitWeekends}
              activeOpacity={0.7}
              style={styles.splitWeekendsRow}
              accessibilityRole="switch"
              accessibilityState={{ checked: reminderSchedule.splitWeekends }}
              accessibilityLabel="Different reminder time on weekends"
            >
              <Text style={styles.splitWeekendsLabel}>DIFFERENT ON WEEKENDS</Text>
              <View style={[styles.splitWeekendsToggle, reminderSchedule.splitWeekends && styles.splitWeekendsToggleOn]}>
                <Text style={styles.splitWeekendsToggleText}>{reminderSchedule.splitWeekends ? 'ON' : 'OFF'}</Text>
              </View>
            </TouchableOpacity>

            {reminderSchedule.splitWeekends && (
              <>
                <Text style={[styles.timeSectionLabel, { marginTop: 16 }]}>WEEKEND REMINDER</Text>
                <View style={styles.timeChips}>
                  {PRESET_TIMES.map((p) => (
                    <TouchableOpacity
                      key={`weekend-${p.label}`}
                      onPress={() => handleSelectWeekendTime(p.label)}
                      activeOpacity={0.7}
                      style={[
                        styles.timeChip,
                        reminderSchedule.weekendLabel === p.label ? styles.timeChipSelected : styles.timeChipUnselected,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: reminderSchedule.weekendLabel === p.label }}
                      accessibilityLabel={`Weekend reminder at ${p.label}`}
                    >
                      <Text
                        style={[
                          styles.timeChipText,
                          reminderSchedule.weekendLabel === p.label ? styles.timeChipTextSelected : styles.timeChipTextUnselected,
                        ]}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        )}

        {/* About section */}
        <Text style={styles.sectionHeader}>ABOUT</Text>
        <Text style={styles.appName}>MoodRx</Text>
        <Text style={styles.appTagline}>Move for your mind.</Text>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            if (!__DEV__) return;
            versionTapCount.current += 1;
            if (versionTapTimer.current) clearTimeout(versionTapTimer.current);
            if (versionTapCount.current >= 5) {
              versionTapCount.current = 0;
              devTogglePremium();
            } else {
              versionTapTimer.current = setTimeout(() => { versionTapCount.current = 0; }, 2000);
            }
          }}
          accessibilityLabel="App version"
        >
          <Text style={styles.appVersion}>Version 1.0.0</Text>
        </TouchableOpacity>
        {isPremium && !isInTrial && (
          <View style={[styles.subStatusBadge, styles.proBadge, styles.versionProBadge]}>
            <Text style={styles.proBadgeText}>PRO MEMBER</Text>
          </View>
        )}

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

        <TouchableOpacity
          onPress={handleExportSessions}
          activeOpacity={0.7}
          style={styles.dataRow}
          accessibilityRole="button"
          accessibilityLabel="Export sessions as JSON"
        >
          <Text style={styles.dataRowText}>EXPORT SESSIONS (JSON)</Text>
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
          onPress={() => Linking.openURL('https://soul2fade.github.io/moodrx/privacy-policy.html')}
          activeOpacity={0.7}
          style={styles.legalLink}
          accessibilityRole="link"
          accessibilityLabel="Privacy Policy"
        >
          <Text style={styles.legalLinkText}>PRIVACY POLICY</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => Linking.openURL('https://soul2fade.github.io/moodrx/terms.html')}
          activeOpacity={0.7}
          style={styles.legalLink}
          accessibilityRole="link"
          accessibilityLabel="Terms of Service"
        >
          <Text style={styles.legalLinkText}>TERMS OF SERVICE</Text>
        </TouchableOpacity>

        <View style={{ height: 12 }} />
      </ScrollView>
      <BottomNav />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { flex: 1 },
  content: { paddingTop: 56, paddingHorizontal: 24, paddingBottom: 16 },
  backButton: { ...t.label, color: '#ffffff', letterSpacing: 2 },
  settingsLabel: { ...t.label, color: '#ffffff', letterSpacing: 3, marginTop: 24 },
  headline: { ...t.headlineMd, fontSize: 24, marginTop: 8 },
  sectionHeader: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 3,
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingTop: 16,
  },
  subStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  subStatusLabel: { ...t.label, color: '#ffffff', letterSpacing: 2 },
  subStatusBadge: { alignSelf: 'flex-start' },
  trialDaysText: { ...t.bodySm, color: '#E8B84B', marginTop: 4 },
  expiredText: { ...t.bodySm, color: '#ffffff', marginTop: 4 },
  proBadge: {
    borderWidth: 1,
    borderColor: '#E8B84B',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  proBadgeText: { ...t.label, color: '#E8B84B', letterSpacing: 2 },
  upgradeBtn: {
    borderWidth: 1,
    borderColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  upgradeBtnUrgent: {
    borderColor: '#E8B84B',
  },
  upgradeBtnText: { ...t.label, color: '#ffffff', letterSpacing: 2 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  toggleLabelBlock: { flex: 1, marginRight: 12 },
  toggleLabel: { ...t.body, fontSize: 15 },
  toggle: { width: 50, height: 28, borderRadius: 0, justifyContent: 'center' },
  toggleOff: { backgroundColor: '#1a1a1a' },
  toggleOn: { backgroundColor: '#059669' },
  toggleCircle: { width: 22, height: 22, backgroundColor: '#ffffff', borderRadius: 0 },
  permDenied: { ...t.bodySm, color: '#E11D48', marginTop: 8 },
  timeSection: {
    marginTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  timeSectionLabel: { ...t.label, color: '#ffffff', letterSpacing: 3, marginBottom: 12 },
  timeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeChip: { borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  timeChipSelected: { borderColor: '#059669' },
  timeChipUnselected: { borderColor: '#1a1a1a' },
  timeChipText: { ...t.label, letterSpacing: 1 },
  timeChipTextSelected: { color: '#ffffff' },
  timeChipTextUnselected: { color: '#a3a3a3' },
  splitWeekendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  splitWeekendsLabel: { ...t.label, color: '#c8c8c8', letterSpacing: 2, fontSize: 12, lineHeight: 17 },
  splitWeekendsToggle: {
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  splitWeekendsToggleOn: { borderColor: '#059669', backgroundColor: '#05966918' },
  splitWeekendsToggleText: { ...t.label, color: '#999999', fontSize: 12, letterSpacing: 1.5, lineHeight: 17 },
  prefLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 12,
    lineHeight: 17,
    color: '#888',
    letterSpacing: 3,
    textTransform: 'uppercase' as const,
    marginTop: 12,
    marginBottom: 10,
  },
  prefHint: {
    ...t.bodySm,
    color: '#a3a3a3',
    marginBottom: 8,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  volumeValue: {
    ...t.label,
    color: '#E8B84B',
    width: 44,
    letterSpacing: 1,
  },
  volumeSlider: {
    flex: 1,
    height: 36,
  },
  versionProBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  chip: { borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  chipSelected: { borderColor: '#059669' },
  chipUnselected: { borderColor: '#2a2a2a' },
  chipText: { fontFamily: fonts.mono.regular, fontSize: 12, lineHeight: 17, letterSpacing: 1, textTransform: 'uppercase' as const },
  chipTextSelected: { color: '#ffffff' },
  chipTextUnselected: { color: '#999' },
  appName: { ...t.headlineSm, marginTop: 12 },
  appTagline: { ...t.bodyMuted, fontSize: 14, marginTop: 4 },
  appVersion: { ...t.label, color: '#c8c8c8', letterSpacing: 2, marginTop: 8 },
  dataRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  dataRowText: { ...t.label, color: '#ffffff', letterSpacing: 2 },
  deleteRowText: { ...t.label, color: '#E11D48', letterSpacing: 2 },
  deleteConfirm: {
    borderWidth: 1,
    borderColor: '#E11D48',
    padding: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  deleteConfirmTitle: { ...t.body, fontSize: 14 },
  deleteConfirmSub: { ...t.bodySm, color: '#ffffff', marginTop: 4 },
  deleteConfirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  neverMindText: { ...t.label, color: '#ffffff' },
  deleteItButton: {
    borderWidth: 1,
    borderColor: '#E11D48',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  deleteItText: { ...t.label, color: '#E11D48', letterSpacing: 1 },
  disclaimer: {
    ...t.label,
    fontFamily: fonts.mono.regular,
    color: '#ffffff',
    fontSize: 12,
    letterSpacing: 0.5,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 12,
    textTransform: 'none' as const,
  },
  legalLink: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  legalLinkText: { ...t.label, color: '#ffffff', letterSpacing: 2 },
});
