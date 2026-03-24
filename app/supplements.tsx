import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { SUPPLEMENTS } from '@/lib/supplements';
import {
  getSupplementLogs,
  toggleSupplementLog,
  getSessions,
  SupplementLog,
  Session,
} from '@/lib/storage';
import { MOODS } from '@/lib/moods';
import type { MoodKey } from '@/lib/storage';
import { type as t, fonts } from '../lib/typography';
import { useScreenAnimation } from '@/hooks/useScreenAnimation';
import { useHardwareBack } from '@/hooks/useHardwareBack';

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTodayLabel(): string {
  const d = new Date();
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dayName = days[d.getDay()];
  const dayNum = String(d.getDate()).padStart(2, '0');
  const monthName = months[d.getMonth()];
  return `${dayName}, ${dayNum} ${monthName}`;
}

function getSupplementStreak(logs: SupplementLog[], supplementName: string): number {
  const takenDates = new Set(
    logs.filter((l) => l.supplementName === supplementName && l.taken).map((l) => l.date)
  );

  let streak = 0;
  const check = new Date();
  check.setHours(0, 0, 0, 0);

  while (true) {
    const year = check.getFullYear();
    const month = String(check.getMonth() + 1).padStart(2, '0');
    const day = String(check.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    if (takenDates.has(dateStr)) {
      streak++;
      check.setDate(check.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export default function SupplementsScreen() {
  const [logs, setLogs] = useState<SupplementLog[]>([]);
  const [lastMood, setLastMood] = useState<MoodKey | null>(null);
  const [expandedSupp, setExpandedSupp] = useState<string | null>(null);
  const today = getTodayString();

  const { fadeAnim, slideAnim } = useScreenAnimation();

  const backHandler = useCallback(() => {
    router.back();
    return true;
  }, []);
  useHardwareBack(backHandler);

  const loadData = useCallback(() => {
    getSupplementLogs().then(setLogs);
    getSessions().then((sessions: Session[]) => {
      if (sessions.length > 0) {
        const sorted = [...sessions].sort((a, b) => b.timestamp - a.timestamp);
        setLastMood(sorted[0].mood as MoodKey);
      } else {
        setLastMood(null);
      }
    });
  }, []);

  useFocusEffect(loadData);

  const visibleSupplements = lastMood
    ? SUPPLEMENTS.filter((s) => s.moods.includes(lastMood))
    : SUPPLEMENTS;

  const todayLogs = logs.filter((l) => l.date === today);
  const takenSet = new Set(todayLogs.filter((l) => l.taken).map((l) => l.supplementName));
  const takenCount = [...takenSet].filter((name) =>
    visibleSupplements.some((s) => s.name === name)
  ).length;
  const totalCount = visibleSupplements.length;

  const accentColor = lastMood ? MOODS[lastMood].color : '#059669';

  const handleToggle = async (supplementName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await toggleSupplementLog(supplementName, today);
    loadData();
  };

  const handleExpand = (supplementName: string) => {
    setExpandedSupp((prev) => (prev === supplementName ? null : supplementName));
  };

  const supplementStreaks = visibleSupplements.map((s) => ({
    name: s.name,
    streak: getSupplementStreak(logs, s.name),
  })).sort((a, b) => b.streak - a.streak).slice(0, 3);

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
          <Text style={styles.backButton}>← BACK</Text>
        </TouchableOpacity>

        <Text style={styles.trackerLabel}>SUPPLEMENT TRACKER</Text>
        <Text style={styles.headline}>Today&apos;s stack.</Text>
        <Text style={styles.dateLabel}>{formatTodayLabel()}</Text>

        {/* Mood filter note */}
        {lastMood ? (
          <View style={[styles.moodFilterBadge, { borderLeftColor: accentColor }]}>
            <Text style={styles.moodFilterLabel}>MATCHED TO</Text>
            <Text style={[styles.moodFilterMood, { color: accentColor }]}>
              {MOODS[lastMood].name.toUpperCase()}
            </Text>
          </View>
        ) : (
          <View style={styles.moodFilterBadge}>
            <Text style={styles.moodFilterNote}>
              Select a mood to see your matched stack.
            </Text>
          </View>
        )}

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

        {/* TODAY'S PRIORITY card */}
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
                {/* Flat row: checkbox + expand area side by side, no nesting */}
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
                    <Text style={styles.sciencePanelLabel}>WHY THIS WORKS</Text>
                    <Text style={styles.sciencePanelText}>{supp.science}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Consistency streaks */}
        <View style={styles.consistencySection}>
          <Text style={styles.consistencyLabel}>CONSISTENCY</Text>
          {supplementStreaks.map((item) => (
            <View key={item.name} style={styles.streakRow}>
              <Text style={styles.streakName}>{item.name}</Text>
              {item.streak > 0 ? (
                <Text style={[styles.streakValue, { color: accentColor }]}>{item.streak}d streak</Text>
              ) : (
                <Text style={styles.streakNone}>—</Text>
              )}
            </View>
          ))}
        </View>

        <View style={{ height: 32 }} />
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
    color: '#c8c8c8',
    letterSpacing: 2,
  },
  trackerLabel: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 3,
    marginTop: 24,
  },
  headline: {
    ...t.headlineMd,
    fontSize: 24,
    marginTop: 8,
  },
  dateLabel: {
    ...t.timestamp,
    color: '#c8c8c8',
    letterSpacing: 3,
    marginTop: 4,
  },
  moodFilterBadge: {
    borderLeftWidth: 2,
    borderLeftColor: '#333333',
    paddingLeft: 12,
    paddingVertical: 8,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moodFilterLabel: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 2,
  },
  moodFilterMood: {
    ...t.label,
    letterSpacing: 2,
  },
  moodFilterNote: {
    ...t.bodySm,
    color: '#c8c8c8',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginTop: 20,
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
    color: '#c8c8c8',
    fontSize: 20,
    fontFamily: fonts.primary.regular,
  },
  progressLabel: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 3,
    marginLeft: 8,
  },
  priorityCard: {
    borderLeftWidth: 3,
    backgroundColor: '#111111',
    padding: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  priorityCardLabel: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 3,
    fontSize: 10,
  },
  priorityCardHeadline: {
    ...t.headlineSm,
    fontSize: 18,
    marginTop: 4,
  },
  priorityCardName: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 2,
    marginTop: 12,
  },
  priorityCardDose: {
    ...t.timestamp,
    color: '#c8c8c8',
    letterSpacing: 2,
    marginTop: 2,
  },
  priorityCardScience: {
    ...t.soft,
    color: '#c8c8c8',
    fontSize: 13,
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
    color: '#c8c8c8',
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
    borderColor: '#525252',
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
    fontSize: 15,
  },
  supplementBenefit: {
    ...t.bodyMuted,
    color: '#c8c8c8',
    fontSize: 12,
    marginTop: 2,
  },
  supplementRight: {
    alignItems: 'flex-end',
  },
  supplementDose: {
    ...t.label,
    color: '#c8c8c8',
  },
  supplementTiming: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 2,
    marginTop: 2,
  },
  expandChevron: {
    fontSize: 14,
    marginTop: 2,
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
    color: '#c8c8c8',
    letterSpacing: 3,
    marginBottom: 8,
  },
  sciencePanelText: {
    ...t.soft,
    color: '#c8c8c8',
    fontSize: 13,
    lineHeight: 20,
  },
  consistencySection: {
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingTop: 16,
  },
  consistencyLabel: {
    ...t.label,
    color: '#c8c8c8',
    letterSpacing: 3,
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    marginTop: 4,
  },
  streakName: {
    ...t.body,
    fontSize: 14,
  },
  streakValue: {
    ...t.label,
    letterSpacing: 1,
  },
  streakNone: {
    ...t.label,
    color: '#c8c8c8',
    fontSize: 14,
  },
});
