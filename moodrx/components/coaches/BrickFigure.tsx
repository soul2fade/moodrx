import React from 'react';
import Svg, { Circle, Rect, Line, Ellipse, G, Text as SvgText } from 'react-native-svg';

export const BrickFigure = ({ step, color, size = 160 }: { step: number; color: string; size?: number }) => {
  const s = step;
  const aL = [-15, 5, -40, -10][s];
  const aR = [10, -5, 30, 5][s];
  const tilt = [5, 3, 0, -3][s];
  const by = [0, -2, -6, -3][s];
  return (
    <Svg width={size} height={size * 1.3} viewBox="0 0 200 260">
      <G transform={`translate(100,${132 + by})`}>
        <Rect x={-20} y={-4} width={40} height={42} rx={8} fill={color} />
        <Rect x={-14} y={38} width={12} height={26} rx={5} fill={color} opacity={0.85} />
        <Rect x={2} y={38} width={12} height={26} rx={5} fill={color} opacity={0.85} />
        <Ellipse cx={-8} cy={66} rx={10} ry={5} fill={color} />
        <Ellipse cx={8} cy={66} rx={10} ry={5} fill={color} />
        <Line x1={-22} y1={-2} x2={22} y2={-2} stroke={color} strokeWidth={8} strokeLinecap="round" />
        <G transform={`rotate(${aL},-22,-2)`}>
          <Line x1={-22} y1={-2} x2={-46} y2={-2} stroke={color} strokeWidth={7} strokeLinecap="round" />
          <Circle cx={-48} cy={-2} r={5.5} fill={color} />
        </G>
        <G transform={`rotate(${aR},22,-2)`}>
          <Line x1={22} y1={-2} x2={46} y2={-2} stroke={color} strokeWidth={7} strokeLinecap="round" />
          <Circle cx={48} cy={-2} r={5.5} fill={color} />
          <G transform="translate(50,-2) rotate(-30)">
            <Line x1={0} y1={0} x2={0} y2={-32} stroke="#1a1a1a" strokeWidth={2} opacity={0.55} />
            <Line x1={-6} y1={-26} x2={0} y2={-32} stroke="#1a1a1a" strokeWidth={2} opacity={0.55} />
            <Line x1={6} y1={-26} x2={0} y2={-32} stroke="#1a1a1a" strokeWidth={2} opacity={0.55} />
            <Line x1={-6} y1={-26} x2={-6} y2={-30} stroke="#1a1a1a" strokeWidth={2} opacity={0.55} />
            <Line x1={6} y1={-26} x2={6} y2={-30} stroke="#1a1a1a" strokeWidth={2} opacity={0.55} />
            <Line x1={0} y1={-32} x2={0} y2={-36} stroke="#1a1a1a" strokeWidth={2} opacity={0.55} />
          </G>
        </G>
        <G transform={`rotate(${tilt},0,-22)`}>
          <Circle cx={0} cy={-22} r={16} fill={color} />
          <Rect x={-14} y={-38} width={28} height={8} rx={2} fill={color} />
        </G>
        {s <= 1 && <SvgText x={22} y={-30} fontSize={16} fill={color} fontWeight="500" opacity={0.5}>?</SvgText>}
        {s === 2 && <SvgText x={22} y={-30} fontSize={16} fill={color} fontWeight="500" opacity={0.5}>!</SvgText>}
        {s >= 2 && (
          <G opacity={0.4}>
            <Line x1={-28} y1={-44} x2={-32} y2={-52} stroke={color} strokeWidth={2} strokeLinecap="round" />
            <Line x1={28} y1={-44} x2={32} y2={-52} stroke={color} strokeWidth={2} strokeLinecap="round" />
          </G>
        )}
      </G>
    </Svg>
  );
};
