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
        // Flat line that drops off a cliff — energy suddenly falling low.
        // No curves, no arcs — nothing that could be read as a smile.
        const w = size;
        const h = size;
        const highY = h * 0.32;
        const lowY = h * 0.75;
        const d = [
          `M ${w * 0.05},${highY}`,
          `L ${w * 0.52},${highY}`,
          `L ${w * 0.78},${lowY}`,
          `L ${w * 0.95},${lowY}`,
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
        // Tight zigzag/sawtooth line — rapid alternating diagonals across full width.
        // Reads as: nervous, can't-settle energy. Clearly distinct from Low (single sag).
        const w = size;
        const h = size;
        const midY = h * 0.5;
        const amp = h * 0.22;
        const numZags = 8;
        const segW = w / numZags;
        const points = Array.from({ length: numZags + 1 }, (_, i) => {
          const x = i * segW;
          const y = i % 2 === 0 ? midY - amp : midY + amp;
          return `${x},${y}`;
        }).join(' L ');
        return (
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Path
              d={`M ${points}`}
              stroke={moodColor}
              strokeWidth={1.5}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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
        // A tall, confident bell-curve pulse on a baseline near the bottom of the icon.
        // Baseline sits low, peak reaches high — arc occupies the upper portion of the icon.
        // Visual opposite of Anxious: one clean positive arc vs chaotic spike.
        const w = size;
        const h = size;
        const base = h * 0.76;
        const peakY = h * 0.1;
        const d = [
          `M 0,${base}`,
          `L ${w * 0.15},${base}`,
          `Q ${w * 0.28},${base} ${w * 0.37},${peakY * 1.18}`,
          `Q ${w * 0.5},${peakY} ${w * 0.63},${peakY * 1.18}`,
          `Q ${w * 0.72},${base} ${w * 0.85},${base}`,
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
