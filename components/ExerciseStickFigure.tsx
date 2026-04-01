import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import type { MoodKey } from '@/lib/storage';

type ExerciseType =
  | 'walk' | 'run' | 'squat' | 'pushup' | 'plank'
  | 'jump' | 'yoga' | 'box' | 'rest' | 'dance' | 'default';

function detectType(text: string): ExerciseType {
  const t = text.toLowerCase();
  if (/sprint|high knee|jog/.test(t)) return 'run';
  if (/walk|warm.?up|stroll|step outside|steady pace/.test(t)) return 'walk';
  if (/squat|lunge/.test(t)) return 'squat';
  if (/push.?up/.test(t)) return 'pushup';
  if (/plank|mountain climber/.test(t)) return 'plank';
  if (/jump|burpee|jumping/.test(t)) return 'jump';
  if (/pose|yoga|fold|child|warrior|pigeon|savasana|sphinx|butterfly|dragon|ragdoll|yin/.test(t)) return 'yoga';
  if (/jab|cross|hook|uppercut|shadow|boxing|round|punch/.test(t)) return 'box';
  if (/breath|rest|cool.?down|slow|still|quiet|lie|floor|wall|legs up/.test(t)) return 'rest';
  if (/song|dance|sway|feral|club/.test(t)) return 'dance';
  return 'default';
}

const SPEEDS: Record<ExerciseType, number> = {
  walk: 650, run: 300, squat: 900, pushup: 800, plank: 2200,
  jump: 380, yoga: 1800, box: 280, rest: 2400, dance: 550, default: 750,
};

const THOUGHTS_BY_PHASE = [
  ["f#$k it's hard.", "why though.", "who invented this.", "already?", "no."],
  ["still going??", "this sucks.", "brutal.", "I hate this.", "someone stop me."],
  ["...ok fine.", "it's working?", "fine FINE.", "maybe though.", "ok sure."],
  ["wait—", "actually...", "I feel it.", "ok yes.", "almost."],
];
const THOUGHT_LAST = "...oh.";

function getThought(currentStep: number, totalSteps: number): string {
  if (!totalSteps || totalSteps <= 1) return THOUGHTS_BY_PHASE[0][0];
  if (currentStep >= totalSteps - 1) return THOUGHT_LAST;
  const progress = currentStep / (totalSteps - 1);
  const phaseIndex = Math.min(
    Math.floor(progress * THOUGHTS_BY_PHASE.length),
    THOUGHTS_BY_PHASE.length - 1
  );
  const options = THOUGHTS_BY_PHASE[phaseIndex];
  return options[currentStep % options.length];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Mood → starting mouth offset (positive = frown, negative = smile)
const MOOD_START_OFFSET: Record<MoodKey, number> = {
  anxious: 3,
  stressed: 2.5,
  low: 4,
  foggy: 0,
  restless: 0,
  good: -2,
};

function FaceOnHead({
  cx,
  cy,
  progress,
  mood,
}: {
  cx: number;
  cy: number;
  progress: number;
  mood: MoodKey | undefined;
}) {
  const startOffset = mood != null ? MOOD_START_OFFSET[mood] : 0;
  // Mouth control Y: positive offset = frown, negative = smile
  // Interpolates from mood-start all the way to a full upward smile
  const mouthY = cy + 3;
  const controlY = mouthY + lerp(startOffset, -5, progress);
  const mouthHalfW = 4;
  const eyeY = cy - 3.5;
  const eyeOffsetX = 3.5;
  const faceColor = '#111111';

  return (
    <>
      <Circle cx={cx - eyeOffsetX} cy={eyeY} r={1.5} fill={faceColor} />
      <Circle cx={cx + eyeOffsetX} cy={eyeY} r={1.5} fill={faceColor} />
      <Path
        d={`M ${cx - mouthHalfW},${mouthY} Q ${cx},${controlY} ${cx + mouthHalfW},${mouthY}`}
        stroke={faceColor}
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
      />
    </>
  );
}

interface Props {
  stepText: string;
  color: string;
  currentStep: number;
  totalSteps: number;
  mood?: MoodKey;
  size?: number;
}

export function ExerciseStickFigure({ stepText, color, currentStep, totalSteps, mood, size = 80 }: Props) {
  const type = detectType(stepText);
  const [t, setT] = useState(0);
  const animRef = useRef(new Animated.Value(0));
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);
  const thoughtText = getThought(currentStep, totalSteps);
  const isLast = totalSteps > 0 && currentStep >= totalSteps - 1;

  // progress 0→1 across the workout (drives face expression)
  const progress = totalSteps <= 1 ? 0 : currentStep / (totalSteps - 1);

  useEffect(() => {
    const anim = animRef.current;
    anim.setValue(0);
    setT(0);

    const speed = SPEEDS[type];
    const listenerId = anim.addListener(({ value }) => setT(value));

    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: speed, useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: speed, useNativeDriver: false }),
      ])
    );
    loopRef.current.start();

    return () => {
      loopRef.current?.stop();
      anim.removeListener(listenerId);
    };
  }, [type]);

  const SW = 7;
  const SC = 'round' as const;
  const s = { stroke: color, strokeWidth: SW, strokeLinecap: SC };

  function renderFigure() {
    switch (type) {

      case 'walk': {
        const cx = 50; const cy = 14;
        const lLegX = lerp(34, 66, t);
        const rLegX = lerp(66, 34, t);
        const lLegY = lerp(90, 80, t);
        const rLegY = lerp(80, 90, t);
        const lArmX = lerp(26, 72, t);
        const rArmX = lerp(72, 26, t);
        return (
          <>
            <Circle cx={cx} cy={cy} r={10} fill={color} />
            <FaceOnHead cx={cx} cy={cy} progress={progress} mood={mood} />
            <Line x1={50} y1={24} x2={50} y2={64} {...s} />
            <Line x1={50} y1={40} x2={lArmX} y2={54} {...s} />
            <Line x1={50} y1={40} x2={rArmX} y2={54} {...s} />
            <Line x1={50} y1={64} x2={lLegX} y2={lLegY} {...s} />
            <Line x1={50} y1={64} x2={rLegX} y2={rLegY} {...s} />
          </>
        );
      }

      case 'run': {
        const cx = 56; const cy = 12;
        const lLegX = lerp(22, 70, t);
        const rLegX = lerp(70, 22, t);
        const lArmX = lerp(18, 78, t);
        const rArmX = lerp(78, 18, t);
        const lArmY = lerp(24, 48, t);
        const rArmY = lerp(48, 24, t);
        return (
          <>
            <Circle cx={cx} cy={cy} r={10} fill={color} />
            <FaceOnHead cx={cx} cy={cy} progress={progress} mood={mood} />
            <Line x1={56} y1={22} x2={46} y2={60} {...s} />
            <Line x1={52} y1={36} x2={lArmX} y2={lArmY} {...s} />
            <Line x1={52} y1={36} x2={rArmX} y2={rArmY} {...s} />
            <Line x1={46} y1={60} x2={lLegX} y2={92} {...s} />
            <Line x1={46} y1={60} x2={rLegX} y2={78} {...s} />
          </>
        );
      }

      case 'squat': {
        const bodyY = lerp(48, 62, t);
        const headY = lerp(12, 22, t);
        const lLegX = lerp(20, 32, t);
        const rLegX = lerp(80, 68, t);
        const armY = lerp(40, 54, t);
        const cx = 50; const cy = headY;
        return (
          <>
            <Circle cx={cx} cy={cy} r={10} fill={color} />
            <FaceOnHead cx={cx} cy={cy} progress={progress} mood={mood} />
            <Line x1={50} y1={headY + 10} x2={50} y2={bodyY} {...s} />
            <Line x1={50} y1={headY + 24} x2={28} y2={armY} {...s} />
            <Line x1={50} y1={headY + 24} x2={72} y2={armY} {...s} />
            <Line x1={50} y1={bodyY} x2={lLegX} y2={92} {...s} />
            <Line x1={50} y1={bodyY} x2={rLegX} y2={92} {...s} />
          </>
        );
      }

      case 'pushup': {
        const bodyY = lerp(56, 66, t);
        const headY = lerp(48, 58, t);
        const armY = lerp(82, 72, t);
        const cx = 20; const cy = headY;
        return (
          <>
            <Circle cx={cx} cy={cy} r={10} fill={color} />
            <FaceOnHead cx={cx} cy={cy} progress={progress} mood={mood} />
            <Line x1={28} y1={bodyY} x2={82} y2={bodyY} {...s} />
            <Line x1={42} y1={bodyY} x2={42} y2={armY} {...s} />
            <Line x1={64} y1={bodyY} x2={64} y2={armY} {...s} />
            <Line x1={82} y1={bodyY} x2={94} y2={bodyY - 4} {...s} />
            <Line x1={82} y1={bodyY} x2={94} y2={bodyY + 4} {...s} />
          </>
        );
      }

      case 'plank': {
        const cx = 16; const cy = 48;
        const armY = lerp(78, 84, t);
        return (
          <>
            <Circle cx={cx} cy={cy} r={10} fill={color} />
            <FaceOnHead cx={cx} cy={cy} progress={progress} mood={mood} />
            <Line x1={26} y1={56} x2={86} y2={60} {...s} />
            <Line x1={40} y1={57} x2={40} y2={armY} {...s} />
            <Line x1={62} y1={59} x2={62} y2={armY} {...s} />
            <Line x1={86} y1={60} x2={96} y2={55} {...s} />
            <Line x1={86} y1={60} x2={96} y2={67} {...s} />
          </>
        );
      }

      case 'jump': {
        const offset = lerp(0, -14, t);
        const legY = lerp(90, 75, t);
        const lArmX = lerp(26, 10, t);
        const rArmX = lerp(74, 90, t);
        const armY = lerp(36, 18, t);
        const cx = 50; const cy = 14 + offset;
        return (
          <>
            <Circle cx={cx} cy={cy} r={10} fill={color} />
            <FaceOnHead cx={cx} cy={cy} progress={progress} mood={mood} />
            <Line x1={50} y1={24 + offset} x2={50} y2={62 + offset} {...s} />
            <Line x1={50} y1={38 + offset} x2={lArmX} y2={armY + offset} {...s} />
            <Line x1={50} y1={38 + offset} x2={rArmX} y2={armY + offset} {...s} />
            <Line x1={50} y1={62 + offset} x2={28} y2={legY} {...s} />
            <Line x1={50} y1={62 + offset} x2={72} y2={legY} {...s} />
          </>
        );
      }

      case 'yoga': {
        const cx = 50; const cy = 14;
        const lArmX = lerp(18, 6, t);
        const rArmX = lerp(82, 94, t);
        return (
          <>
            <Circle cx={cx} cy={cy} r={10} fill={color} />
            <FaceOnHead cx={cx} cy={cy} progress={progress} mood={mood} />
            <Line x1={50} y1={24} x2={50} y2={62} {...s} />
            <Line x1={50} y1={38} x2={lArmX} y2={38} {...s} />
            <Line x1={50} y1={38} x2={rArmX} y2={38} {...s} />
            <Line x1={50} y1={62} x2={28} y2={92} {...s} />
            <Line x1={50} y1={62} x2={72} y2={92} {...s} />
          </>
        );
      }

      case 'box': {
        const cx = 52; const cy = 14;
        const punchX = lerp(72, 96, t);
        const punchY = lerp(28, 24, t);
        return (
          <>
            <Circle cx={cx} cy={cy} r={10} fill={color} />
            <FaceOnHead cx={cx} cy={cy} progress={progress} mood={mood} />
            <Line x1={52} y1={24} x2={48} y2={62} {...s} />
            <Line x1={50} y1={38} x2={26} y2={30} {...s} />
            <Circle cx={24} cy={28} r={6} fill={color} />
            <Line x1={50} y1={38} x2={punchX} y2={punchY} {...s} />
            <Circle cx={punchX} cy={punchY} r={6} fill={color} />
            <Line x1={48} y1={62} x2={30} y2={90} {...s} />
            <Line x1={48} y1={62} x2={66} y2={86} {...s} />
          </>
        );
      }

      case 'rest': {
        const cx = 16; const cy = 52;
        const bodyY = lerp(58, 60, t);
        return (
          <>
            <Circle cx={cx} cy={cy} r={10} fill={color} />
            <FaceOnHead cx={cx} cy={cy} progress={progress} mood={mood} />
            <Line x1={26} y1={bodyY} x2={88} y2={bodyY} {...s} />
            <Line x1={44} y1={bodyY} x2={40} y2={40} {...s} />
            <Line x1={68} y1={bodyY} x2={64} y2={42} {...s} />
            <Line x1={88} y1={bodyY} x2={96} y2={bodyY - 6} {...s} />
            <Line x1={88} y1={bodyY} x2={96} y2={bodyY + 6} {...s} />
            <Line x1={8} y1={76} x2={98} y2={76} stroke={color} strokeWidth={2} strokeLinecap="round" />
          </>
        );
      }

      case 'dance': {
        const cx = 50; const cy = 14;
        const lArmX = lerp(22, 76, t);
        const lArmY = lerp(20, 52, t);
        const rArmX = lerp(76, 22, t);
        const rArmY = lerp(52, 20, t);
        const lLegX = lerp(28, 72, t);
        const rLegX = lerp(72, 28, t);
        return (
          <>
            <Circle cx={cx} cy={cy} r={10} fill={color} />
            <FaceOnHead cx={cx} cy={cy} progress={progress} mood={mood} />
            <Line x1={50} y1={24} x2={50} y2={62} {...s} />
            <Line x1={50} y1={38} x2={lArmX} y2={lArmY} {...s} />
            <Line x1={50} y1={38} x2={rArmX} y2={rArmY} {...s} />
            <Line x1={50} y1={62} x2={lLegX} y2={92} {...s} />
            <Line x1={50} y1={62} x2={rLegX} y2={80} {...s} />
          </>
        );
      }

      default: {
        const cx = 50; const cy = 14;
        return (
          <>
            <Circle cx={cx} cy={cy} r={10} fill={color} />
            <FaceOnHead cx={cx} cy={cy} progress={progress} mood={mood} />
            <Line x1={50} y1={24} x2={50} y2={64} {...s} />
            <Line x1={50} y1={40} x2={28} y2={54} {...s} />
            <Line x1={50} y1={40} x2={72} y2={54} {...s} />
            <Line x1={50} y1={64} x2={34} y2={92} {...s} />
            <Line x1={50} y1={64} x2={66} y2={92} {...s} />
          </>
        );
      }
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.bubbleArea}>
        <View style={[styles.bubble, isLast && styles.bubbleLast]}>
          <Text style={[styles.bubbleText, isLast && styles.bubbleTextLast]}>
            {thoughtText}
          </Text>
        </View>
        <View style={styles.dots}>
          <View style={[styles.dot, { width: 6, height: 6, opacity: 0.65 }]} />
          <View style={[styles.dot, { width: 4, height: 4, opacity: 0.45 }]} />
          <View style={[styles.dot, { width: 3, height: 3, opacity: 0.25 }]} />
        </View>
      </View>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {renderFigure()}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  bubbleArea: {
    alignItems: 'center',
    marginBottom: 4,
  },
  bubble: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2e2e2e',
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 200,
  },
  bubbleLast: {
    borderColor: '#2d5a2d',
    backgroundColor: '#0f1f0f',
  },
  bubbleText: {
    fontFamily: 'SpaceGrotesk_400Regular',
    fontSize: 12,
    color: '#c8c8c8',
    textAlign: 'center',
  },
  bubbleTextLast: {
    color: '#5db85d',
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
    marginTop: 4,
    alignItems: 'flex-end',
    height: 8,
  },
  dot: {
    borderRadius: 99,
    backgroundColor: '#2e2e2e',
  },
});
