import { MoodKey } from './storage';

export type WorkoutIntensity = 'Light' | 'Moderate' | 'Intense';

export interface Workout {
  id: string;
  mood: MoodKey;
  name: string;
  vibe: string;
  duration: number;
  intensity: WorkoutIntensity;
  steps: string[];
  why: string;
  sources: string[];
}

export const WORKOUTS: Workout[] = [
  // ANXIOUS
  {
    id: 'anxious-1',
    mood: 'anxious',
    name: 'Rhythmic Walking',
    vibe: "Easy enough that you'll actually do it",
    duration: 20,
    intensity: 'Light',
    steps: [
      "5 min gentle warm-up walk. You're not racing anyone.",
      '10 min steady pace — count steps in groups of 4. It gives your anxious brain a job.',
      'Focus on foot-ground contact each step. The ground is still there.',
      'Match breathing to steps: in for 4, out for 4.',
      '3 min gradual slowdown.',
      '2 min standing. 4-7-8 breathing: in 4, hold 7, out 8.',
    ],
    why: `Walking pulls you out of your head. A steady, rhythmic walk — especially outdoors — quiets the brain's rumination circuitry and gives the spiral somewhere else to go. The counting keeps your mind busy with something other than catastrophizing. The 4-7-8 breathing at the end is the real lever: slow breathing with a long exhale measurably boosts vagal tone — your body's brake pedal. Make it a habit and it compounds: regular rhythmic movement helps dial down baseline stress over time.`,
    sources: [
      'Bratman et al. (2015). Nature experience reduces rumination and subgenual prefrontal cortex activation. PNAS, 112(28), 8567–8572.',
      'Laborde et al. (2022). Effects of voluntary slow breathing on heart rate and heart rate variability: a systematic review and meta-analysis. Neuroscience & Biobehavioral Reviews, 138, 104711.',
    ],
  },
  {
    id: 'anxious-2',
    mood: 'anxious',
    name: 'Anxiety-Release Yoga',
    vibe: "Just enough to feel alive",
    duration: 25,
    intensity: 'Light',
    steps: [
      "Child's pose — 2 min. Congratulations, you're exercising.",
      'Cat-cow flow — 3 min. You are both animals now.',
      'Standing forward fold, ragdoll arms — 3 min.',
      'Warrior II — hold 2 min each side.',
      'Pigeon pose — 3 min each side. Emotional baggage storage.',
      "Legs up the wall — 5 min. Looks lazy. It's science.",
      "Savasana — 4 min. Lie there. You're welcome.",
    ],
    why: `Yoga's mix of controlled breathing and movement nudges your nervous system out of fight-or-flight and toward "rest and digest." A single session reliably takes the edge off anxiety. Restorative postures like legs-up-the-wall let your body downshift; hip openers like pigeon stretch the areas that clench when you're tense. The point is the slow stretch and the breath that comes with it.`,
    sources: [
      'Yin et al. (2021). The effects of a single session of mindful exercise on anxiety: a systematic review and meta-analysis. Mental Health and Physical Activity, 21, 100403.',
      'Streeter et al. (2010). Effects of yoga versus walking on mood, anxiety, and brain GABA levels: a randomized controlled MRS study. Journal of Alternative and Complementary Medicine, 16(11), 1145–1152.',
    ],
  },
  {
    id: 'anxious-3',
    mood: 'anxious',
    name: 'Steady-State Cardio',
    vibe: 'This will hurt. You will thank me.',
    duration: 30,
    intensity: 'Moderate',
    steps: [
      '5 min easy warm-up.',
      '20 min steady rhythmic pace — commit like a marriage.',
      "Match breath to movement. Repetitive? That's the point.",
      'Mind wanders to your 47 worries? Return to counting.',
      '5 min gradual cool-down.',
      '2 min box breathing: in 4, hold 4, out 4, hold 4.',
    ],
    why: `Sustained moderate cardio raises your brain's GABA — the neurotransmitter that tells anxious neurons to quiet down — and floods you with feel-good endorphins. The rhythm is the therapy: steady, repetitive movement gives your churning mind something simple to lock onto, and the rumination loosens its grip. Multiple meta-analyses confirm aerobic exercise is a genuinely effective treatment for anxiety — not a consolation prize.`,
    sources: [
      'Streeter et al. (2010). Effects of yoga versus walking on mood, anxiety, and brain GABA levels: a randomized controlled MRS study. Journal of Alternative and Complementary Medicine, 16(11), 1145–1152.',
      'Aylett et al. (2018). Exercise in the treatment of clinical anxiety in general practice: a systematic review and meta-analysis. BMC Health Services Research, 18(1), 559.',
    ],
  },

  // LOW
  {
    id: 'low-1',
    mood: 'low',
    name: 'Mood-Boost Strength',
    vibe: "Just enough to feel alive",
    duration: 20,
    intensity: 'Moderate',
    steps: [
      'Squats — 12 reps x 3 sets. Your legs work. Prove it.',
      'Push-ups — 10 reps x 3. Wall push-ups count.',
      'Lunges — 10 each leg x 3 sets.',
      'Plank — 30 sec x 3. Time moves slower here.',
      '10 jumping jacks between sets.',
      "3 min cool-down. You did something your brain said you couldn't.",
    ],
    why: `Resistance training triggers BDNF (Brain-Derived Neurotrophic Factor) — basically Miracle-Gro for the brain. Depression physically shrinks the hippocampus; strength training helps grow it back. Every rep is a small dopamine hit, and compound movements like squats and lunges recruit multiple muscle groups for a bigger neurochemical response. A 2018 meta-analysis in JAMA Psychiatry across 33 randomized controlled trials found resistance exercise produced a clinically meaningful reduction in depressive symptoms (effect size 0.66).`,
    sources: [
      'Gordon et al. (2018). Association of efficacy of resistance exercise training with depressive symptoms: meta-analysis and meta-regression analysis of randomized clinical trials. JAMA Psychiatry, 75(6), 566–576.',
    ],
  },
  {
    id: 'low-2',
    mood: 'low',
    name: 'Dance It Out',
    vibe: "Easy enough that you'll actually do it",
    duration: 15,
    intensity: 'Moderate',
    steps: [
      'Pick 4-5 songs that make you feel something. Anger counts.',
      'Song 1: gentle swaying. Not at the club yet.',
      'Songs 2-3: increase movement. No rules.',
      'Song 4: go feral. This is therapy.',
      'Last song: slow down. Deep breaths.',
      'Stand still 30 sec. Notice the difference. You did that.',
    ],
    why: `Music and movement together are a combination your brain can't resist. Movement nudges up the same feel-good chemistry — dopamine and norepinephrine — that tends to run low in depression, and music's pull on your brain's dopamine reward system rides along for free. A 2020 randomized trial found that adding dance movement therapy to standard care beat standard care alone for depression — and the edge held at a 3-month follow-up.`,
    sources: [
      'Hyvönen et al. (2020). The effects of dance movement therapy in the treatment of depression: a multicenter, randomized controlled trial in Finland. Frontiers in Psychology, 11, 1687.',
      'Basso & Suzuki (2016). The effects of acute exercise on mood, cognition, neurophysiology, and neurochemical pathways: a review. Brain Plasticity, 2(2), 127–152.',
    ],
  },
  {
    id: 'low-3',
    mood: 'low',
    name: 'Nature Walk',
    vibe: "Easy enough that you'll actually do it",
    duration: 25,
    intensity: 'Light',
    steps: [
      'Step outside. Notice 3 things. Name them.',
      'Walk 8 min. No goals. No route.',
      'Find something in nature. Look at it for 60 seconds.',
      'Walk 8 more min, slightly faster.',
      "Name 5 things you're grateful for. Coffee counts.",
      "5 min back. You went outside when your brain said don't.",
    ],
    why: `Exposure to natural environments reduces rumination by decreasing activity in the subgenual prefrontal cortex — the brain region overactive in depression. A 2015 Stanford study published in PNAS measured this directly: participants who walked 90 minutes in nature showed significantly lower sgPFC activity and self-reported rumination compared to those who walked in an urban setting. The gratitude step lights up the medial prefrontal cortex — the region tied to perspective and reward. Getting outside when you don't want to is itself a behavioral activation technique — a cornerstone of evidence-based depression treatment.`,
    sources: [
      'Bratman et al. (2015). Nature experience reduces rumination and subgenual prefrontal cortex activation. PNAS, 112(28), 8567–8572.',
      'Fox et al. (2015). Neural correlates of gratitude. Frontiers in Psychology, 6, 1491.',
    ],
  },

  // FOGGY
  {
    id: 'foggy-1',
    mood: 'foggy',
    name: 'Brain-Clearing HIIT',
    vibe: 'This will hurt. You will thank me.',
    duration: 12,
    intensity: 'Intense',
    steps: [
      '30 sec high knees — MAX. Floor is lava.',
      '30 sec rest. Regret nothing.',
      '30 sec burpees — MAX. Sorry and you\'re welcome.',
      '30 sec rest. Cherish it.',
      '30 sec mountain climbers — MAX.',
      '30 sec rest.',
      'Repeat 4x. Fog: gone.',
      '2 min cool-down. Welcome back.',
    ],
    why: `Brain fog tracks with sluggish blood flow and low alertness chemistry. Hard intervals push back on both. Going all-out pumps more oxygen-rich blood toward your brain than sitting still ever will, and norepinephrine — your brain's alertness chemical — surges when you push. A single hard session also bumps BDNF, and research shows it sharpens working memory and processing speed for up to about half an hour afterward.`,
    sources: [
      'Mou et al. (2022). The immediate and sustained effects of moderate-intensity continuous exercise and high-intensity interval exercise on working memory. Frontiers in Psychology, 13, 766679.',
      'Szuhany et al. (2015). A meta-analytic review of the effects of exercise on brain-derived neurotrophic factor. Journal of Psychiatric Research, 60, 56–64.',
    ],
  },
  {
    id: 'foggy-2',
    mood: 'foggy',
    name: 'Focus Shadowboxing',
    vibe: "Just enough to feel alive",
    duration: 15,
    intensity: 'Moderate',
    steps: [
      "2 min warm-up. You're a fighter now.",
      '3 min jab-cross. Snap them. Mean it.',
      'Brain fog has a face. Hit it with hooks and uppercuts — 2 min.',
      '3 min freestyle combos. No rules in your living room.',
      "2 min defensive movement. You're in a movie.",
      '1 min cool-down.',
      '2 min breathing. Brain fog: knocked out.',
    ],
    why: `Throwing combinations forces your brain to plan and your body to execute at the same time — more for your head to chew on than plodding cardio. Coordination-heavy, complex movement is exactly the kind exercise research links to sharper executive function. And swinging it out just feels good when your head's a fog.`,
    sources: [
      'Contreras-Osorio et al. (2022). Effects of sport-based exercise interventions on executive function in older adults: a systematic review and meta-analysis. International Journal of Environmental Research and Public Health, 19(19), 12573.',
    ],
  },
  {
    id: 'foggy-3',
    mood: 'foggy',
    name: 'Cold + Movement',
    vibe: "Easy enough that you'll actually do it",
    duration: 10,
    intensity: 'Light',
    steps: [
      "Cold water on face and wrists — 30 sec. Unpleasant. That's the point.",
      '10 jumping jacks.',
      '20 squats.',
      '10 push-ups. Any kind.',
      'Cold water again — 30 sec. Still working.',
      '10 jumping jacks.',
      '5 rounds box breathing. Clear? Good.',
    ],
    why: `Cold water on the face flips the dive reflex — your vagus nerve kicks in and your system resets. It's a hard pattern-interrupt for a foggy, frazzled head. Then you move, and the contrast snaps you into the moment. Think of it as rebooting a frozen computer.`,
    sources: [
      'Richer et al. (2022). Vagus activation by Cold Face Test reduces acute psychosocial stress responses. Scientific Reports, 12(1), 19270.',
    ],
  },

  // RESTLESS
  {
    id: 'restless-1',
    mood: 'restless',
    name: 'Explosive Energy Burn',
    vibe: 'This will hurt. You will thank me.',
    duration: 20,
    intensity: 'Intense',
    steps: [
      'Jump squats — 15 reps.',
      'Burpees — 10 reps.',
      'Sprint in place — 30 sec.',
      'Push-up to mountain climber — 10 reps.',
      'Rest 60 sec.',
      'Repeat 4 rounds.',
      '3 min stretching. The calm is earned.',
    ],
    why: `Restlessness is energy with nowhere to go — your nervous system revved, no outlet. Explosive moves like jump squats and burpees give it somewhere to land. You won't "burn off" stress hormones on command — intense exercise actually spikes them first — but hard effort followed by recovery tends to take the edge off: even a single bout of exercise can produce a small, real drop in anxiety. Go hard, then let the comedown do its work.`,
    sources: [
      'Connor et al. (2023). The effect of acute exercise on state anxiety: a systematic review. Sports, 11(8), 145.',
    ],
  },
  {
    id: 'restless-2',
    mood: 'restless',
    name: 'Heavy Bag / Pillow',
    vibe: 'This will hurt. You will thank me.',
    duration: 15,
    intensity: 'Intense',
    steps: [
      '2 min warm-up: shadow boxing.',
      "Round 1 (3 min): Jab-cross. Don't hold back.",
      '1 min rest.',
      'Round 2 (3 min): Hooks, uppercuts. Your round.',
      '1 min rest.',
      'Round 3 (3 min): Freestyle. Everything.',
      '2 min cool-down. Energy? Gone.',
    ],
    why: `Hitting something hard feels good, and the exercise behind it is what helps: studies on boxing-style training report meaningful drops in anxiety and depression symptoms — mostly from the workout, not the "venting." Worth knowing: research on anger finds that wailing on something to vent tends to stoke anger, not drain it. So don't ruminate — just move. Throw combos, breathe with the rounds, and let the effort settle your system.`,
    sources: [
      'Bozdarov et al. (2023). Boxing as an intervention in mental health: a scoping review. American Journal of Lifestyle Medicine, 17(4), 589–600.',
      'Bushman (2002). Does venting anger feed or extinguish the flame? Catharsis, rumination, distraction, anger, and aggressive responding. Personality and Social Psychology Bulletin, 28(6), 724–731.',
    ],
  },
  {
    id: 'restless-3',
    mood: 'restless',
    name: 'Sprint Intervals',
    vibe: 'This will hurt. You will thank me.',
    duration: 18,
    intensity: 'Intense',
    steps: [
      '3 min easy jog.',
      'Sprint 30 sec — max.',
      'Walk/jog 90 sec.',
      'Sprint 30 sec. Faster.',
      'Walk/jog 90 sec.',
      'Repeat 6x total.',
      '5 min easy cool-down. Notice the quiet.',
    ],
    why: `When you feel like you'll crawl out of your skin, max-effort sprints give that energy a job. You won't "metabolize" stress hormones on the spot — intense exercise actually spikes them first — but the recovery after each sprint is where your body downshifts, and a single hard session tends to nudge anxiety down. Empty the tank, then walk it off and feel the comedown.`,
    sources: [
      'Connor et al. (2023). The effect of acute exercise on state anxiety: a systematic review. Sports, 11(8), 145.',
    ],
  },

  // STRESSED
  {
    id: 'stressed-1',
    mood: 'stressed',
    name: 'Stress-Melt Sequence',
    vibe: "Just enough to feel alive",
    duration: 25,
    intensity: 'Moderate',
    steps: [
      '5 min brisk walk.',
      'Circuit: 10 squats, 10 lunges, 10 push-ups.',
      'Repeat 3x. Steady.',
      '5 min stretching: forward fold, 60 sec.',
      'Pigeon pose — 90 sec each side.',
      'Chest opener — 60 sec.',
      '3 min tense-and-release head to toe.',
      '2 min 4-7-8 breathing. Melted.',
    ],
    why: `This sequence pairs hard effort (the circuit) with a deliberate wind-down (the stretching and breathing). The circuit burns off nervous energy; the stretch-and-breathe phase flips you into recovery mode. Progressive muscle relaxation is a clinical technique shown to dial down physical tension and arousal. And the 4-7-8 breathing is the lever — slow breathing with a long exhale measurably boosts vagal tone, your body's brake pedal.`,
    sources: [
      'Toussaint et al. (2021). Effectiveness of progressive muscle relaxation, deep breathing, and guided imagery in promoting psychological and physiological states of relaxation. Evidence-Based Complementary and Alternative Medicine, 2021, 5924040.',
      'Laborde et al. (2022). Effects of voluntary slow breathing on heart rate and heart rate variability: a systematic review and meta-analysis. Neuroscience & Biobehavioral Reviews, 138, 104711.',
    ],
  },
  {
    id: 'stressed-2',
    mood: 'stressed',
    name: 'Yin Yoga',
    vibe: "Easy enough that you'll actually do it",
    duration: 30,
    intensity: 'Light',
    steps: [
      'Neck rolls, shoulder shrugs — 2 min.',
      'Butterfly — 4 min. Hips hold secrets.',
      'Dragon pose — 4 min each side. Stay.',
      'Sphinx — 4 min. Open up.',
      'Supine twist — 3 min each side.',
      'Legs up wall — 4 min.',
      'Savasana — 3 min. Enough today.',
    ],
    why: `Yin yoga's long, passive holds give tight areas time to release and let your nervous system settle — a five-week randomized trial found the approach significantly reduced stress and worry. The long holds (3–5 minutes) are uncomfortable by design: staying with mild discomfort is a kind of practice in tolerating it — the same muscle mindfulness training builds. The hip openers target where a lot of us hold tension.`,
    sources: [
      'Hylander et al. (2017). Yin yoga and mindfulness: a five week randomized controlled study evaluating the effects of the YOMI program on stress and worry. Anxiety, Stress, & Coping, 30(4), 365–378.',
    ],
  },
  {
    id: 'stressed-3',
    mood: 'stressed',
    name: 'Rhythmic Cardio',
    vibe: "Just enough to feel alive",
    duration: 20,
    intensity: 'Moderate',
    steps: [
      '3 min warm-up.',
      '14 min steady rhythm. One thing only.',
      'Count strokes or steps.',
      'Mind drifts? Return to counting.',
      '3 min cool-down.',
      '10 breaths, eyes closed. Processed.',
    ],
    why: `Repetitive rhythmic movement — rowing, cycling, swimming, brisk walking — is one of the oldest, most reliable ways to settle a stressed system. The counting task narrows your focus and interrupts the stress thought-loops. Twenty minutes of steady rhythmic cardio reliably takes the edge off: acute exercise measurably lowers anxiety. Make it regular and the stress-hormone benefits build over time.`,
    sources: [
      'Ensari et al. (2015). Meta-analysis of acute exercise effects on state anxiety: an update of randomized controlled trials over the past 25 years. Depression and Anxiety, 32(8), 624–634.',
    ],
  },

  // GOOD
  {
    id: 'good-1',
    mood: 'good',
    name: 'Personal Best',
    vibe: 'This will hurt. You will thank me.',
    duration: 25,
    intensity: 'Intense',
    steps: [
      'Dynamic warm-up — 5 min.',
      'Pick 3 exercises.',
      'Max reps, 45 sec each.',
      'Rest 90 sec.',
      '4 rounds. Beat round 1.',
      'Log your numbers. New baseline.',
      '5 min cool-down. Champion behavior.',
    ],
    why: `When you feel good, training feels easier — so use it. A single hard session reliably bumps BDNF, the growth factor your brain uses to adapt. Chase a personal best while the tank's full. The gains you bank today are still there on the days you'd rather stay in bed.`,
    sources: [
      'Szuhany et al. (2015). A meta-analytic review of the effects of exercise on brain-derived neurotrophic factor. Journal of Psychiatric Research, 60, 56–64.',
    ],
  },
  {
    id: 'good-2',
    mood: 'good',
    name: 'Something New',
    vibe: "Just enough to feel alive",
    duration: 25,
    intensity: 'Moderate',
    steps: [
      "Pick something you've NEVER tried.",
      "Watch 5 min tutorial. You're an expert. (You're not.)",
      "Practice 15 min. Be terrible. That's growth.",
      'That awkwardness = new neural connections.',
      '5 min reflect: what surprised you?',
      "Save it for a bad day. You built a weapon.",
    ],
    why: `Learning a new movement while you're in a good mood is a smart play. Novelty challenges your brain in ways repeating the same routine can't, and a positive state makes the awkward beginner phase easier to sit with. New skills build new coordination. Lean into being bad at something today — then save it for a bad day.`,
    sources: [],
  },
  {
    id: 'good-3',
    mood: 'good',
    name: 'Gratitude Walk',
    vibe: "Easy enough that you'll actually do it",
    duration: 20,
    intensity: 'Moderate',
    steps: [
      'Start moving. Any pace.',
      "5 min: what's going well.",
      '5 min: people you appreciate. Faster now.',
      '5 min: what your body can do.',
      '5 min: set one intention.',
      'Stop. Lock this feeling. Bookmark it.',
    ],
    why: `Pair an easy walk with a little gratitude. Both have real, independent track records: walking lifts mood, and gratitude practice gives a small but reliable boost to how you feel. Gratitude also lights up the brain's medial prefrontal cortex — the region tied to perspective and reward. Stack them and the walk becomes something you can come back to on harder days.`,
    sources: [
      'Fox et al. (2015). Neural correlates of gratitude. Frontiers in Psychology, 6, 1491.',
      'Cregg & Cheavens (2021). Gratitude interventions: effective self-help? A meta-analysis of the impact on symptoms of depression and anxiety. Journal of Happiness Studies, 22(1), 413–445.',
    ],
  },
];

export function getWorkoutsForMood(mood: MoodKey): Workout[] {
  return WORKOUTS.filter((w) => w.mood === mood);
}

export function getWorkoutById(id: string): Workout | undefined {
  return WORKOUTS.find((w) => w.id === id);
}

export function getShortestWorkoutForMood(mood: MoodKey): Workout | undefined {
  const moodWorkouts = getWorkoutsForMood(mood);
  if (moodWorkouts.length === 0) return undefined;
  return moodWorkouts.reduce((shortest, w) =>
    w.duration < shortest.duration ? w : shortest
  );
}
