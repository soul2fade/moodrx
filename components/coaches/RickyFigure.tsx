import React from 'react';
import Svg, { Circle, Rect, Line, Path, Ellipse, G, Text as SvgText } from 'react-native-svg';

export const RickyFigure = ({ step, color, size = 160 }: { step: number; color: string; size?: number }) => {
  const s = step;
  const aL = [-20, 5, -60, -15][s];
  const aR = [20, -5, 60, 15][s];
  const legW = [14, 16, 22, 16][s];
  const by = [0, -2, -6, -3][s];
  return (
    <Svg width={size} height={size * 1.3} viewBox="0 0 200 260">
      <G transform={`translate(100,${128 + by})`}>
        <Rect x={-16} y={-6} width={32} height={42} rx={6} fill={color} />
        <Rect x={-3} y={-6} width={6} height={42} rx={2} fill="#1a1a1a" opacity={0.3} />
        <SvgText x={0} y={18} textAnchor="middle" fontSize={16} fill="#1a1a1a" fontWeight="500" opacity={0.5}>#1</SvgText>
        <Line x1={-22} y1={-4} x2={22} y2={-4} stroke={color} strokeWidth={8} strokeLinecap="round" />
        <Line x1={-legW / 2} y1={36} x2={-legW / 2 - 6} y2={72} stroke={color} strokeWidth={7} strokeLinecap="round" />
        <Line x1={legW / 2} y1={36} x2={legW / 2 + 6} y2={72} stroke={color} strokeWidth={7} strokeLinecap="round" />
        <Ellipse cx={-legW / 2 - 6} cy={74} rx={9} ry={4} fill={color} />
        <Ellipse cx={legW / 2 + 6} cy={74} rx={9} ry={4} fill={color} />
        <G transform={`rotate(${aL},-22,-4)`}>
          <Line x1={-22} y1={-4} x2={-48} y2={-4} stroke={color} strokeWidth={6} strokeLinecap="round" />
          <Circle cx={-50} cy={-4} r={5} fill={color} />
        </G>
        <G transform={`rotate(${aR},22,-4)`}>
          <Line x1={22} y1={-4} x2={48} y2={-4} stroke={color} strokeWidth={6} strokeLinecap="round" />
          {s >= 2 ? (
            <G transform="translate(50,-4)">
              <Rect x={-5} y={-6} width={10} height={12} rx={3} fill="#1a1a1a" opacity={0.45} />
              <Line x1={0} y1={-6} x2={0} y2={-18} stroke="#1a1a1a" strokeWidth={3} strokeLinecap="round" opacity={0.45} />
            </G>
          ) : (
            <Circle cx={50} cy={-4} r={5} fill={color} />
          )}
        </G>
        <Circle cx={0} cy={-24} r={16} fill={color} />
        <Path d="M-16,-28 Q-16,-44 0,-44 Q16,-44 16,-28" fill={color} />
        <Rect x={-18} y={-30} width={36} height={5} rx={2} fill={color} />
        <Path d="M-18,-28 L-24,-26 L-18,-25" fill={color} />
        {s >= 2 && (
          <G opacity={0.4}>
            <Line x1={-30} y1={-48} x2={-34} y2={-56} stroke={color} strokeWidth={2} strokeLinecap="round" />
            <Line x1={30} y1={-48} x2={34} y2={-56} stroke={color} strokeWidth={2} strokeLinecap="round" />
            <Line x1={0} y1={-50} x2={0} y2={-58} stroke={color} strokeWidth={2} strokeLinecap="round" />
          </G>
        )}
      </G>
    </Svg>
  );
};
