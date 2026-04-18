import React from 'react';
import Svg, { Circle, Rect, Line, Path, Ellipse, G } from 'react-native-svg';

export const DerekFigure = ({ step, color, size = 160 }: { step: number; color: string; size?: number }) => {
  const s = step;
  const aL = [-10, 0, -45, -30][s];
  const hipR = [15, 10, 20, 25][s];
  const by = [0, -2, -6, -3][s];
  return (
    <Svg width={size} height={size * 1.3} viewBox="0 0 200 260">
      <G transform={`translate(100,${126 + by})`}>
        <Path d="M-12,-6 L-10,38 L10,38 L12,-6 Z" fill={color} />
        <Line x1={-18} y1={-4} x2={18} y2={-4} stroke={color} strokeWidth={6} strokeLinecap="round" />
        <Line x1={-8} y1={38} x2={-10} y2={78} stroke={color} strokeWidth={5} strokeLinecap="round" />
        <Line x1={8} y1={38} x2={10} y2={78} stroke={color} strokeWidth={5} strokeLinecap="round" />
        <Path d="M-16,78 L-4,78 L-8,74" fill={color} />
        <Path d="M4,78 L16,78 L10,74" fill={color} />
        <G transform={`rotate(${aL},-18,-4)`}>
          <Line x1={-18} y1={-4} x2={-44} y2={-4} stroke={color} strokeWidth={5} strokeLinecap="round" />
          <Circle cx={-46} cy={-4} r={4.5} fill={color} />
        </G>
        <G transform={`rotate(${hipR},18,-4)`}>
          <Line x1={18} y1={-4} x2={36} y2={-4} stroke={color} strokeWidth={5} strokeLinecap="round" />
          <Line x1={36} y1={-4} x2={28} y2={12} stroke={color} strokeWidth={5} strokeLinecap="round" />
        </G>
        <Circle cx={0} cy={-24} r={15} fill={color} />
        <Path d="M-14,-32 Q-18,-54 -2,-48 Q8,-58 18,-46 Q24,-52 20,-34" fill={color} />
        <Path d="M18,-40 Q28,-44 26,-34" fill={color} />
        <Ellipse cx={0} cy={-16} rx={3} ry={2} fill="#1a1a1a" opacity={0.4} />
        {s >= 2 && (
          <G>
            <Rect x={-12} y={-28} width={10} height={6} rx={2} fill="#1a1a1a" opacity={0.35} />
            <Rect x={2} y={-28} width={10} height={6} rx={2} fill="#1a1a1a" opacity={0.35} />
            <Line x1={-2} y1={-25} x2={2} y2={-25} stroke="#1a1a1a" strokeWidth={1} opacity={0.35} />
          </G>
        )}
        {s === 3 && (
          <G opacity={0.4}>
            <Line x1={-34} y1={-10} x2={-38} y2={-10} stroke={color} strokeWidth={1.5} />
            <Line x1={-36} y1={-12} x2={-36} y2={-8} stroke={color} strokeWidth={1.5} />
            <Line x1={34} y1={10} x2={38} y2={10} stroke={color} strokeWidth={1.5} />
            <Line x1={36} y1={8} x2={36} y2={12} stroke={color} strokeWidth={1.5} />
          </G>
        )}
      </G>
    </Svg>
  );
};
