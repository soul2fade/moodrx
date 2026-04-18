import React from 'react';
import Svg, { Circle, Rect, Line, Path, Ellipse, G, Polygon } from 'react-native-svg';

export const RonFigure = ({ step, color, size = 160 }: { step: number; color: string; size?: number }) => {
  const s = step;
  const aL = [-25, -5, -55, -20][s];
  const aR = [15, 5, 40, 15][s];
  const by = [0, -2, -6, -3][s];
  return (
    <Svg width={size} height={size * 1.3} viewBox="0 0 200 260">
      <G transform={`translate(100,${128 + by})`}>
        <Path d="M-20,-6 L-22,8 L-18,34 L18,34 L22,8 L20,-6 Z" fill={color} />
        <Path d="M-4,-6 L-12,14 L-4,10 Z" fill="#1a1a1a" opacity={0.25} />
        <Path d="M4,-6 L12,14 L4,10 Z" fill="#1a1a1a" opacity={0.25} />
        <Polygon points="0,-4 -4,6 0,22 4,6" fill={color} opacity={0.6} />
        <Line x1={-24} y1={-6} x2={24} y2={-6} stroke={color} strokeWidth={9} strokeLinecap="round" />
        <Rect x={-14} y={34} width={11} height={34} rx={4} fill={color} opacity={0.8} />
        <Rect x={3} y={34} width={11} height={34} rx={4} fill={color} opacity={0.8} />
        <Ellipse cx={-8} cy={70} rx={9} ry={4} fill={color} />
        <Ellipse cx={9} cy={70} rx={9} ry={4} fill={color} />
        <G transform={`rotate(${aL},-24,-6)`}>
          <Rect x={-50} y={-10} width={28} height={9} rx={4.5} fill={color} />
          <Circle cx={-53} cy={-5.5} r={5} fill={color} opacity={0.7} />
        </G>
        <G transform={`rotate(${aR},24,-6)`}>
          <Rect x={24} y={-10} width={28} height={9} rx={4.5} fill={color} />
          <Circle cx={55} cy={-5.5} r={5} fill={color} opacity={0.7} />
          <G transform="translate(58,-5.5)">
            <Path d="M-4,5 L-3,-5 L3,-5 L4,5 Z" fill="none" stroke="#1a1a1a" strokeWidth={1.5} opacity={0.6} />
            <Line x1={0} y1={5} x2={0} y2={10} stroke="#1a1a1a" strokeWidth={1.5} opacity={0.6} />
            <Line x1={-3} y1={10} x2={3} y2={10} stroke="#1a1a1a" strokeWidth={1.5} opacity={0.6} />
            <Rect x={-2} y={-2} width={4} height={5} rx={1} fill="#E67E22" opacity={0.45} />
          </G>
        </G>
        <Circle cx={0} cy={-26} r={16} fill={color} />
        <Path d="M-16,-34 Q-14,-52 -4,-48 Q2,-56 8,-48 Q16,-52 16,-34" fill={color} />
        <Path d="M-18,-34 Q-24,-28 -20,-22" fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" />
        <Path d="M18,-34 Q24,-28 20,-22" fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" />
        <Rect x={-10} y={-18} width={20} height={5} rx={2.5} fill="#1a1a1a" opacity={0.5} />
        {s >= 2 && (
          <G opacity={0.4}>
            <Line x1={-30} y1={-50} x2={-36} y2={-58} stroke={color} strokeWidth={2} strokeLinecap="round" />
            <Line x1={30} y1={-50} x2={36} y2={-58} stroke={color} strokeWidth={2} strokeLinecap="round" />
          </G>
        )}
      </G>
    </Svg>
  );
};
