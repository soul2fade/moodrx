import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';
import { MoodKey } from '@/lib/storage';
import { MOODS } from '@/lib/moods';

const MOOD_A11Y_LABELS: Record<MoodKey, string> = {
  anxious: 'Anxious mood',
  low: 'Low mood',
  foggy: 'Foggy mood',
  restless: 'Restless mood',
  stressed: 'Stressed mood',
  good: 'Good mood',
};

interface MoodIconProps {
  mood: MoodKey;
  size?: number;
  opacity?: number;
  color?: string;
}

export function MoodIcon({ mood, size = 32, opacity = 1, color }: MoodIconProps) {
  const moodColor = color ?? MOODS[mood].color;
  const half = size / 2;

  const renderIcon = () => {
    switch (mood) {
      case 'anxious': {
        // Jagged erratic signal line like a seismograph going haywire
        const scaleX = size / 64;
        const scaleY = size / 64;
        const points = [
          `0,${32 * scaleY}`,
          `6,${32 * scaleY}`,
          `10,${16 * scaleY}`,
          `14,${48 * scaleY}`,
          `18,${8 * scaleY}`,
          `22,${52 * scaleY}`,
          `26,${20 * scaleY}`,
          `30,${44 * scaleY}`,
          `34,${12 * scaleY}`,
          `38,${50 * scaleY}`,
          `42,${24 * scaleY}`,
          `46,${40 * scaleY}`,
          `50,${28 * scaleY}`,
          `54,${36 * scaleY}`,
          `58,${32 * scaleY}`,
          `64,${32 * scaleY}`,
        ]
          .map((p) => {
            const [x, y] = p.split(',');
            return `${parseFloat(x) * scaleX},${y}`;
          })
          .join(' ');
        return (
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Polyline
              points={points}
              stroke={moodColor}
              strokeWidth={1.5}
              fill="none"
            />
          </Svg>
        );
      }

      case 'low': {
        // 3 arcs descending in height — a line that bounces but loses height each time
        const w = size;
        const h = size;
        const baseline = h * 0.7;
        const r1 = h * 0.35;
        const r2 = h * 0.22;
        const r3 = h * 0.12;
        const seg = w / 4;
        return (
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Path
              d={`M ${0},${baseline} Q ${seg * 0.5},${baseline - r1 * 2} ${seg},${baseline}`}
              stroke={moodColor}
              strokeWidth={1.5}
              fill="none"
            />
            <Path
              d={`M ${seg},${baseline} Q ${seg * 1.5},${baseline - r2 * 2} ${seg * 2},${baseline}`}
              stroke={moodColor}
              strokeWidth={1.5}
              fill="none"
            />
            <Path
              d={`M ${seg * 2},${baseline} Q ${seg * 2.5},${baseline - r3 * 2} ${seg * 3},${baseline}`}
              stroke={moodColor}
              strokeWidth={1.5}
              fill="none"
            />
            <Line
              x1={seg * 3}
              y1={baseline}
              x2={w}
              y2={baseline}
              stroke={moodColor}
              strokeWidth={1.5}
            />
          </Svg>
        );
      }

      case 'foggy': {
        // 3 horizontal wavy lines at varying opacity
        const w = size;
        const h = size;
        const amp = h * 0.06;
        const gap = h * 0.22;
        const startY = h * 0.28;

        const wavePath = (y: number) => {
          const seg = w / 4;
          return `M 0,${y} Q ${seg * 0.5},${y - amp} ${seg},${y} Q ${seg * 1.5},${y + amp} ${seg * 2},${y} Q ${seg * 2.5},${y - amp} ${seg * 3},${y} Q ${seg * 3.5},${y + amp} ${w},${y}`;
        };

        return (
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Path d={wavePath(startY)} stroke={moodColor} strokeWidth={1.5} fill="none" opacity={1} />
            <Path d={wavePath(startY + gap)} stroke={moodColor} strokeWidth={1.5} fill="none" opacity={0.65} />
            <Path d={wavePath(startY + gap * 2)} stroke={moodColor} strokeWidth={1.5} fill="none" opacity={0.35} />
          </Svg>
        );
      }

      case 'restless': {
        // 3 vertical zigzag/crackling lines side by side — electric static
        const w = size;
        const h = size;
        const colW = w / 4;

        const zigzagPoints = (cx: number) => {
          const amp = colW * 0.4;
          const steps = 6;
          const stepH = h / steps;
          const pts: string[] = [];
          for (let i = 0; i <= steps; i++) {
            const x = i % 2 === 0 ? cx - amp : cx + amp;
            pts.push(`${x},${i * stepH}`);
          }
          return pts.join(' ');
        };

        return (
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Polyline points={zigzagPoints(colW)} stroke={moodColor} strokeWidth={1.5} fill="none" />
            <Polyline points={zigzagPoints(colW * 2)} stroke={moodColor} strokeWidth={1.5} fill="none" />
            <Polyline points={zigzagPoints(colW * 3)} stroke={moodColor} strokeWidth={1.5} fill="none" />
          </Svg>
        );
      }

      case 'stressed': {
        // Horizontal lines getting shorter and thicker toward the bottom
        const w = size;
        const h = size;
        const lineCount = 5;
        const gap = h / (lineCount + 1);
        return (
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {Array.from({ length: lineCount }).map((_, i) => {
              const y = gap * (i + 1);
              const progress = i / (lineCount - 1); // 0 = top, 1 = bottom
              const lineWidth = w * (1 - progress * 0.5); // from full to half width
              const strokeW = 1 + progress * 2.5; // from 1 to 3.5
              const x1 = (w - lineWidth) / 2;
              const x2 = x1 + lineWidth;
              return (
                <Line
                  key={i}
                  x1={x1}
                  y1={y}
                  x2={x2}
                  y2={y}
                  stroke={moodColor}
                  strokeWidth={strokeW}
                />
              );
            })}
          </Svg>
        );
      }

      case 'good': {
        // 3 concentric circles radiating from center
        const r1 = size * 0.15;
        const r2 = size * 0.3;
        const r3 = size * 0.44;
        return (
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Circle cx={half} cy={half} r={r1} stroke={moodColor} strokeWidth={1.5} fill="none" />
            <Circle cx={half} cy={half} r={r2} stroke={moodColor} strokeWidth={1.5} fill="none" />
            <Circle cx={half} cy={half} r={r3} stroke={moodColor} strokeWidth={1.5} fill="none" />
          </Svg>
        );
      }

      default:
        return null;
    }
  };

  return (
    <View style={{ opacity }} accessible accessibilityLabel={MOOD_A11Y_LABELS[mood]} accessibilityRole="image">
      {renderIcon()}
    </View>
  );
}