/**
 * MoodRx Workout Coach Component
 *
 * Road-sign style animated figures with 5 character voices:
 * - Honey Maximus (campy fitness, mood-lifting energy)
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
import { useVideoPlayer, VideoView } from 'expo-video';

type CoachId = 'vera' | 'ron' | 'brick' | 'ricky' | 'derek';
type MoodKey = 'anxious' | 'low' | 'foggy' | 'restless' | 'stressed' | 'good';

const COACHES: Record<CoachId, { id: CoachId; name: string; color: string }> = {
  vera:  { id: 'vera',  name: 'Honey Maximus',  color: '#FF6B9D' },
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

const PHRASES: Record<CoachId, string[][]> = {
  vera: [
    ["Sugar, your MOOD called — and she's READY to MOVE","This first step is HARD because the FEELINGS are HEAVY","Couch energy is VALID. So is GETTING UP. Let's GO.","Honey, the BAD MOOD is about to MEET its MATCH","We don't have to FEEL GOOD to START. We START to FEEL GOOD."],
    ["Ohhhh the CLOUDS are LIFTING, honey","My BRAIN just sent FLOWERS to my BODY","Stress is FLEEING the BUILDING in REAL TIME","Honey, my NERVOUS SYSTEM is FINALLY EXHALING","I can FEEL the GLOOM packing its BAGS"],
    ["I am ALIVE, I am AWAKE, I am LITERALLY GLOWING","This is what THERAPY through MOVEMENT FEELS like, darling","Joy just WALKED IN WEARING SEQUINS","I just MOVED my way OUT of a MOOD, darling","The SPARKLE was INSIDE the whole TIME — we just SHOOK it LOOSE"],
    ["The MOOD has been MOVED — I REST my CASE","Honey, I FORGOT what I was even WORRIED about","My HEAD is QUIET. My HEART is OPEN. The WORK is DONE.","I CAME for the MOOD, I STAYED for the MAGIC","Tomorrow's PROBLEMS, meet TODAY's calmer ME"],
  ],
  ron: [
    ["I'm in a glass case of emotion... and sweat","I'm in a glass case of emotion","My body is like a fine leather-bound book being read in a hurricane","The pain is... actually quite poetic","I immediately regret this decision","This is NOT what the brochure promised"],
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

const COACH_VIDEO_BY_MOOD: Record<MoodKey, number> = {
  anxious:  require('../assets/videos/coach-anxious.mp4'),
  low:      require('../assets/videos/coach-low.mp4'),
  foggy:    require('../assets/videos/coach-foggy.mp4'),
  restless: require('../assets/videos/coach-restless.mp4'),
  stressed: require('../assets/videos/coach-stressed.mp4'),
  good:     require('../assets/videos/coach-good.mp4'),
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
  accentColor?: string;    // mood accent color for attribution text
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
  accentColor,
}: WorkoutCoachProps) {
  const defaultCoachId = (coachOverride || MOOD_COACH_MAP[mood] || 'ron') as CoachId;
  const [selectedCoach, setSelectedCoach] = useState<CoachId>(defaultCoachId);
  const [internalStep, setInternalStep] = useState(0);
  const [phrase, setPhrase] = useState(() => getPhrase(defaultCoachId, 0));

  const coachVideoSource = COACH_VIDEO_BY_MOOD[mood] ?? COACH_VIDEO_BY_MOOD.anxious;
  const player = useVideoPlayer(coachVideoSource, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    try { player.play(); } catch { /* noop */ }
  }, [player]);

  const isControlled = controlledStep !== undefined;
  const step = isControlled ? Math.min(3, Math.max(0, controlledStep)) : internalStep;

  useEffect(() => {
    setPhrase(getPhrase(selectedCoach, step));
    // phraseKey triggers a fresh random pick from the same bank on every workout step
  }, [step, selectedCoach, phraseKey]);

  useEffect(() => {
    const newCoach = (coachOverride || MOOD_COACH_MAP[mood] || 'ron') as CoachId;
    setSelectedCoach(newCoach);
    if (!isControlled) setInternalStep(0);
  }, [mood, coachOverride, isControlled]);

  useEffect(() => {
    if (!autoPlay || isControlled) return;
    const interval = setInterval(() => {
      setInternalStep((prev) => {
        if (prev >= 3) { clearInterval(interval); onComplete?.(); return 3; }
        return prev + 1;
      });
    }, stepDuration);
    return () => clearInterval(interval);
  }, [autoPlay, stepDuration, isControlled, onComplete]);

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
        <VideoView
          player={player}
          style={{ width: figureSize, height: figureSize, backgroundColor: '#0a0a0a' }}
          contentFit="contain"
          nativeControls={false}
        />
      </View>

      <View style={styles.bubble}>
        <Text style={styles.phraseText}>{`\u201C${phrase}\u201D`}</Text>
      </View>
      <Text style={[styles.coachName, { color: accentColor ?? activeCoach.color }]}>{`\u2014 ${activeCoach.name.toLowerCase()}`}</Text>

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
  coachLabel: { fontSize: 12, color: '#999', lineHeight: 17 },
  moodNote: { fontSize: 12, color: '#ffffff', fontStyle: 'italic', marginBottom: 10, lineHeight: 17 },
  figureWrap: { width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  bubble: { maxWidth: 300, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 6 },
  phraseText: { fontSize: 17, color: '#e0e0e0', textAlign: 'center', lineHeight: 26 },
  coachName: { fontSize: 14, fontFamily: 'BarlowCondensed_700Bold', letterSpacing: 2, marginBottom: 10 },
  dotRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2a2a2a' },
  stepLabel: { fontSize: 12, color: '#ffffff', marginBottom: 12, letterSpacing: 1, textTransform: 'uppercase', lineHeight: 17 },
  controls: { flexDirection: 'row', gap: 8 },
  ctrlBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 8, borderWidth: 0.5, borderColor: '#333' },
  ctrlText: { fontSize: 13, color: '#bbb' },
  videoContainer: { borderRadius: 8, overflow: 'hidden', borderWidth: 1, backgroundColor: '#111' },
});
