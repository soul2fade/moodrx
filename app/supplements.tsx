import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { SUPPLEMENTS } from '@/lib/supplements';
import {
  getSupplementLogs,
  toggleSupplementLog,
  getSessions,
  sessionDateString,
  SupplementLog,
  Session,
  MoodKey,
  getSupplementReminderPrefs,
  saveSupplementReminderPrefs,
} from '@/lib/storage';
import {
  scheduleSupplementReminder,
  cancelSupplementReminder,
  SUPPLEMENT_PRESET_TIMES,
  DEFAULT_SUPPLEMENT_TIME,
} from '@/lib/notifications';
import { MOODS, MOOD_ORDER } from '@/lib/moods';
import { todayDateString, formatTodayLabel, toDateString, MONTH_ABBREVS } from '@/lib/dateUtils';
import { type as t, fonts } from '../lib/typography';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { BottomNav } from '@/components/BottomNav';
import { PriceChip } from '@/components/PriceChip';
import { PremiumSheet } from '@/components/PremiumSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TabKey = 'TODAY' | 'HISTORY' | 'ALL';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

interface DayAdherence {
  taken: boolean;
  isFuture: boolean;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDates(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return toDateString(d.getTime());
  });
}

function formatWeekLabel(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const s = `${String(weekStart.getDate()).padStart(2,'0')} ${MONTH_ABBREVS[weekStart.getMonth()]}`;
  const e = `${String(end.getDate()).padStart(2,'0')} ${MONTH_ABBREVS[end.getMonth()]}`;
  return `${s} – ${e}`;
}

/** Build Mon-Sun adherence for the current calendar week. Future days are flagged. */
function buildWeekAdherence(logs: SupplementLog[]): DayAdherence[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const weekStart = getWeekStart(today);
  const result: DayAdherence[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    const dateStr = toDateString(d.getTime());
    const isFuture = d.getTime() > todayMs;
    const taken = !isFuture && logs.some((l) => l.date === dateStr && l.taken);
    result.push({ taken, isFuture });
  }
  return result;
}

function countWeekTaken(adherence: DayAdherence[]): number {
  return adherence.filter((a) => !a.isFuture && a.taken).length;
}

/** Find the best mood for a given week from session history (used for week-level badge). */
function getMoodForWeek(sessions: Session[], weekDates: string[]): MoodKey | null {
  const weekDateSet = new Set(weekDates);
  const lastDay = weekDates[6];
  const inWeek = sessions.filter((s) => weekDateSet.has(sessionDateString(s)));
  if (inWeek.length > 0) {
    const sorted = [...inWeek].sort((a, b) => b.timestamp - a.timestamp);
    const raw = sorted[0].mood as string;
    return raw in MOODS ? (raw as MoodKey) : null;
  }
  const before = sessions.filter((s) => sessionDateString(s) <= lastDay);
  if (before.length > 0) {
    const sorted = [...before].sort((a, b) => b.timestamp - a.timestamp);
    const raw = sorted[0].mood as string;
    return raw in MOODS ? (raw as MoodKey) : null;
  }
  return null;
}

/**
 * For a specific calendar date, find the mood from the most recent session
 * on or before that date. Returns null if no sessions exist before/on that date.
 */
function getMoodForDay(sessions: Session[], dateStr: string): MoodKey | null {
  const onOrBefore = sessions.filter((s) => sessionDateString(s) <= dateStr);
  if (onOrBefore.length === 0) return null;
  const sorted = [...onOrBefore].sort((a, b) => b.timestamp - a.timestamp);
  const raw = sorted[0].mood as string;
  return raw in MOODS ? (raw as MoodKey) : null;
}

function SupplementsScreen() {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<SupplementLog[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [lastMood, setLastMood] = useState<MoodKey | null>(null);
  const [expandedSupp, setExpandedSupp] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('TODAY');
  const [allFilterMood, setAllFilterMood] = useState<MoodKey | null>(null);

  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState(DEFAULT_SUPPLEMENT_TIME);
  const [reminderPermDenied, setReminderPermDenied] = useState(false);
  const [showPremiumSheet, setShowPremiumSheet] = useState(false);
  const reminderToggleAnim = useRef(new Animated.Value(0)).current;

  const today = todayDateString();
  const { isPremium, isLoading: subLoading } = useSubscription();
  // Wait for subscription state to resolve before gating the reminder UI —
  // otherwise entitled users briefly see it locked on cold start (isPremium
  // is false until RevenueCat finishes loading).
  const canUseReminder = !subLoading && isPremium;

  const { fadeAnim, slideAnim } = useScreenAnimation();

  const loadData = useCallback(() => {
    getSupplementLogs().then(setLogs).catch(() => setLogs([]));
    getSessions().then((s: Session[]) => {
      setSessions(s);
      if (s.length > 0) {
        const sorted = [...s].sort((a, b) => b.timestamp - a.timestamp);
        const raw = sorted[0].mood as string;
        setLastMood(raw in MOODS ? (raw as MoodKey) : null);
      } else {
        setLastMood(null);
      }
    }).catch(() => { setSessions([]); setLastMood(null); });
    getSupplementReminderPrefs().then((prefs) => {
      setReminderEnabled(prefs.enabled);
      setReminderTime(prefs.timeLabel);
      reminderToggleAnim.setValue(prefs.enabled ? 1 : 0);
    }).catch(() => {});
  }, [reminderToggleAnim]);

  useFocusEffect(loadData);

  const visibleSupplements = useMemo(
    () => (lastMood ? SUPPLEMENTS.filter((s) => s.moods.includes(lastMood)) : SUPPLEMENTS),
    [lastMood]
  );

  const takenSet = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) {
      if (l.date === today && l.taken) set.add(l.supplementName);
    }
    return set;
  }, [logs, today]);

  const takenCount = useMemo(
    () => visibleSupplements.reduce((n, s) => n + (takenSet.has(s.name) ? 1 : 0), 0),
    [visibleSupplements, takenSet]
  );
  const totalCount = visibleSupplements.length;

  const accentColor = lastMood ? MOODS[lastMood].color : '#059669';

  const weekAdherence = useMemo(() => buildWeekAdherence(logs), [logs]);
  const weekTakenCount = useMemo(() => countWeekTaken(weekAdherence), [weekAdherence]);

  const handleToggle = async (supplementName: string) => {
    await toggleSupplementLog(supplementName, today);
    loadData();
  };

  const animateReminderToggle = (toValue: number) => {
    Animated.spring(reminderToggleAnim, {
      toValue,
      useNativeDriver: false,
      speed: 20,
      bounciness: 4,
    }).start();
  };

  const handleReminderToggle = async () => {
    if (!reminderEnabled) {
      if (Platform.OS !== 'web') {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status !== 'granted') {
          setReminderPermDenied(true);
          return;
        }
      }
      setReminderPermDenied(false);
      setReminderEnabled(true);
      animateReminderToggle(1);
      const prefs = { enabled: true, timeLabel: reminderTime };
      await saveSupplementReminderPrefs(prefs);
      const preset = SUPPLEMENT_PRESET_TIMES.find((p) => p.label === reminderTime);
      if (preset) await scheduleSupplementReminder(preset.hour, preset.minute);
    } else {
      setReminderEnabled(false);
      animateReminderToggle(0);
      await saveSupplementReminderPrefs({ enabled: false, timeLabel: reminderTime });
      await cancelSupplementReminder();
    }
  };

  const handleReminderTimeSelect = async (timeLabel: string) => {
    setReminderTime(timeLabel);
    await saveSupplementReminderPrefs({ enabled: reminderEnabled, timeLabel });
    if (reminderEnabled) {
      const preset = SUPPLEMENT_PRESET_TIMES.find((p) => p.label === timeLabel);
      if (preset) await scheduleSupplementReminder(preset.hour, preset.minute);
    }
  };

  const reminderToggleX = reminderToggleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 25],
  });

  const handleExpand = (supplementName: string) => {
    setExpandedSupp((prev) => (prev === supplementName ? null : supplementName));
  };

  const filteredCatalog = useMemo(() => {
    if (!allFilterMood) return SUPPLEMENTS;
    return SUPPLEMENTS.filter((s) => s.moods.includes(allFilterMood));
  }, [allFilterMood]);

  const historyWeeks = useMemo(() => {
    const todayObj = new Date();
    todayObj.setHours(0, 0, 0, 0);
    const currentWeekStart = getWeekStart(todayObj);
    return Array.from({ length: 4 }, (_, w) => {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(weekStart.getDate() - w * 7);
      return weekStart;
    });
  }, []);

  /** History tab renders weeks × days × supplements cells, each previously
   *  doing logs.some(l => l.date === d && l.supplementName === n && l.taken)
   *  — O(weeks × days × supplements × logs) per render, ~245k operations
   *  after a year of usage. Pre-index taken logs into a Set keyed by
   *  `${date}|${supplementName}` so each cell becomes an O(1) lookup. */
  const historyTakenSet = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) {
      if (l.taken) set.add(`${l.date}|${l.supplementName}`);
    }
    return set;
  }, [logs]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 8, 56) }]}>
        <Text style={styles.trackerLabel}>SUPPLEMENT PRO</Text>
        <Text style={styles.headline}>Your stack.</Text>
        <Text style={styles.dateLabel}>{formatTodayLabel()}</Text>
      </View>

      {/* Tab switcher */}
      <View style={styles.tabSwitcher}>
        {(['TODAY', 'HISTORY', 'ALL'] as TabKey[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
            style={styles.tabBtn}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab }}
          >
            <Text style={[styles.tabBtnText, activeTab === tab && { color: '#ffffff' }]}>
              {tab}
            </Text>
            {activeTab === tab && <View style={[styles.tabUnderline, { backgroundColor: accentColor }]} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* TODAY */}
      {activeTab === 'TODAY' && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Mood badge */}
          {lastMood ? (
            <View style={[styles.moodFilterBadge, { borderLeftColor: accentColor }]}>
              <Text style={styles.moodFilterLabel}>MATCHED TO</Text>
              <Text style={[styles.moodFilterMood, { color: accentColor }]}>
                {MOODS[lastMood].name.toUpperCase()}
              </Text>
            </View>
          ) : (
            <View style={styles.moodFilterBadge}>
              <Text style={styles.moodFilterNote}>Select a mood to see your matched stack.</Text>
            </View>
          )}

          {/* 7-day adherence strip — Mon through Sun of current week */}
          <View style={styles.adherenceStrip}>
            <View style={styles.adherenceDots}>
              {weekAdherence.map((day, i) => (
                <View key={i} style={styles.adherenceDotCol}>
                  <View
                    style={[
                      day.isFuture
                        ? styles.adherenceDotFuture
                        : day.taken
                        ? [styles.adherenceDot, { backgroundColor: accentColor }]
                        : styles.adherenceDotEmpty,
                    ]}
                  />
                  <Text style={styles.adherenceDayLabel}>{DAY_LABELS[i]}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.adherenceCountText}>
              <Text style={{ color: accentColor }}>{weekTakenCount}</Text>
              <Text style={styles.adherenceCountOf}>/7 THIS WEEK</Text>
            </Text>
          </View>

          {/* Progress summary */}
          <View
            style={styles.progressRow}
            accessible={true}
            accessibilityLabel={`${takenCount} of ${totalCount} supplements taken today`}
          >
            <View style={styles.progressCountWrapper} importantForAccessibility="no-hide-descendants">
              <Text style={[styles.progressCountAccent, { color: accentColor }]}>{takenCount}</Text>
              <Text style={styles.progressCountSlash}> / {totalCount}</Text>
            </View>
            <Text style={styles.progressLabel}>TODAY</Text>
          </View>

          {/* Supplement reminder card (premium only) */}
          {canUseReminder ? (
            <View style={styles.reminderCard}>
              <View style={styles.reminderHeader}>
                <Text style={styles.reminderLabel}>DAILY REMINDER</Text>
                <TouchableOpacity
                  onPress={handleReminderToggle}
                  activeOpacity={0.8}
                  style={[styles.reminderToggle, reminderEnabled ? styles.reminderToggleOn : styles.reminderToggleOff]}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: reminderEnabled }}
                  accessibilityLabel="Daily supplement reminder"
                >
                  <Animated.View style={[styles.reminderToggleCircle, { transform: [{ translateX: reminderToggleX }] }]} />
                </TouchableOpacity>
              </View>
              {reminderPermDenied && (
                <Text style={styles.reminderPermDenied}>
                  Notifications blocked. Enable in device settings.
                </Text>
              )}
              {reminderEnabled && (
                <View style={styles.reminderTimeRow}>
                  {SUPPLEMENT_PRESET_TIMES.map((p) => (
                    <TouchableOpacity
                      key={p.label}
                      onPress={() => handleReminderTimeSelect(p.label)}
                      activeOpacity={0.7}
                      style={[
                        styles.reminderTimeChip,
                        reminderTime === p.label
                          ? [styles.reminderTimeChipOn, { borderColor: accentColor }]
                          : styles.reminderTimeChipOff,
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: reminderTime === p.label }}
                      accessibilityLabel={`Reminder at ${p.label}`}
                    >
                      <Text
                        style={[
                          styles.reminderTimeChipText,
                          reminderTime === p.label ? { color: '#ffffff' } : { color: '#cdcdcd' },
                        ]}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.reminderCard, styles.reminderCardLocked]}>
              <Text style={styles.reminderLabel}>DAILY REMINDER</Text>
              <Text style={styles.reminderLockedText}>Daily supplement reminders are part of the base unlock.</Text>
              <View style={styles.reminderLockedSpacer} />
              <PriceChip onPress={() => setShowPremiumSheet(true)} accessibilityLabel="Unlock daily reminders" />
            </View>
          )}

          {/* Priority card */}
          {visibleSupplements.length > 0 && (() => {
            const priority = visibleSupplements[0];
            const isPriorityTaken = takenSet.has(priority.name);
            return (
              <View style={[styles.priorityCard, { borderLeftColor: accentColor }]}>
                <Text style={styles.priorityCardLabel}>TODAY&apos;S PRIORITY</Text>
                <Text style={styles.priorityCardHeadline}>One thing. Take it.</Text>
                <Text style={styles.priorityCardName}>{priority.name}</Text>
                <Text style={styles.priorityCardDose}>{priority.dose} · {priority.timing.toUpperCase()}</Text>
                <Text style={styles.priorityCardScience}>{priority.science}</Text>
                <TouchableOpacity
                  onPress={() => handleToggle(priority.name)}
                  activeOpacity={0.7}
                  style={[styles.priorityCheckBtn, isPriorityTaken && { borderColor: accentColor }]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isPriorityTaken }}
                  accessibilityLabel={`${priority.name}: ${isPriorityTaken ? 'taken' : 'not taken'}. Tap to toggle.`}
                >
                  <Text style={[styles.priorityCheckBtnText, isPriorityTaken && { color: accentColor }]}>
                    {isPriorityTaken ? 'TAKEN ✓' : 'MARK AS TAKEN'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })()}

          {/* Supplement list */}
          <View style={styles.supplementList}>
            {visibleSupplements.map((supp) => {
              const isTaken = takenSet.has(supp.name);
              const isExpanded = expandedSupp === supp.name;
              return (
                <View key={supp.name}>
                  <View style={styles.supplementRow}>
                    <TouchableOpacity
                      onPress={() => handleToggle(supp.name)}
                      activeOpacity={0.7}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isTaken }}
                      accessibilityLabel={`${supp.name}: ${isTaken ? 'taken' : 'not taken'}. Tap to toggle.`}
                    >
                      <View style={[isTaken ? styles.checkboxTaken : styles.checkboxEmpty,
                        isTaken ? { borderColor: accentColor } : {}]}>
                        {isTaken && <View style={[styles.checkboxFill, { backgroundColor: accentColor }]} />}
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.supplementExpandArea}
                      onPress={() => handleExpand(supp.name)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`${supp.name}, ${supp.benefit}. ${isExpanded ? 'Collapse' : 'Expand'} details`}
                    >
                      <View style={styles.supplementInfo}>
                        <Text style={styles.supplementName}>{supp.name}</Text>
                        <Text style={styles.supplementBenefit}>{supp.benefit}</Text>
                      </View>
                      <View style={styles.supplementRight}>
                        <Text style={styles.supplementDose}>{supp.dose}</Text>
                        <Text style={styles.supplementTiming}>{supp.timing.toUpperCase()}</Text>
                        <Text style={[styles.expandChevron, { color: accentColor }]}>
                          {isExpanded ? '▲' : '▼'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {isExpanded && (
                    <View style={[styles.sciencePanel, { borderLeftColor: accentColor }]}>
                      <Text style={styles.sciencePanelLabel}>GOOD FOR</Text>
                      <View style={styles.moodTagRow}>
                        {supp.moods.map((m) => (
                          <View key={m} style={[styles.moodTag, { borderColor: MOODS[m].color }]}>
                            <Text style={[styles.moodTagText, { color: MOODS[m].color }]}>{MOODS[m].name.toUpperCase()}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={[styles.sciencePanelLabel, { marginTop: 14 }]}>WHY THIS WORKS</Text>
                      <Text style={styles.sciencePanelText}>{supp.science}</Text>
                      {(supp.sources?.length ?? 0) > 0 && (
                        <>
                          <Text style={[styles.sciencePanelLabel, { marginTop: 14 }]}>SOURCES</Text>
                          {supp.sources.map((src, i) => (
                            <Text key={i} style={styles.sourceText}>{i + 1}. {src}</Text>
                          ))}
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* HISTORY */}
      {activeTab === 'HISTORY' && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionNote}>
            Last 4 weeks · dot = taken · – = not in your stack that day
          </Text>
          {historyWeeks.map((weekStart, wi) => {
            const weekDates = getWeekDates(weekStart);
            const weekLabel = formatWeekLabel(weekStart);
            const moodForWeek = getMoodForWeek(sessions, weekDates);

            // Build per-day moods for accurate per-day supplement stacks
            const dayMoods: (MoodKey | null)[] = weekDates.map((dateStr) =>
              getMoodForDay(sessions, dateStr)
            );

            // Collect the union of supplements relevant across all days in the week
            const suppSet = new Set<string>();
            dayMoods.forEach((mood) => {
              if (mood) {
                SUPPLEMENTS.filter((s) => s.moods.includes(mood)).forEach((s) => suppSet.add(s.name));
              }
            });
            // Fall back to a generic subset if no mood data exists for the whole week
            const suppsForWeek = suppSet.size > 0
              ? SUPPLEMENTS.filter((s) => suppSet.has(s.name))
              : SUPPLEMENTS.slice(0, 6);

            return (
              <View key={wi} style={styles.weekBlock}>
                <View style={styles.weekLabelRow}>
                  <Text style={styles.weekLabel}>{weekLabel}</Text>
                  {moodForWeek && (
                    <Text style={[styles.weekMoodBadge, { color: MOODS[moodForWeek].color }]}>
                      {MOODS[moodForWeek].name.toUpperCase()}
                    </Text>
                  )}
                </View>

                {/* Day column headers */}
                <View style={styles.historyGridRow}>
                  <View style={styles.historyNameCell} />
                  {weekDates.map((dateStr, di) => {
                    const dayMood = dayMoods[di];
                    return (
                      <View key={di} style={styles.historyDayCell}>
                        <Text style={styles.historyDayHeader}>{DAY_LABELS[di]}</Text>
                        {dayMood && (
                          <View
                            style={[
                              styles.historyDayMoodDot,
                              { backgroundColor: MOODS[dayMood].color },
                            ]}
                          />
                        )}
                      </View>
                    );
                  })}
                </View>

                {/* Supplement rows */}
                {suppsForWeek.map((supp) => (
                  <View key={supp.name} style={styles.historyGridRow}>
                    <View style={styles.historyNameCell}>
                      <Text style={styles.historySupName} numberOfLines={1}>{supp.name}</Text>
                    </View>
                    {weekDates.map((dateStr, di) => {
                      const dayMood = dayMoods[di];
                      const relevantToday = dayMood ? supp.moods.includes(dayMood) : true;
                      const taken = historyTakenSet.has(`${dateStr}|${supp.name}`);
                      return (
                        <View key={di} style={styles.historyDayCell}>
                          {relevantToday ? (
                            <View
                              style={
                                taken
                                  ? [styles.historyDot, { backgroundColor: accentColor }]
                                  : styles.historyDotEmpty
                              }
                            />
                          ) : (
                            <Text style={styles.historyDotNa}>–</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* ALL */}
      {activeTab === 'ALL' && (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionNote}>Full catalog · tap to read the science</Text>

          {/* Mood filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterRow}
            contentContainerStyle={styles.filterRowContent}
          >
            <TouchableOpacity
              onPress={() => setAllFilterMood(null)}
              activeOpacity={0.7}
              style={[styles.filterChip, allFilterMood === null && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, allFilterMood === null && { color: '#ffffff' }]}>
                ALL
              </Text>
            </TouchableOpacity>
            {MOOD_ORDER.map((mood) => {
              const isActive = allFilterMood === mood;
              return (
                <TouchableOpacity
                  key={mood}
                  onPress={() => setAllFilterMood(isActive ? null : mood)}
                  activeOpacity={0.7}
                  style={[
                    styles.filterChip,
                    isActive && { borderColor: MOODS[mood].color, backgroundColor: MOODS[mood].color + '22' },
                  ]}
                >
                  <Text style={[styles.filterChipText, isActive && { color: MOODS[mood].color }]}>
                    {MOODS[mood].name.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Catalog list */}
          <View style={styles.supplementList}>
            {filteredCatalog.map((supp) => {
              const isExpanded = expandedSupp === supp.name;
              return (
                <View key={supp.name}>
                  <TouchableOpacity
                    style={styles.catalogRow}
                    onPress={() => handleExpand(supp.name)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`${supp.name}, ${supp.benefit}. ${isExpanded ? 'Collapse' : 'Expand'}`}
                  >
                    <View style={styles.supplementInfo}>
                      <Text style={styles.supplementName}>{supp.name}</Text>
                      <Text style={styles.supplementBenefit}>{supp.benefit}</Text>
                      <View style={styles.moodTagRow}>
                        {supp.moods.map((m) => (
                          <View
                            key={m}
                            style={[styles.moodTag, { borderColor: MOODS[m].color }]}
                          >
                            <Text style={[styles.moodTagText, { color: MOODS[m].color }]}>
                              {m.toUpperCase()}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <View style={styles.supplementRight}>
                      <Text style={styles.supplementDose}>{supp.dose}</Text>
                      <Text style={styles.supplementTiming}>{supp.timing.toUpperCase()}</Text>
                      <Text style={[styles.expandChevron, { color: '#d6d6d6' }]}>
                        {isExpanded ? '▲' : '▼'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={[styles.sciencePanel, { borderLeftColor: '#aaaaaa' }]}>
                      <Text style={styles.sciencePanelLabel}>GOOD FOR</Text>
                      <View style={styles.moodTagRow}>
                        {supp.moods.map((m) => (
                          <View key={m} style={[styles.moodTag, { borderColor: MOODS[m].color }]}>
                            <Text style={[styles.moodTagText, { color: MOODS[m].color }]}>{MOODS[m].name.toUpperCase()}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={[styles.sciencePanelLabel, { marginTop: 14 }]}>WHY THIS WORKS</Text>
                      <Text style={styles.sciencePanelText}>{supp.science}</Text>
                      {(supp.sources?.length ?? 0) > 0 && (
                        <>
                          <Text style={[styles.sciencePanelLabel, { marginTop: 14 }]}>SOURCES</Text>
                          {supp.sources.map((src, i) => (
                            <Text key={i} style={styles.sourceText}>{i + 1}. {src}</Text>
                          ))}
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      <BottomNav />
      <PremiumSheet
        visible={showPremiumSheet}
        onClose={() => setShowPremiumSheet(false)}
        context="reminders"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 0,
  },
  trackerLabel: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 3,
  },
  headline: {
    ...t.headlineMd,
    fontSize: 24,
    marginTop: 8,
  },
  dateLabel: {
    ...t.timestamp,
    color: '#ffffff',
    letterSpacing: 3,
    marginTop: 4,
  },
  tabSwitcher: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  tabBtn: {
    marginRight: 28,
    paddingBottom: 12,
    alignItems: 'center',
  },
  tabBtnText: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    color: '#f0f0f0',
    letterSpacing: 1.5,
    lineHeight: 20,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  sectionNote: {
    ...t.timestamp,
    color: '#f0f0f0',
    marginBottom: 16,
  },
  moodFilterBadge: {
    borderLeftWidth: 2,
    borderLeftColor: '#333333',
    paddingLeft: 12,
    paddingVertical: 8,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moodFilterLabel: {
    ...t.label,
    color: '#f0f0f0',
    letterSpacing: 1.5,
    fontSize: 16,
    lineHeight: 18,
  },
  moodFilterMood: {
    ...t.label,
    letterSpacing: 2,
  },
  moodFilterNote: {
    ...t.bodySm,
    color: '#cdcdcd',
  },
  adherenceStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1a1a1a',
    marginBottom: 16,
  },
  adherenceDots: {
    flexDirection: 'row',
    gap: 8,
  },
  adherenceDotCol: {
    alignItems: 'center',
    gap: 4,
  },
  adherenceDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  adherenceDotEmpty: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#444444',
    backgroundColor: 'transparent',
  },
  adherenceDotFuture: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#222222',
  },
  adherenceDayLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    lineHeight: 16,
    color: '#f0f0f0',
    letterSpacing: 0,
  },
  adherenceCountText: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 1,
  },
  adherenceCountOf: {
    color: '#f0f0f0',
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 1,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  progressCountWrapper: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  progressCountAccent: {
    ...t.dataValue,
    fontSize: 32,
  },
  progressCountSlash: {
    ...t.dataValue,
    color: '#ffffff',
    fontSize: 20,
    fontFamily: fonts.primary.regular,
  },
  progressLabel: {
    ...t.label,
    color: '#f0f0f0',
    letterSpacing: 1.5,
    marginLeft: 8,
  },
  priorityCard: {
    borderLeftWidth: 3,
    backgroundColor: '#111111',
    padding: 16,
    marginBottom: 8,
  },
  priorityCardLabel: {
    ...t.label,
    color: '#f0f0f0',
    letterSpacing: 1.5,
    fontSize: 16,
    lineHeight: 17,
  },
  priorityCardHeadline: {
    ...t.headlineSm,
    fontSize: 18,
    marginTop: 4,
  },
  priorityCardName: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 2,
    marginTop: 12,
  },
  priorityCardDose: {
    ...t.timestamp,
    color: '#f0f0f0',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  priorityCardScience: {
    ...t.soft,
    color: '#d8d8d8',
    fontSize: 16,
    lineHeight: 20,
    marginTop: 10,
  },
  priorityCheckBtn: {
    borderWidth: 1,
    borderColor: '#333333',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  priorityCheckBtnText: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 3,
  },
  supplementList: {
    marginTop: 8,
  },
  supplementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  supplementExpandArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  checkboxEmpty: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: '#444444',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxTaken: {
    width: 24,
    height: 24,
    borderWidth: 1,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxFill: {
    width: 16,
    height: 16,
  },
  supplementInfo: {
    flex: 1,
  },
  supplementName: {
    ...t.headlineSm,
    fontSize: 16,
  },
  supplementBenefit: {
    ...t.bodyMuted,
    color: '#cdcdcd',
    fontSize: 16,
    marginTop: 2,
  },
  supplementRight: {
    alignItems: 'flex-end',
  },
  supplementDose: {
    ...t.label,
    color: '#f0f0f0',
    fontSize: 16,
    lineHeight: 18,
  },
  supplementTiming: {
    ...t.label,
    color: '#f0f0f0',
    letterSpacing: 1.5,
    marginTop: 2,
    fontSize: 16,
    lineHeight: 18,
  },
  expandChevron: {
    fontSize: 16,
    marginTop: 2,
    lineHeight: 18,
  },
  sciencePanel: {
    backgroundColor: '#111111',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  sciencePanelLabel: {
    ...t.label,
    color: '#f0f0f0',
    letterSpacing: 1.5,
    marginBottom: 8,
    fontSize: 16,
    lineHeight: 17,
  },
  sciencePanelText: {
    ...t.soft,
    color: '#d8d8d8',
    fontSize: 16,
    lineHeight: 20,
  },
  sourceText: {
    ...t.soft,
    color: '#d6d6d6',
    fontSize: 16,
    lineHeight: 18,
    marginTop: 4,
  },
  moodTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  moodTag: {
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  moodTagText: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    lineHeight: 17,
    letterSpacing: 1,
  },
  filterRow: {
    marginBottom: 16,
  },
  filterRowContent: {
    gap: 8,
    paddingRight: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: '#333333',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: {
    borderColor: '#ffffff',
    backgroundColor: '#ffffff22',
  },
  filterChipText: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    lineHeight: 18,
    color: '#f0f0f0',
    letterSpacing: 1.5,
  },
  weekBlock: {
    marginBottom: 28,
  },
  weekLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  weekLabel: {
    ...t.label,
    color: '#f0f0f0',
    letterSpacing: 1.5,
    fontSize: 16,
    lineHeight: 18,
  },
  weekMoodBadge: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    lineHeight: 17,
    letterSpacing: 1.5,
  },
  historyGridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyNameCell: {
    width: 110,
    paddingRight: 8,
  },
  historyDayCell: {
    flex: 1,
    alignItems: 'center',
  },
  historyDayHeader: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    lineHeight: 16,
    color: '#f0f0f0',
    letterSpacing: 0,
  },
  historySupName: {
    fontFamily: fonts.primary.regular,
    fontSize: 16,
    lineHeight: 18,
    color: '#d8d8d8',
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  historyDotEmpty: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#333333',
    backgroundColor: 'transparent',
  },
  historyDayMoodDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  historyDotNa: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    lineHeight: 14,
    color: '#f0f0f0',
  },
  reminderCard: {
    borderWidth: 1,
    borderColor: '#1a1a1a',
    padding: 14,
    marginBottom: 16,
  },
  reminderCardLocked: {
    borderColor: '#1a1a1a',
    opacity: 0.6,
  },
  reminderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reminderLabel: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    lineHeight: 17,
    color: '#f0f0f0',
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
  reminderToggle: {
    width: 50,
    height: 28,
    borderRadius: 0,
    justifyContent: 'center',
  },
  reminderToggleOff: { backgroundColor: '#1a1a1a' },
  reminderToggleOn: { backgroundColor: '#059669' },
  reminderToggleCircle: {
    width: 22,
    height: 22,
    backgroundColor: '#ffffff',
    borderRadius: 0,
  },
  reminderPermDenied: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    lineHeight: 17,
    color: '#E11D48',
    marginTop: 8,
  },
  reminderLockedText: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    lineHeight: 17,
    color: '#f0f0f0',
    marginTop: 8,
  },
  reminderTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  reminderTimeChip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reminderTimeChipOn: { borderColor: '#059669' },
  reminderTimeChipOff: { borderColor: '#1a1a1a' },
  reminderTimeChipText: {
    fontFamily: fonts.mono.regular,
    fontSize: 16,
    lineHeight: 17,
    letterSpacing: 1,
  },
  reminderLockedSpacer: { height: 12 },
});

export default SupplementsScreen;
