/**
 * MoodRx Workout Coach Component
 *
 * Road-sign style animated figures with 5 character voices:
 * - Honey Maximus (campy fitness, mood-lifting energy)
 * - Champ Headline (verbose anchor, broadcasting on the mood weather)
 * - Roscoe Sunshine (sweet himbo, defuses anxiety with confused warmth)
 * - Tex Thunderbird (racing intensity, channels stress into ferocious effort)
 * - Lance Sterling (vain catwalk energy, channels restlessness into performance)
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
  ron:   { id: 'ron',   name: 'Champ Headline',  color: '#C0392B' },
  brick: { id: 'brick', name: 'Roscoe Sunshine',  color: '#E67E22' },
  ricky: { id: 'ricky', name: 'Tex Thunderbird', color: '#3498DB' },
  derek: { id: 'derek', name: 'Lance Sterling',  color: '#9B59B6' },
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
    ["Sugar, your mood called — and she's ready to move.","This first step is hard because the feelings are heavy.","Couch energy is valid. So is getting up. Let's go.","Honey, the bad mood is about to meet its match.","We don't have to feel good to start. We start to feel good."],
    ["Ohhhh the clouds are lifting, honey.","My brain just sent flowers to my body.","Stress is fleeing the building in real time.","Honey, my nervous system is finally exhaling.","I can feel the gloom packing its bags."],
    ["I am alive, I am awake, I am literally glowing.","This is what therapy through movement feels like, darling.","Joy just walked in wearing sequins.","I just moved my way out of a mood, darling.","The sparkle was inside the whole time — we just shook it loose."],
    ["The mood has been moved — I rest my case.","Honey, I forgot what I was even worried about.","My head is quiet. My heart is open. The work is done.","I came for the mood, I stayed for the magic.","Tomorrow's problems, meet today's calmer me."],
  ],
  ron: [
    ["This evening's top story: a man, a mood, a movement.","I am reading from a teleprompter and it says 'Keep going.'","My body is like an ancient parchment being unfurled by a child.","I'm reporting live from the fog, and the fog is thick.","My nervous system is sending a press release: proceed anyway.","Breaking: local man begins workout. Story developing."],
    ["The fog has begun to lift. I can see my reflection again.","We are now witnessing a mood reversal in real time.","Breaking update — the chest is lighter, the head is clearer.","I would like to formally retract every complaint I made earlier.","I have been informed by my body that the forecast has changed."],
    ["I am broadcasting from a place of total clarity, ladies and gentlemen.","My brain has been upgraded to premium and I am loving the package.","The mood: elevated. The body: available. The man: unstoppable.","I am pleased to announce a major development in my own well-being.","I am living confirmation that movement is the best press release."],
    ["And that, dear viewers, is what we call a successful broadcast.","Signing off from a significantly better headspace — thank you for joining.","The mood report has been updated. The mood is fantastic.","I would like to thank my bloodstream, my lungs, and me.","Tomorrow's forecast: slightly more tolerable than today."],
  ],
  brick: [
    ["Hi. I am also nervous. Are we doing this together? Okay good.","My brain is doing the thing where it worries about everything.","Wait... is everyone else this worried all the time? Just me? Okay.","I forgot what we were doing. Oh right. Moving. Moving is good.","We are gonna move and it's gonna be... probably fine? Yes. Fine."],
    ["Wait. Wait wait wait. Did the scary thoughts just shrink?","I forgot to be nervous for like a whole minute just now.","Hey... I think the worries are getting quieter.","Something inside me is doing a thing and the thing is nice.","My heart is still going fast but I think it is happy fast."],
    ["I feel okay. I feel okay. I just wanted to say that.","My brain is quiet and my body is nice and I love both of them.","I love my body for doing this. I love my brain for letting it.","Hi. I am me. And I feel good. Whoa.","I think I just became a person who is not panicking. Look at me!"],
    ["I am safe. I am okay. I am here.","I think... I think I just took care of myself. Look at me.","Calm. C-A-L-M. Calm. I had to spell it to believe it.","I am breathing. I am moving. I am okay. Three things I am.","Thank you body. Thank you brain. We are friends now."],
  ],
  ricky: [
    ["Stress thinks it's gonna win today. Stress is wrong.","I came in tight. We are about to come out loose.","Helmet on. Brain off. Let's go.","Stress brought a hammer. I brought a whole workshop.","Start your engines, gentlemen. Today we beat the bad day."],
    ["Found second gear. Found it. There it is.","I can feel the stress getting scared, baby.","Body says go. Brain says go. Stress says nooo. Sounds like a win.","I am outrunning the bad day in real time.","The tension is melting like rubber on pavement."],
    ["The stress just saw my taillights.","I am the winner of the bad day.","I am firing on all cylinders and the cylinders are loud.","I came here stressed. I leave here legendary.","I'm in the lead against my own anxiety and I'm pulling away."],
    ["We crossed the line. The stress did not.","Checkered flag, baby. Stress — eat my dust.","Stress brought nothing. I brought everything. Done.","Pole position on my own dang day.","Engine cooling. Heart settling. Mood: fixed."],
  ],
  derek: [
    ["I can't sit still, so we are going to make sitting still irrelevant.","Restless legs? Restless brain? Wonderful — we have so much to work with.","I have been buzzing for hours. The buzz is about to become a vibe.","My body has been pacing in its own head. Now it gets to pace for real.","The energy is wild. We are about to give it a job."],
    ["I am literally pacing this out and my body finally agrees.","The buzz in my chest just became a beat I can dance to.","I think I just turned 'too much energy' into 'just enough swagger.'","Look at me find my flow. Look at it. Wow.","I came in fidgety. Now I am fluid."],
    ["I am so present I might charge admission.","This is what restless energy looks like with somewhere to go.","I have channeled the entire restlessness into motion and it is divine.","The fidget has become a flex.","Mirror says: stunning. Body says: deserved. Brain says: finally."],
    ["And that is how you turn a buzz into a bow.","I came in restless. I leave in repose.","The fidget is gone. In its place: actual peace. Wild.","I am still gorgeous, but now I am also quiet.","I outran my own twitchiness and the trophy is calm."],
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
  // useVideoPlayer captures the source on first call; subsequent mood
  // changes update coachVideoSource but the player instance keeps
  // playing the original video. swap the underlying source via
  // player.replace() so the visual coach matches the prop, not just
  // the surrounding text.
  const player = useVideoPlayer(coachVideoSource, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    try {
      player.replace(coachVideoSource);
      player.play();
    } catch {
      // expo-video may throw if the player was already torn down
    }
  }, [player, coachVideoSource]);

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
  coachLabel: { fontSize: 12, color: '#cdcdcd', lineHeight: 17 },
  moodNote: { fontSize: 12, color: '#ffffff', fontStyle: 'italic', marginBottom: 10, lineHeight: 17 },
  figureWrap: { width: '100%', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  bubble: { maxWidth: 300, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 6 },
  phraseText: { fontSize: 17, color: '#e0e0e0', textAlign: 'center', lineHeight: 26 },
  coachName: { fontSize: 14, fontFamily: 'BarlowCondensed_700Bold', letterSpacing: 2, marginBottom: 10 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2a2a2a' },
  controls: { flexDirection: 'row', gap: 8 },
  ctrlBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: 8, borderWidth: 0.5, borderColor: '#333' },
  ctrlText: { fontSize: 13, color: '#d8d8d8' },
});
