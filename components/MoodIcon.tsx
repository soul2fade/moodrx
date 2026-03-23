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
        // EKG panic spike: flat baseline → small pre-dip → dramatic tall spike → deep trough → return → flat
        // Single dominant spike makes it instantly readable at any size.
        const w = size;
        const h = size;
        const base = h * 0.56;
        const d = [
          `M 0,${base}`,
          `L ${w * 0.26},${base}`,
          `L ${w * 0.34},${h * 0.64}`,
          `L ${w * 0.42},${h * 0.08}`,
          `L ${w * 0.51},${h * 0.92}`,
          `L ${w * 0.59},${base}`,
          `L ${w},${base}`,
        ].join(' ');
        return (
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Path
              d={d}
              stroke={moodColor}
              strokeWidth={1.5}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </Svg>
        );
      }

      case 'low': {
        // 3 arcs descending in height — a bounce that loses energy — then flat
        // Kept: this icon works at all sizes and the concept is immediately clear.
        const w = size;
        const h = size;
        const baseline = h * 0.72;
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
              strokeLinecap="round"
            />
            <Path
              d={`M ${seg},${baseline} Q ${seg * 1.5},${baseline - r2 * 2} ${seg * 2},${baseline}`}
              stroke={moodColor}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
            />
            <Path
              d={`M ${seg * 2},${baseline} Q ${seg * 2.5},${baseline - r3 * 2} ${seg * 3},${baseline}`}
              stroke={moodColor}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
            />
            <Line
              x1={seg * 3}
              y1={baseline}
              x2={w}
              y2={baseline}
              stroke={moodColor}
              strokeWidth={1.5}
              strokeLinecap="round"
            />
          </Svg>
        );
      }

      case 'foggy': {
        // 3 horizontal wavy lines at varying opacity — fading clarity.
        // Kept: the opacity cascade is the strongest idea in the set.
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
            <Path d={wavePath(startY)} stroke={moodColor} strokeWidth={1.5} fill="none" opacity={1} strokeLinecap="round" />
            <Path d={wavePath(startY + gap)} stroke={moodColor} strokeWidth={1.5} fill="none" opacity={0.6} strokeLinecap="round" />
            <Path d={wavePath(startY + gap * 2)} stroke={moodColor} strokeWidth={1.5} fill="none" opacity={0.28} strokeLinecap="round" />
          </Svg>
        );
      }

      case 'restless': {
        // 5 rapid equal-height bouncing arcs across the full width.
        // Reads as: constant kinetic energy, can't-stop bouncing.
        // Clearly different from Low (3 declining arcs) and Anxious (single sharp spike).
        const w = size;
        const h = size;
        const baseline = h * 0.78;
        const arcH = h * 0.5;
        const numArcs = 5;
        const arcW = w / numArcs;
        return (
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {Array.from({ length: numArcs }).map((_, i) => {
              const x1 = i * arcW;
              const x2 = (i + 1) * arcW;
              const mx = (x1 + x2) / 2;
              return (
                <Path
                  key={i}
                  d={`M ${x1},${baseline} Q ${mx},${baseline - arcH} ${x2},${baseline}`}
                  stroke={moodColor}
                  strokeWidth={1.5}
                  fill="none"
                  strokeLinecap="round"
                />
              );
            })}
          </Svg>
        );
      }

      case 'stressed': {
        // Downward-pointing chevron (the source of pressure) above 4 horizontal lines
        // with tightening vertical spacing — lines are being compressed downward.
        // All strokes uniform 1.5px. Reads as weight/pressure from above.
        const w = size;
        const h = size;
        const chevronPoints = `${w * 0.15},${h * 0.08} ${w * 0.5},${h * 0.34} ${w * 0.85},${h * 0.08}`;
        const lineYs = [h * 0.5, h * 0.63, h * 0.74, h * 0.83];
        const lx1 = w * 0.05;
        const lx2 = w * 0.95;
        return (
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Polyline
              points={chevronPoints}
              stroke={moodColor}
              strokeWidth={1.5}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {lineYs.map((y, i) => (
              <Line
                key={i}
                x1={lx1}
                y1={y}
                x2={lx2}
                y2={y}
                stroke={moodColor}
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            ))}
          </Svg>
        );
      }

      case 'good': {
        // A single calm, smooth bell-curve pulse on a steady baseline.
        // Visual opposite of Anxious: one clean positive arc vs chaotic spike.
        // Reads as: stable, one good moment, not noise.
        const w = size;
        const h = size;
        const base = h * 0.62;
        const peakY = h * 0.16;
        const d = [
          `M 0,${base}`,
          `L ${w * 0.18},${base}`,
          `Q ${w * 0.32},${base} ${w * 0.38},${peakY * 1.2}`,
          `Q ${w * 0.5},${peakY} ${w * 0.62},${peakY * 1.2}`,
          `Q ${w * 0.68},${base} ${w * 0.82},${base}`,
          `L ${w},${base}`,
        ].join(' ');
        return (
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Path
              d={d}
              stroke={moodColor}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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
