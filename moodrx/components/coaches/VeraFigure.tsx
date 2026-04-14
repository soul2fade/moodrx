import React from 'react';
import Svg, { Circle, Rect, Line, Ellipse, G } from 'react-native-svg';

export const VeraFigure = ({ step, color, size = 160 }: { step: number; color: string; size?: number }) => {
  const s = step;
  const bicep = [5, 7, 10, 8][s];
  const sw = [32, 34, 38, 36][s];
  const fL = [-30, 20, -75, -40][s];
  const fR = [30, -20, 75, 40][s];
  const by = [0, -2, -6, -3][s];
  return (
    <Svg width={size} height={size * 1.3} viewBox="0 0 200 260">
      <G transform={`translate(100,${128 + by})`}>
        <Line x1={-sw} y1={-4} x2={sw} y2={-4} stroke={color} strokeWidth={10} strokeLinecap="round" />
        <Rect x={-18} y={-6} width={36} height={44} rx={6} fill={color} />
        <Line x1={-12} y1={38} x2={-14} y2={72} stroke={color} strokeWidth={8} strokeLinecap="round" />
        <Line x1={12} y1={38} x2={14} y2={72} stroke={color} strokeWidth={8} strokeLinecap="round" />
        <Rect x={-22} y={70} width={16} height={6} rx={3} fill={color} />
        <Rect x={6} y={70} width={16} height={6} rx={3} fill={color} />
        <G transform={`rotate(${fL},${-sw},-4)`}>
          <Line x1={-sw} y1={-4} x2={-sw - 26} y2={-4} stroke={color} strokeWidth={7} strokeLinecap="round" />
          <Ellipse cx={-sw - 13} cy={-4 - bicep * 0.7} rx={bicep * 0.7} ry={bicep} fill={color} />
          <Line x1={-sw - 26} y1={-4} x2={-sw - 26} y2={-22} stroke={color} strokeWidth={6} strokeLinecap="round" />
          <Circle cx={-sw - 26} cy={-24} r={5} fill={color} />
        </G>
        <G transform={`rotate(${fR},${sw},-4)`}>
          <Line x1={sw} y1={-4} x2={sw + 26} y2={-4} stroke={color} strokeWidth={7} strokeLinecap="round" />
          <Ellipse cx={sw + 13} cy={-4 - bicep * 0.7} rx={bicep * 0.7} ry={bicep} fill={color} />
          <Line x1={sw + 26} y1={-4} x2={sw + 26} y2={-22} stroke={color} strokeWidth={6} strokeLinecap="round" />
          <Circle cx={sw + 26} cy={-24} r={5} fill={color} />
        </G>
        <Circle cx={0} cy={-26} r={16} fill={color} />
        <Rect x={-18} y={-32} width={36} height={5} rx={2.5} fill={color} />
        <Line x1={16} y1={-32} x2={22} y2={-38} stroke={color} strokeWidth={3} strokeLinecap="round" />
        <Line x1={18} y1={-30} x2={26} y2={-34} stroke={color} strokeWidth={3} strokeLinecap="round" />
        <Ellipse cx={0} cy={-44} rx={20} ry={12} fill={color} />
        <Circle cx={-16} cy={-40} r={7} fill={color} />
        <Circle cx={16} cy={-40} r={7} fill={color} />
        <Circle cx={-10} cy={-52} r={6} fill={color} />
        <Circle cx={10} cy={-52} r={6} fill={color} />
        <Circle cx={0} cy={-54} r={5} fill={color} />
        {s >= 2 && (
          <G opacity={0.45}>
            <Line x1={-36} y1={-58} x2={-40} y2={-66} stroke={color} strokeWidth={2} strokeLinecap="round" />
            <Line x1={36} y1={-58} x2={40} y2={-66} stroke={color} strokeWidth={2} strokeLinecap="round" />
            <Line x1={0} y1={-60} x2={0} y2={-68} stroke={color} strokeWidth={2} strokeLinecap="round" />
          </G>
        )}
      </G>
    </Svg>
  );
};
