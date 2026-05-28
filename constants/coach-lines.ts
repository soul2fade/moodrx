import type { InsultMood, WorkoutMoment } from './insults';

/** Softer Dr. MoodRx copy for anxious and low moods */
export const COACH_LINES: Partial<Record<InsultMood, Record<WorkoutMoment, string[]>>> = {
  anxious: {
    pre: [
      "Starting is the hard part. You're here — that's the win.",
      "Your brain will object. That's normal. One step at a time.",
      "You don't have to feel ready. You just have to begin.",
    ],
    mid: [
      "Still here. Still breathing. That's enough for now.",
      "Halfway. The worry didn't stop you — notice that.",
      "Your body is doing what it's supposed to. Stay with it.",
    ],
    post: [
      "You were anxious about doing it. You did it anyway. Remember that.",
      "Not fixed — shifted. That's real progress.",
      "You showed up scared and finished. That counts.",
    ],
  },
  low: {
    pre: [
      "You feel heavy. Moving won't fix everything — it might help a little.",
      "Motivation can show up after you start. Begin small.",
      "You opened the app on a hard day. That matters.",
    ],
    mid: [
      "Still going. You don't have to feel good for it to work.",
      "One step, then another. That's the whole job right now.",
      "Halfway. The version that didn't start doesn't get this win.",
    ],
    post: [
      "You did the version of this workout that's hardest — when you didn't want to.",
      "Doesn't fix everything. Fixed something. Come back tomorrow.",
      "Your baseline is a little better than when you started. Take it.",
    ],
  },
};
