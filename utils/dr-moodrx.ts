import type { MoodKey } from '@/lib/storage';
import { MOODS } from '@/lib/moods';

type IntensityBand = 'low' | 'mid' | 'high';

const EXTRA_LINES: Record<MoodKey, Record<IntensityBand, string[]>> = {
  anxious: {
    low: [
      "Low-grade buzz. We'll match the dose to the noise.",
      "A little wired is still workable. Start small.",
    ],
    mid: [
      "Mid-level static. Movement beats waiting it out.",
      "Your nervous system wants a task. Give it one.",
    ],
    high: [
      "High alert isn't a verdict — it's a signal. We respond.",
      "Everything feels urgent. One step is still a step.",
    ],
  },
  low: {
    low: [
      "Flat isn't failure. It's a starting line.",
      "Low energy days still count if you show up.",
    ],
    mid: [
      "Heavy, but not stuck. We move anyway.",
      "The bar is on the floor today. That's fine.",
    ],
    high: [
      "Rough one. Minimum viable movement still moves the needle.",
      "When it's this hard, the win is beginning.",
    ],
  },
  foggy: {
    low: [
      "Light haze. Clear the pipes with simple motion.",
      "Brain fog loves stillness. We disagree.",
    ],
    mid: [
      "Can't think straight? Good — thinking is optional here.",
      "Half-speed brain, full-speed legs. That's the plan.",
    ],
    high: [
      "Thick fog. Short, simple, done beats perfect.",
      "You don't need clarity to start. Clarity can follow.",
    ],
  },
  restless: {
    low: [
      "Restless but contained. Channel it before it spills.",
      "Antsy energy wants an outlet. Here it is.",
    ],
    mid: [
      "Pacing energy. Put it in the workout, not the room.",
      "Your body is ahead of your schedule. Catch up.",
    ],
    high: [
      "Full jitter mode. Burn the edge safely.",
      "If you don't move it, it'll move you — poorly.",
    ],
  },
  stressed: {
    low: [
      "Tense, not boiling. Release before it stacks.",
      "Shoulders up? This is where they come down.",
    ],
    mid: [
      "Pressure's real. So is the exit ramp called movement.",
      "Stress wants control. Give it a timer instead.",
    ],
    high: [
      "Red-line day. Short burst, then breathe.",
      "One thing at a time. This thing is the workout.",
    ],
  },
  good: {
    low: [
      "Decent baseline. Stack a win while it's easy.",
      "Good enough to move. Don't overthink it.",
    ],
    mid: [
      "Solid window. Use it before the brain finds an excuse.",
      "Functional today. Bank it.",
    ],
    high: [
      "Rare green light. Don't waste the runway.",
      "Peak-ish mood. Match it with something real.",
    ],
  },
};

function intensityBand(intensity: number): IntensityBand {
  if (intensity <= 3) return 'low';
  if (intensity <= 7) return 'mid';
  return 'high';
}

function timeBand(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

export function getDrMoodRxLine(mood: MoodKey, intensity: number): string {
  const base = MOODS[mood].drMoodRx;
  const extras = EXTRA_LINES[mood][intensityBand(intensity)];
  const pool = [base, ...extras];
  const slot = (intensity + new Date().getDate() + (timeBand() === 'morning' ? 0 : timeBand() === 'afternoon' ? 3 : 7)) % pool.length;
  return pool[slot];
}
