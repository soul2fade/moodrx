import React from 'react';
import Svg, { Circle, Line } from 'react-native-svg';

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
  if (/jab|cross|hook|uppercut|shadow|boxing|round|punch|striking/.test(t)) return 'box';
  if (/breath|rest|cool.?down|slow|still|quiet|lie|floor|wall|legs up/.test(t)) return 'rest';
  if (/song|dance|sway|feral|club/.test(t)) return 'dance';
  return 'default';
}

interface Props {
  stepText: string;
  color: string;
  size?: number;
}

export function ExerciseStickFigure({ stepText, color, size = 80 }: Props) {
  const type = detectType(stepText);
  const sw = 3;
  const sc = 'round';

  const sharedProps = {
    stroke: color,
    strokeWidth: sw,
    strokeLinecap: sc as 'round',
  };

  const figures: Record<ExerciseType, React.ReactNode> = {
    walk: (
      <>
        <Circle cx="50" cy="14" r="9" fill="none" stroke={color} strokeWidth={sw} />
        <Line x1="50" y1="23" x2="50" y2="60" {...sharedProps} />
        <Line x1="50" y1="38" x2="30" y2="54" {...sharedProps} />
        <Line x1="50" y1="38" x2="70" y2="46" {...sharedProps} />
        <Line x1="50" y1="60" x2="36" y2="90" {...sharedProps} />
        <Line x1="50" y1="60" x2="64" y2="82" {...sharedProps} />
      </>
    ),
    run: (
      <>
        <Circle cx="56" cy="14" r="9" fill="none" stroke={color} strokeWidth={sw} />
        <Line x1="56" y1="23" x2="46" y2="58" {...sharedProps} />
        <Line x1="52" y1="36" x2="72" y2="26" {...sharedProps} />
        <Line x1="52" y1="36" x2="32" y2="48" {...sharedProps} />
        <Line x1="46" y1="58" x2="28" y2="80" {...sharedProps} />
        <Line x1="46" y1="58" x2="64" y2="68" {...sharedProps} />
        <Line x1="64" y1="68" x2="58" y2="92" {...sharedProps} />
      </>
    ),
    squat: (
      <>
        <Circle cx="50" cy="14" r="9" fill="none" stroke={color} strokeWidth={sw} />
        <Line x1="50" y1="23" x2="50" y2="50" {...sharedProps} />
        <Line x1="50" y1="36" x2="28" y2="46" {...sharedProps} />
        <Line x1="50" y1="36" x2="72" y2="46" {...sharedProps} />
        <Line x1="50" y1="50" x2="34" y2="70" {...sharedProps} />
        <Line x1="34" y1="70" x2="22" y2="88" {...sharedProps} />
        <Line x1="50" y1="50" x2="66" y2="70" {...sharedProps} />
        <Line x1="66" y1="70" x2="78" y2="88" {...sharedProps} />
      </>
    ),
    pushup: (
      <>
        <Circle cx="20" cy="52" r="9" fill="none" stroke={color} strokeWidth={sw} />
        <Line x1="28" y1="56" x2="80" y2="58" {...sharedProps} />
        <Line x1="42" y1="56" x2="42" y2="80" {...sharedProps} />
        <Line x1="62" y1="57" x2="62" y2="81" {...sharedProps} />
        <Line x1="80" y1="58" x2="92" y2="54" {...sharedProps} />
        <Line x1="80" y1="58" x2="92" y2="64" {...sharedProps} />
      </>
    ),
    plank: (
      <>
        <Circle cx="16" cy="46" r="9" fill="none" stroke={color} strokeWidth={sw} />
        <Line x1="24" y1="52" x2="84" y2="58" {...sharedProps} />
        <Line x1="38" y1="55" x2="38" y2="78" {...sharedProps} />
        <Line x1="60" y1="57" x2="60" y2="80" {...sharedProps} />
        <Line x1="84" y1="58" x2="94" y2="55" {...sharedProps} />
        <Line x1="84" y1="58" x2="94" y2="65" {...sharedProps} />
      </>
    ),
    jump: (
      <>
        <Circle cx="50" cy="14" r="9" fill="none" stroke={color} strokeWidth={sw} />
        <Line x1="50" y1="23" x2="50" y2="60" {...sharedProps} />
        <Line x1="50" y1="36" x2="24" y2="20" {...sharedProps} />
        <Line x1="50" y1="36" x2="76" y2="20" {...sharedProps} />
        <Line x1="50" y1="60" x2="30" y2="90" {...sharedProps} />
        <Line x1="50" y1="60" x2="70" y2="90" {...sharedProps} />
      </>
    ),
    yoga: (
      <>
        <Circle cx="50" cy="14" r="9" fill="none" stroke={color} strokeWidth={sw} />
        <Line x1="50" y1="23" x2="50" y2="58" {...sharedProps} />
        <Line x1="50" y1="36" x2="18" y2="36" {...sharedProps} />
        <Line x1="50" y1="36" x2="82" y2="36" {...sharedProps} />
        <Line x1="50" y1="58" x2="28" y2="88" {...sharedProps} />
        <Line x1="50" y1="58" x2="72" y2="88" {...sharedProps} />
      </>
    ),
    box: (
      <>
        <Circle cx="52" cy="14" r="9" fill="none" stroke={color} strokeWidth={sw} />
        <Line x1="52" y1="23" x2="48" y2="58" {...sharedProps} />
        <Line x1="50" y1="36" x2="26" y2="28" {...sharedProps} />
        <Circle cx="24" cy="28" r="4" fill="none" stroke={color} strokeWidth={sw} />
        <Line x1="50" y1="36" x2="72" y2="24" {...sharedProps} />
        <Circle cx="74" cy="22" r="4" fill="none" stroke={color} strokeWidth={sw} />
        <Line x1="48" y1="58" x2="32" y2="86" {...sharedProps} />
        <Line x1="48" y1="58" x2="64" y2="80" {...sharedProps} />
      </>
    ),
    rest: (
      <>
        <Circle cx="16" cy="50" r="9" fill="none" stroke={color} strokeWidth={sw} />
        <Line x1="25" y1="56" x2="86" y2="60" {...sharedProps} />
        <Line x1="44" y1="57" x2="40" y2="40" {...sharedProps} />
        <Line x1="66" y1="59" x2="62" y2="42" {...sharedProps} />
        <Line x1="86" y1="60" x2="96" y2="54" {...sharedProps} />
        <Line x1="86" y1="60" x2="96" y2="68" {...sharedProps} />
        <Line x1="8" y1="72" x2="98" y2="72" stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      </>
    ),
    dance: (
      <>
        <Circle cx="50" cy="14" r="9" fill="none" stroke={color} strokeWidth={sw} />
        <Line x1="50" y1="23" x2="50" y2="60" {...sharedProps} />
        <Line x1="50" y1="36" x2="24" y2="22" {...sharedProps} />
        <Line x1="50" y1="36" x2="74" y2="50" {...sharedProps} />
        <Line x1="50" y1="60" x2="32" y2="82" {...sharedProps} />
        <Line x1="50" y1="60" x2="72" y2="72" {...sharedProps} />
        <Line x1="72" y1="72" x2="82" y2="58" {...sharedProps} />
      </>
    ),
    default: (
      <>
        <Circle cx="50" cy="14" r="9" fill="none" stroke={color} strokeWidth={sw} />
        <Line x1="50" y1="23" x2="50" y2="62" {...sharedProps} />
        <Line x1="50" y1="38" x2="28" y2="52" {...sharedProps} />
        <Line x1="50" y1="38" x2="72" y2="52" {...sharedProps} />
        <Line x1="50" y1="62" x2="34" y2="90" {...sharedProps} />
        <Line x1="50" y1="62" x2="66" y2="90" {...sharedProps} />
      </>
    ),
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {figures[type]}
    </Svg>
  );
}
