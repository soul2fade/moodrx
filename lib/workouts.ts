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
    why: "Rhythmic bilateral movement (left-right-left-right) activates the brain's default mode network and reduces amygdala hyperactivity. Translation: your alarm system gets a break. The counting gives your prefrontal cortex something to do besides catastrophize. Research shows 20 minutes of steady-state rhythmic exercise reduces cortisol by up to 26%. The 4-7-8 breathing at the end activates your vagus nerve — your body's own chill-out switch.",
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
    why: "Yoga's combination of controlled breathing and physical postures directly regulates the autonomic nervous system. Inversions like legs-up-the-wall increase parasympathetic tone — basically telling your fight-or-flight system to take five. Pigeon pose targets the hip flexors, which store tension during chronic stress. Studies show a single yoga session reduces state anxiety by an average of 40%.",
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
    why: 'Sustained moderate cardio for 20+ minutes floods your brain with endorphins and increases GABA production — the neurotransmitter that literally tells anxious neurons to quiet down. The rhythm is the therapy: monotonous movement pulls your brain out of threat-detection mode and into present-moment processing. Multiple meta-analyses confirm aerobic exercise is as effective as medication for generalized anxiety disorder.',
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
    why: "Resistance training triggers BDNF (Brain-Derived Neurotrophic Factor) — literally called 'Miracle-Gro for the brain.' Depression physically shrinks the hippocampus. Strength training grows it back. Every rep is a small dopamine hit. The compound movements (squats, lunges) activate multiple muscle groups simultaneously, creating a larger neurochemical response. Studies show strength training reduces depressive symptoms with effect sizes comparable to antidepressants.",
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
    why: "Music and movement together create a neurochemical cocktail your brain can't resist. Dancing increases dopamine, serotonin, and norepinephrine simultaneously — hitting all three systems that depression depletes. The self-directed, rule-free nature activates intrinsic motivation circuits. A 2019 randomized trial found dance movement therapy significantly more effective than standard care for depression, with effects lasting 3 months post-intervention.",
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
    why: 'Exposure to natural environments reduces rumination by decreasing activity in the subgenual prefrontal cortex — the brain region overactive in depression. The gratitude component activates the medial prefrontal cortex and releases dopamine. Even 20 minutes in a park lowers cortisol measurably. Getting outside when you don\'t want to is itself a behavioral activation technique — the cornerstone of evidence-based depression treatment.',
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
    why: "Brain fog is often caused by poor cerebral blood flow and low norepinephrine. High-intensity intervals solve both problems violently. Within 10 minutes, cerebral blood flow increases by up to 30%. Norepinephrine — your brain's alertness chemical — spikes during intense exercise and stays elevated for hours. The bursts also trigger immediate BDNF release. Research shows a single HIIT session improves working memory and processing speed for up to 4 hours post-workout.",
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
    why: "Shadowboxing requires simultaneous motor planning, spatial awareness, and rhythmic execution — forcing your prefrontal cortex to wake the hell up. The combination of aerobic intensity and complex movement patterns creates a stronger cognitive response than simple cardio alone. Boxing-style training has been shown to improve executive function and attention in multiple clinical populations. The aggression outlet also processes emotional arousal that contributes to foggy disconnection.",
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
    why: "Cold water triggers the dive reflex, immediately activating the vagus nerve and increasing alertness via norepinephrine release — up to a 300% spike in some studies. The rapid temperature contrast followed by movement creates an adrenaline response that clears cerebral fog faster than caffeine. The brief bodyweight circuit maintains that alertness state. This is the biochemical equivalent of rebooting a frozen computer.",
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
    why: "Restlessness is excess energy with nowhere to go — your sympathetic nervous system revved with no outlet. Explosive compound movements are the fastest way to metabolize stress hormones. Jump squats and burpees recruit large muscle groups and rapidly deplete excess adrenaline and cortisol. After 20 minutes of this, your parasympathetic system will assert dominance whether you want it to or not. Studies on exercise and akathisia (extreme restlessness) show high-intensity movement provides the fastest and most complete relief.",
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
    why: "Striking exercises are uniquely effective for restlessness because they combine physical exertion with psychological release. The impact feedback creates a proprioceptive loop that satisfies the body's demand for physical expression. Repetitive striking drains excess sympathetic activation more efficiently than non-contact exercise. The round structure also provides clear start/stop signals that help regulate an overstimulated nervous system.",
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
    why: "Sprint intervals are the fastest known method to metabolize excess cortisol and adrenaline — the hormones making you feel like you're going to crawl out of your skin. Maximum-effort sprints trigger a complete sympathetic discharge, followed by parasympathetic rebound during recovery. Six sprint intervals produce a calming effect that lasts 2-4 hours. Athletes describe the post-sprint state as 'enforced calm' — your body simply has no more gas left to be restless with.",
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
    why: "This sequence combines acute stress response (the circuit) with progressive parasympathetic activation (the stretching and breathing). The initial movement metabolizes stress hormones; the stretching phase then activates the relaxation response while the exercise endorphins are still circulating. The progressive muscle relaxation at the end is a clinical technique proven to reduce physiological arousal by 30-40%. The 4-7-8 breathing extends the exhale, which directly stimulates vagal tone.",
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
    why: "Yin yoga targets connective tissue and activates the parasympathetic nervous system through long-hold passive stretches. Stress physically tightens fascia and compresses joints — yin yoga reverses this at the tissue level. The long holds (3-5 minutes) are uncomfortable by design: learning to stay present with mild discomfort builds distress tolerance, the same psychological skill taught in DBT therapy. The hip openers specifically release stored tension patterns from the psoas — the muscle that contracts during the stress response.",
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
    why: "Repetitive rhythmic movement is one of the oldest and most reliable stress regulators known to neuroscience. Rowing, cycling, swimming, even brisk walking — the bilateral, rhythmic nature synchronizes brainwave activity and reduces cortisol. The counting task creates a narrow attentional focus that interrupts the stress thought loops. Research consistently shows 20 minutes of moderate rhythmic exercise reduces perceived stress by 20-30% and its effects persist for 4-6 hours.",
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
    why: "When you feel good, your prefrontal cortex is online and your neurotransmitters are balanced — prime conditions for physical improvement. Exercise during positive mood states produces stronger neuroplastic effects: BDNF levels are already elevated, making the brain more receptive to adaptation. Pushing for personal bests sets new neuromuscular baselines that persist when you feel less optimal. You're essentially building a biological buffer for harder days ahead.",
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
    why: "Novel motor learning during positive emotional states is extraordinarily efficient — emotional arousal amplifies hippocampal memory consolidation. Learning new movement patterns creates fresh neural pathways and stimulates neurogenesis at rates higher than repetitive exercise. The discomfort of being a beginner in a positive mood teaches your nervous system that novelty is safe. Research on skill acquisition shows emotional state during learning is one of the strongest predictors of retention.",
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
    why: "Combining movement with gratitude practice creates a neurochemical amplification effect. Gratitude activates the medial prefrontal cortex and releases dopamine and serotonin — the same chemicals exercise produces. Doing both simultaneously creates a stronger and longer-lasting mood elevation than either alone. The structured walking meditation format anchors cognitive reappraisal to physical experience, making the positive emotional state more memorable and accessible during future low periods.",
  },
];

export function getWorkoutsForMood(mood: MoodKey): Workout[] {
  return WORKOUTS.filter((w) => w.mood === mood);
}

export function getWorkoutById(id: string): Workout | undefined {
  return WORKOUTS.find((w) => w.id === id);
}