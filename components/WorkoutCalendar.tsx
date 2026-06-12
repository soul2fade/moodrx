import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Session } from '@/lib/storage';
import type { MoodKey } from '@/lib/storage';
import { MOODS } from '@/lib/moods';
import { sessionImprovement } from '@/lib/patterns';
import { type as t } from '../lib/typography';

interface WorkoutCalendarProps {
  sessions: Session[];
}

const DAY_HEADERS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const MONTH_NAMES = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatChange(pre: number, post: number): string {
  const diff = post - pre;
  return diff >= 0 ? `+${diff}` : `${diff}`;
}

export function WorkoutCalendar({ sessions }: WorkoutCalendarProps) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const [selectedSessions, setSelectedSessions] = useState<Session[] | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const sessionsByDate = useMemo(() => {
    const map: Record<string, Session[]> = {};
    for (const s of sessions) {
      const d = new Date(s.timestamp);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const key = toDateKey(year, month, d.getDate());
        if (!map[key]) map[key] = [];
        map[key].push(s);
      }
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => b.timestamp - a.timestamp);
    }
    return map;
  }, [sessions, year, month]);

  const firstDay = new Date(year, month, 1);
  const rawFirstDay = firstDay.getDay();
  const firstDayOffset = rawFirstDay === 0 ? 6 : rawFirstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDate = today.getDate();
  const todayKey = toDateKey(year, month, todayDate);

  // Cells only depend on year/month/firstDayOffset/daysInMonth — which all
  // derive from `today` (and `today` is computed once per render). Stash
  // the grid so it doesn't get rebuilt on every render of the parent
  // (Insights re-renders on every Sessions context update, of which there
  // are many; the calendar grid itself only needs to change when the month
  // rolls over).
  const cells = useMemo(() => {
    const arr: { day: number | null; dateKey: string | null }[] = [];
    for (let i = 0; i < firstDayOffset; i++) {
      arr.push({ day: null, dateKey: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({ day: d, dateKey: toDateKey(year, month, d) });
    }
    while (arr.length % 7 !== 0) {
      arr.push({ day: null, dateKey: null });
    }
    return arr;
  }, [firstDayOffset, daysInMonth, year, month]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>THIS MONTH</Text>
      <Text style={styles.monthName}>{MONTH_NAMES[month]} {year}</Text>
      <View style={styles.headerRow}>
        {DAY_HEADERS.map((d) => (
          <View key={d} style={styles.headerCell}>
            <Text style={styles.headerText}>{d}</Text>
          </View>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((cell, idx) => {
          if (cell.day === null) {
            return <View key={`empty-${idx}`} style={styles.cell} />;
          }
          const sessionsForDay = cell.dateKey ? (sessionsByDate[cell.dateKey] ?? []) : [];
          const hasSession = sessionsForDay.length > 0;
          const isToday = cell.dateKey === todayKey;
          const accentColor = hasSession ? MOODS[sessionsForDay[0].mood as MoodKey].color : null;
          const hasMultiple = sessionsForDay.length > 1;
          const secondMoodColor = hasMultiple ? MOODS[sessionsForDay[1].mood as MoodKey].color : null;

          if (hasSession) {
            return (
              <TouchableOpacity
                key={cell.dateKey}
                activeOpacity={0.75}
                onPress={() => {
                  setSelectedSessions(sessionsForDay);
                  setSelectedDay(cell.day);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${cell.day} ${MONTH_NAMES[month].toLowerCase()}, ${sessionsForDay.length} ${sessionsForDay.length === 1 ? 'session' : 'sessions'}. Tap for details.`}
                style={[styles.cell, { backgroundColor: accentColor ?? 'transparent' }]}
              >
                <Text style={[styles.dayText, styles.dayTextActive]}>
                  {String(cell.day).padStart(2, '0')}
                </Text>
                {hasMultiple && secondMoodColor && (
                  <View style={[styles.dot, { backgroundColor: secondMoodColor }]} />
                )}
              </TouchableOpacity>
            );
          }

          return (
            <View
              key={cell.dateKey}
              accessible={true}
              accessibilityLabel={
                isToday
                  ? `${cell.day} ${MONTH_NAMES[month].toLowerCase()}, today`
                  : `${cell.day} ${MONTH_NAMES[month].toLowerCase()}`
              }
              style={[styles.cell, isToday ? styles.todayBorder : null]}
            >
              <Text style={[styles.dayText, isToday ? styles.dayTextToday : styles.dayTextMuted]}>
                {String(cell.day).padStart(2, '0')}
              </Text>
            </View>
          );
        })}
      </View>

      <Modal
        visible={selectedSessions !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedSessions(null)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setSelectedSessions(null)}
        >
          {selectedSessions && (
            <View style={styles.sheet}>
              <View style={styles.handle} />
              <Text style={styles.sheetDate}>
                {MONTH_NAMES[month]} {String(selectedDay).padStart(2, '0')}
              </Text>
              <Text style={styles.sheetCount}>
                {selectedSessions.length} SESSION{selectedSessions.length > 1 ? 'S' : ''}
              </Text>
              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                {selectedSessions.map((s, i) => {
                  const color = MOODS[s.mood as MoodKey].color;
                  const change = formatChange(s.intensity, s.postScore);
                  // Mood-aware: for every mood except 'good', a lower post-score is the win.
                  const improved = sessionImprovement(s) > 0;
                  return (
                    <View key={s.id ?? i} style={[styles.sessionRow, i < selectedSessions.length - 1 && styles.sessionBorder]}>
                      <View style={[styles.moodBar, { backgroundColor: color }]} />
                      <View style={styles.sessionInfo}>
                        <View style={styles.sessionTopRow}>
                          <Text style={[styles.sessionMood, { color }]}>
                            {MOODS[s.mood as MoodKey].name.toUpperCase()}
                          </Text>
                          <Text style={styles.sessionTime}>{formatTime(s.timestamp)}</Text>
                        </View>
                        <Text style={styles.sessionWorkout}>{s.workoutName}</Text>
                        <Text style={[styles.sessionChange, { color: improved ? '#059669' : '#E11D48' }]}>
                          {s.intensity} → {s.postScore} ({change})
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 28,
  },
  label: {
    ...t.label,
    color: '#ffffff',
    letterSpacing: 3,
  },
  monthName: {
    ...t.timestamp,
    color: '#ffffff',
    letterSpacing: 2,
    marginTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    marginTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    marginBottom: 4,
  },
  headerCell: {
    width: '14.28%' as unknown as number,
    alignItems: 'center',
  },
  headerText: {
    ...t.timestamp,
    color: '#ffffff',
    fontSize: 12,
    letterSpacing: 1,
    lineHeight: 17,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  cell: {
    width: '14.28%' as unknown as number,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  todayBorder: {
    borderWidth: 1,
    borderColor: '#525252',
  },
  dayText: {
    ...t.number,
    fontSize: 12,
    lineHeight: 17,
  },
  dayTextActive: {
    color: '#ffffff',
  },
  dayTextMuted: {
    color: '#ffffff',
  },
  dayTextToday: {
    color: '#ffffff',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: '60%',
  },
  handle: {
    width: 36,
    height: 3,
    backgroundColor: '#333333',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetDate: {
    ...t.label,
    color: '#cdcdcd',
    letterSpacing: 2,
    marginBottom: 2,
  },
  sheetCount: {
    ...t.headlineSm,
    color: '#ffffff',
    marginBottom: 20,
  },
  sessionRow: {
    flexDirection: 'row',
    paddingVertical: 14,
    alignItems: 'flex-start',
  },
  sessionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c1c',
  },
  moodBar: {
    width: 3,
    borderRadius: 2,
    alignSelf: 'stretch',
    marginRight: 14,
    marginTop: 2,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sessionMood: {
    ...t.label,
    letterSpacing: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  sessionTime: {
    ...t.timestamp,
    color: '#cdcdcd',
    fontSize: 12,
    lineHeight: 17,
  },
  sessionWorkout: {
    ...t.body,
    color: '#ffffff',
    marginBottom: 4,
    fontSize: 14,
    lineHeight: 20,
  },
  sessionChange: {
    ...t.label,
    fontSize: 12,
    lineHeight: 17,
    letterSpacing: 0.5,
  },
});
