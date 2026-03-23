import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Session } from '@/lib/storage';
import type { MoodKey } from '@/lib/storage';
import { type as t } from '../lib/typography';

interface WorkoutCalendarProps {
  sessions: Session[];
}

const MOOD_COLORS: Record<MoodKey, string> = {
  anxious: '#E8B84B',
  low: '#6366F1',
  foggy: '#5EAAB5',
  restless: '#D97706',
  stressed: '#E11D48',
  good: '#059669',
};

const DAY_HEADERS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

function toDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function WorkoutCalendar({ sessions }: WorkoutCalendarProps) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth(); // 0-indexed

  // Group sessions by date key — sort each day's sessions by timestamp desc so [0] = most recent
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
    // Sort each day's sessions newest first
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => b.timestamp - a.timestamp);
    }
    return map;
  }, [sessions, year, month]);

  const firstDay = new Date(year, month, 1);
  // getDay() returns 0=Sun..6=Sat, convert to Mon=0..Sun=6
  const rawFirstDay = firstDay.getDay(); // 0=Sun
  const firstDayOffset = rawFirstDay === 0 ? 6 : rawFirstDay - 1; // Mon=0..Sun=6

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayDate = today.getDate();
  const todayKey = toDateKey(year, month, todayDate);

  // Build cells array
  const cells: { day: number | null; dateKey: string | null }[] = [];
  // Leading empty cells
  for (let i = 0; i < firstDayOffset; i++) {
    cells.push({ day: null, dateKey: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, dateKey: toDateKey(year, month, d) });
  }
  // Pad to complete last row
  while (cells.length % 7 !== 0) {
    cells.push({ day: null, dateKey: null });
  }

  const MONTH_NAMES = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

  return (
    <View style={styles.container}>
      <Text style={styles.label}>THIS MONTH</Text>
      <Text style={styles.monthName}>{MONTH_NAMES[month]} {year}</Text>
      {/* Day headers */}
      <View style={styles.headerRow}>
        {DAY_HEADERS.map((d) => (
          <View key={d} style={styles.headerCell}>
            <Text style={styles.headerText}>{d}</Text>
          </View>
        ))}
      </View>
      {/* Calendar grid */}
      <View style={styles.grid}>
        {cells.map((cell, idx) => {
          if (cell.day === null) {
            return <View key={`empty-${idx}`} style={styles.cell} />;
          }
          const sessionsForDay = cell.dateKey ? (sessionsByDate[cell.dateKey] ?? []) : [];
          const hasSession = sessionsForDay.length > 0;
          const isToday = cell.dateKey === todayKey;
          const accentColor = hasSession ? (MOOD_COLORS[sessionsForDay[0].mood as MoodKey] ?? '#525252') : null;
          const hasMultiple = sessionsForDay.length > 1;
          const secondMoodColor = hasMultiple ? (MOOD_COLORS[sessionsForDay[1].mood as MoodKey] ?? '#525252') : null;

          return (
            <View
              key={cell.dateKey}
              accessible={true}
              accessibilityLabel={
                hasSession
                  ? `${cell.day} ${MONTH_NAMES[month].toLowerCase()}, ${sessionsForDay.length} ${sessionsForDay.length === 1 ? 'workout' : 'workouts'} completed`
                  : isToday
                  ? `${cell.day} ${MONTH_NAMES[month].toLowerCase()}, today`
                  : `${cell.day} ${MONTH_NAMES[month].toLowerCase()}`
              }
              style={[
                styles.cell,
                hasSession ? { backgroundColor: accentColor ?? 'transparent' } : null,
                isToday && !hasSession ? styles.todayBorder : null,
              ]}
            >
              <Text
                style={[
                  styles.dayText,
                  hasSession ? styles.dayTextActive : null,
                  !hasSession && !isToday ? styles.dayTextMuted : null,
                  isToday && !hasSession ? styles.dayTextToday : null,
                ]}
              >
                {String(cell.day).padStart(2, '0')}
              </Text>
              {hasMultiple && secondMoodColor && (
                <View style={[styles.dot, { backgroundColor: secondMoodColor }]} />
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 28,
  },
  label: {
    ...t.label,
    color: '#737373',
    letterSpacing: 3,
  },
  monthName: {
    ...t.timestamp,
    color: '#737373',
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
    color: '#737373',
    fontSize: 9,
    letterSpacing: 1,
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
    fontSize: 11,
  },
  dayTextActive: {
    color: '#ffffff',
  },
  dayTextMuted: {
    color: '#737373',
  },
  dayTextToday: {
    color: '#a3a3a3',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 1,
  },
});