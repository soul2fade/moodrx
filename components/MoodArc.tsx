import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Polyline,
  Polygon,
  Circle,
  Line as SvgLine,
  Text as SvgText,
} from 'react-native-svg';
import type { Session } from '@/lib/storage';
import { MOODS } from '@/lib/moods';
import { fonts } from '@/lib/typography';

interface MoodArcProps {
  sessions: Session[];
}

const CHART_H = 128;
const PAD_L = 18;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 20;
const MAX_SESSIONS = 14;

export function MoodArc({ sessions }: MoodArcProps) {
  const [width, setWidth] = useState(320);
  const data = sessions.slice(-MAX_SESSIONS);
  const n = data.length;

  if (n < 2) return null;

  const innerW = width - PAD_L - PAD_R;
  const innerH = CHART_H - PAD_T - PAD_B;

  const xOf = (i: number) => PAD_L + (i / (n - 1)) * innerW;
  const yOf = (v: number) => PAD_T + (1 - v / 10) * innerH;

  const prePoints = data.map((s, i) => `${xOf(i)},${yOf(s.intensity)}`).join(' ');
  const postPoints = data.map((s, i) => `${xOf(i)},${yOf(s.postScore)}`).join(' ');

  // Shaded area between pre (top) and post (bottom reversed)
  const areaPoints = [
    ...data.map((s, i) => `${xOf(i)},${yOf(s.intensity)}`),
    ...[...data].reverse().map((s, i) => `${xOf(n - 1 - i)},${yOf(s.postScore)}`),
  ].join(' ');

  const yGridLines = [0, 5, 10];

  return (
    <View style={styles.container} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={styles.header}>
        <Text style={styles.label}>MOOD ARC</Text>
        <Text style={styles.sub}>last {n} session{n !== 1 ? 's' : ''}</Text>
      </View>

      <Svg width={width} height={CHART_H} accessibilityLabel={`Mood arc chart showing ${n} sessions`}>
        {/* Grid lines */}
        {yGridLines.map((v) => (
          <SvgLine
            key={v}
            x1={PAD_L}
            y1={yOf(v)}
            x2={width - PAD_R}
            y2={yOf(v)}
            stroke="#141414"
            strokeWidth="1"
          />
        ))}

        {/* Y-axis labels */}
        <SvgText x={PAD_L - 4} y={yOf(10) + 4} fontSize="7" fill="#333" textAnchor="end">10</SvgText>
        <SvgText x={PAD_L - 4} y={yOf(5) + 4}  fontSize="7" fill="#333" textAnchor="end">5</SvgText>
        <SvgText x={PAD_L - 4} y={yOf(0) + 4}  fontSize="7" fill="#333" textAnchor="end">0</SvgText>

        {/* Shaded lift area */}
        <Polygon points={areaPoints} fill="rgba(5,150,105,0.07)" />

        {/* Pre line */}
        <Polyline
          points={prePoints}
          fill="none"
          stroke="#2a2a2a"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Post line */}
        <Polyline
          points={postPoints}
          fill="none"
          stroke="#059669"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Vertical connector between pre and post for each session */}
        {data.map((s, i) => (
          <SvgLine
            key={`conn-${i}`}
            x1={xOf(i)}
            y1={yOf(s.intensity)}
            x2={xOf(i)}
            y2={yOf(s.postScore)}
            stroke={s.postScore >= s.intensity ? 'rgba(5,150,105,0.25)' : 'rgba(180,50,50,0.18)'}
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        ))}

        {/* Dots — pre (small grey) */}
        {data.map((s, i) => (
          <Circle key={`pre-${i}`} cx={xOf(i)} cy={yOf(s.intensity)} r={2.5} fill="#333" />
        ))}

        {/* Dots — post (mood-colored) */}
        {data.map((s, i) => {
          const moodColor = MOODS[s.mood]?.color ?? '#737373';
          return (
            <Circle key={`post-${i}`} cx={xOf(i)} cy={yOf(s.postScore)} r={4} fill={moodColor} />
          );
        })}
      </Svg>

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#2a2a2a' }]} />
          <Text style={styles.legendText}>BEFORE</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#059669' }]} />
          <Text style={styles.legendText}>AFTER (mood-colored)</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  label: {
    fontFamily: fonts.mono.regular,
    fontSize: 10,
    color: '#888',
    letterSpacing: 3,
  },
  sub: {
    fontFamily: fonts.mono.regular,
    fontSize: 9,
    color: '#444',
    letterSpacing: 1,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendText: {
    fontFamily: fonts.mono.regular,
    fontSize: 8,
    color: '#555',
    letterSpacing: 1.5,
  },
});
