/**
 * MoodRx Workout Coach Component
 *
 * Road-sign style animated figures with 5 character voices:
 * - Vera de Milo (muscle energy, campy confidence)
 * - Ron Burgundy (verbose, absurdly confident)
 * - Brick Tamland (confused, accidentally wholesome)
 * - Ricky Bobby (NASCAR intensity, competitive fire)
 * - Derek Zoolander (vain, fashion-obsessed)
 *
 * Props:
 *   mood: 'anxious' | 'low' | 'foggy' | 'restless' | 'stressed' | 'good'
 *   coachOverride: optional - force a specific coach
 *   step: optional controlled step (0-3); hides prev/next when provided
 *   onComplete: optional callback when all 4 steps finish
 *   autoPlay: boolean - auto-advance steps (default false)
 *   stepDuration: ms per step in autoplay (default 2800)
 *   figureSize: size of SVG figure (default 160)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Svg, {
  Circle,
  Rect,
  Line,
  Path,
  Ellipse,
  G,
  Polygon,
  Text as SvgText,
} from 'react-native-svg';

type CoachId = 'vera' | 'ron' | 'brick' | 'ricky' | 'derek';
type MoodKey = 'anxious' | 'low' | 'foggy' | 'restless' | 'stressed' | 'good';

const COACHES: Record<CoachId, { id: CoachId; name: string; color: string }> = {
  vera:  { id: 'vera',  name: 'Vera de Milo',   color: '#FF6B9D' },
  ron:   { id: 'ron',   name: 'Ron Burgundy',    color: '#C0392B' },
  brick: { id: 'brick', name: 'Brick Tamland',   color: '#E67E22' },
  ricky: { id: 'ricky', name: 'Ricky Bobby',     color: '#3498DB' },
  derek: { id: 'derek', name: 'Derek Zoolander', color: '#9B59B6' },
};

const MOOD_COACH_MAP: Record<MoodKey, CoachId> = {
  anxious:  'brick',
  low:      'vera',
  foggy:    'ron',
  restless: 'derek',
  stressed: 'ricky',
  good:     'ron',
};

const STEPS = [
  { key: 'struggle', label: 'The Struggle' },
  { key: 'shift',    label: 'The Shift' },
  { key: 'glory',    label: 'The Glory' },
  { key: 'clarity',  label: 'The Clarity' },
];

const PHRASES: Record<CoachId, string[][]> = {
  vera: [
    ["Honey, these muscles don't build THEMSELVES","The struggle is REAL and I am HERE for it","Pain is just weakness leaving the body in HEELS","This is SUFFERING, darling, but I'm FABULOUS","My body is a TEMPLE and temples need MAINTENANCE"],
    ["Ohhhh now we're TALKING","These guns are WAKING UP, sweetie","I can FEEL the magic happening","The transformation has BEGUN, hunty","My muscles are speaking and I am LISTENING"],
    ["LOOK AT ME. I am STUNNING and STRONG","These biceps don't LIE, baby","I am a GODDESS in this body","YESSS THIS is what POWER feels like","My strength is UNDENIABLE and GORGEOUS"],
    ["I am COMPLETE, I am WHOLE, I am MUSCULAR","*flexes* THE WORK PAYS OFF, DARLING","I have TRANSCENDED. I am GLOWING. I am RIPPED.","Clarity? Try DEFINITION, honey","HEAR ME ROAR, and LOOK AT THESE DELTOIDS"],
  ],
  ron: [
    ["I'm in a glass case of emotion... and sweat","My body is like a fine leather-bound book being read in a hurricane","The pain is... actually quite poetic","I immediately regret this decision","This is NOT what the brochure promised"],
    ["Stay classy, muscles","I'm having a moment of clarity about my biceps","Wait... am I kind of a big deal right now?","Something is happening and it is GOOD","My body just got a memo it did NOT expect"],
    ["I'm KIND of a big deal","People KNOW me. My body ESPECIALLY.","I have many leather-bound books about my own strength","I don't know how to put this but I'm pretty important","This feeling? It's called being MAGNIFICENT"],
    ["That escalated quickly... into enlightenment","I'm a man of substance AND definition","Milk was a bad choice but THIS was magnificent","You stay classy. I stay POWERFUL.","60% of the time I feel incredible EVERY time"],
  ],
  brick: [
    ["I don't know what we're doing but I am SCARED","Are we exercising? I love exercising! ...wait do I?","My arms are confused","Where am I? Oh right, working out. Cool cool cool.","I think my legs are angry at me"],
    ["Hey... I think something's happening!","My body just did a thing and I LIKED it","LOUD NOISES... but like, good ones?","I can feel my blood! Is that normal?","Wait I'm actually kind of good at this"],
    ["I LOVE THIS","I DON'T KNOW WHY I'M YELLING BUT IT FEELS RIGHT","My muscles are having a PARTY","I once ate a whole wheel of cheese. This is better.","I feel like a RAINBOW made of BICEPS"],
    ["I am very happy right now","I think I just became a better person? Is that how this works?","Everything is warm and tingly and WONDERFUL","I would like to do this again please","My body and my brain just became BEST FRIENDS"],
  ],
  ricky: [
    ["If you ain't first you're last and RIGHT NOW I'm last","I wanna go fast but my body wants to go HOME","Shake and bake? More like ache and break","Dear lord baby Jesus please let this end","I'm too LEGIT for this kind of suffering"],
    ["SHAKE... AND... BAKE","We are GOING for it now","I feel like a WINNER and winners don't quit","My body just found second gear baby","If you don't chew Big Red then... wait what was I saying"],
    ["I'M ON FIRE. Not literally. FIGURATIVELY.","SLINGSHOT ENGAGED","I AM A MACHINE AND THIS MACHINE IS RUNNIN HOT","Cal Naughton Jr WISHES he could feel this good","THIS is what championship DNA feels like"],
    ["I wanna be you when I grow up... wait I AM me","That just happened. That JUST happened.","Dear tiny baby Jesus, THANK YOU","If you ain't first you're last. I am FIRST.","I'm the BEST THERE IS, plain and simple"],
  ],
  derek: [
    ["But why male models... I mean, why EXERCISE","I can't turn left AND I can't do this","This is NOT Blue Steel. This is Blue STRUGGLE.","I feel like I'm taking crazy pills","Is this a center for ANTS? Because I'm SWEATING like one"],
    ["Wait... I think I just invented a new look. SWEAT STEEL.","I'm PRETTY sure I'm getting prettier right now","My body is like a RUNWAY and I just hit the turn","Moisture is the essence of wetness and I am MOIST","I feel a new look coming on..."],
    ["MAGNUM. This is MAGNUM.","I am RIDICULOUSLY good looking AND strong","One look? ONE LOOK? I have MULTIPLE looks now","This body was MADE for this. And also for modeling.","Le Tigre WISHES it could feel this way"],
    ["I think there's more to life than being really really ridiculously fit. But not much more.","Ferrari. That's what this feeling is. FERRARI.","I just Blue Steeled my own SOUL","Moisture, strength, and INCREDIBLE bone structure","I'm not just a model. I'm a MODEL ATHLETE."],
  ],
};

function getPhrase(coachId: CoachId, stepIndex: number): string {
  const bank = PHRASES[coachId]?.[stepIndex];
  if (!bank) return '';
  return bank[Math.floor(Math.random() * bank.length)];
}

// ─── SVG FIGURES ────────────────────────────────────────────────

const VeraFigure = ({ step, color, size = 160 }: { step: number; color: string; size?: number }) => {
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

const RonFigure = ({ step, color, size = 160 }: { step: number; color: string; size?: number }) => {
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

const BrickFigure = ({ step, color, size = 160 }: { step: number; color: string; size?: number }) => {
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

const RickyFigure = ({ step, color, size = 160 }: { step: number; color: string; size?: number }) => {
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

const DerekFigure = ({ step, color, size = 160 }: { step: number; color: string; size?: number }) => {
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

const CoachFigure = ({ coachId, step, color, size }: { coachId: CoachId; step: number; color: string; size: number }) => {
  const props = { step, color, size };
  switch (coachId) {
    case 'vera':  return <VeraFigure {...props} />;
    case 'ron':   return <RonFigure {...props} />;
    case 'brick': return <BrickFigure {...props} />;
    case 'ricky': return <RickyFigure {...props} />;
    case 'derek': return <DerekFigure {...props} />;
    default:      return <RonFigure {...props} />;
  }
};

// ─── MAIN COMPONENT ─────────────────────────────────────────────

interface WorkoutCoachProps {
  mood?: MoodKey;
  coachOverride?: CoachId;
  step?: number;           // controlled step — hides prev/next when provided
  phraseKey?: number;      // pass currentStep to refresh quote on every screen
  onComplete?: () => void;
  autoPlay?: boolean;
  stepDuration?: number;
  figureSize?: number;
  showCoachSelector?: boolean;
}

export default function WorkoutCoach({
  mood = 'anxious',
  coachOverride,
  step: controlledStep,
  phraseKey,
  onComplete,
  autoPlay = false,
  stepDuration = 2800,
  figureSize = 160,
  showCoachSelector = false,
}: WorkoutCoachProps) {
  const defaultCoachId = (coachOverride || MOOD_COACH_MAP[mood] || 'ron') as CoachId;
  const [selectedCoach, setSelectedCoach] = useState<CoachId>(defaultCoachId);
  const [internalStep, setInternalStep] = useState(0);
  const [phrase, setPhrase] = useState(() => getPhrase(defaultCoachId, 0));

  const isControlled = controlledStep !== undefined;
  const step = isControlled ? Math.min(3, Math.max(0, controlledStep)) : internalStep;

  useEffect(() => {
    setPhrase(getPhrase(selectedCoach, step));
  // phraseKey triggers a fresh random pick from the same bank on every workout step
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedCoach, phraseKey]);

  useEffect(() => {
    const newCoach = (coachOverride || MOOD_COACH_MAP[mood] || 'ron') as CoachId;
    setSelectedCoach(newCoach);
    if (!isControlled) setInternalStep(0);
  }, [mood, coachOverride]);

  useEffect(() => {
    if (!autoPlay || isControlled) return;
    const interval = setInterval(() => {
      setInternalStep((prev) => {
        if (prev >= 3) { clearInterval(interval); onComplete?.(); return 3; }
        return prev + 1;
      });
    }, stepDuration);
    return () => clearInterval(interval);
  }, [autoPlay, stepDuration, isControlled]);

  const advanceStep = useCallback(() => {
    if (internalStep < 3) setInternalStep(internalStep + 1);
    else onComplete?.();
  }, [internalStep, onComplete]);

  const activeCoach = COACHES[selectedCoach];

  return (
    <View style={styles.container}>
      {showCoachSelector && (
        <>
          <View style={styles.coachRow}>
            {(Object.values(COACHES) as typeof COACHES[CoachId][]).map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[styles.coachBtn, selectedCoach === c.id && { borderColor: c.color, backgroundColor: c.color + '18' }]}
                onPress={() => { setSelectedCoach(c.id as CoachId); if (!isControlled) setInternalStep(0); }}
                accessibilityRole="button"
                accessibilityLabel={`${c.name} coach`}
                accessibilityState={{ selected: selectedCoach === c.id }}
              >
                <View style={[styles.coachDot, { backgroundColor: c.color }]} />
                <Text style={[styles.coachLabel, selectedCoach === c.id && { color: c.color }]}>{c.id}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.moodNote}>mood-matched: {COACHES[MOOD_COACH_MAP[mood]]?.name?.toLowerCase()}</Text>
        </>
      )}

      <View style={styles.figureWrap}>
        <CoachFigure coachId={selectedCoach} step={step} color={activeCoach.color} size={figureSize} />
      </View>

      <View style={styles.bubble}>
        <Text style={styles.phraseText}>{`\u201C${phrase}\u201D`}</Text>
      </View>
      <Text style={[styles.coachName, { color: activeCoach.color }]}>{`\u2014 ${activeCoach.name.toLowerCase()}`}</Text>

      {!isControlled && !autoPlay && (
        <View style={styles.controls}>
          <TouchableOpacity style={styles.ctrlBtn} onPress={() => !isControlled && internalStep > 0 && setInternalStep(internalStep - 1)} disabled={internalStep === 0}>
            <Text style={[styles.ctrlText, internalStep === 0 && { opacity: 0.3 }]}>prev</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.ctrlBtn, { backgroundColor: activeCoach.color + '20', borderColor: activeCoach.color }]} onPress={advanceStep}>
            <Text style={[styles.ctrlText, { color: activeCoach.color }]}>{internalStep < 3 ? 'next →' : 'done ✓'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: 8 },
  coachRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginBottom: 8 },
  coachBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 0.5, borderColor: '#333' },
  coachDot: { width: 7, height: 7, borderRadius: 4 },
  coachLabel: { fontSize: 11, color: '#999' },
  moodNote: { fontSize: 10, color: '#555', fontStyle: 'italic', marginBottom: 10 },
  figureWrap: { alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  bubble: { maxWidth: 300, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 6 },
  phraseText: { fontSize: 13, color: '#e0e0e0', textAlign: 'center', lineHeight: 20 },
  coachName: { fontSize: 11, marginBottom: 10 },
  dotRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2a2a2a' },
  stepLabel: { fontSize: 11, color: '#555', marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase' },
  controls: { flexDirection: 'row', gap: 8 },
  ctrlBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 8, borderWidth: 0.5, borderColor: '#333' },
  ctrlText: { fontSize: 13, color: '#bbb' },
});
