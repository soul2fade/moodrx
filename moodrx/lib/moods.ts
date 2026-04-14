import { MoodKey } from './storage';

export interface MoodData {
  key: MoodKey;
  name: string;
  code: string;
  description: string;
  color: string;
  drMoodRx: string;
}

export const MOODS: Record<MoodKey, MoodData> = {
  anxious: {
    key: 'anxious',
    name: 'Anxious',
    code: 'ANX',
    description: "Brain won't shut up",
    color: '#E8B84B',
    drMoodRx:
      "Your nervous system is a chihuahua that heard a doorbell. We're going to calm it down.",
  },
  low: {
    key: 'low',
    name: 'Low',
    code: 'LOW',
    description: 'Everything is heavy',
    color: '#6366F1',
    drMoodRx: "Your brain's running on power-saving mode. Time to force a reboot.",
  },
  foggy: {
    key: 'foggy',
    name: 'Foggy',
    code: 'FOG',
    description: 'Who am I and why am I here',
    color: '#5EAAB5',
    drMoodRx: "47 tabs open, no RAM left. We're about to hit Ctrl+Alt+Delete.",
  },
  restless: {
    key: 'restless',
    name: 'Restless',
    code: 'RST',
    description: "If I don't move I'll explode",
    color: '#D97706',
    drMoodRx: "You're a shaken soda can. Let's open you up safely.",
  },
  stressed: {
    key: 'stressed',
    name: 'Stressed',
    code: 'STR',
    description: "One more thing and I'm done",
    color: '#E11D48',
    drMoodRx: "Your shoulders are up by your ears like they're trying to escape. We'll fix that.",
  },
  good: {
    key: 'good',
    name: 'Good',
    code: 'GD',
    description: "Rare but I'll take it",
    color: '#059669',
    drMoodRx: "Well well well. Look who showed up feeling functional. Let's not waste it.",
  },
};

export const MOOD_ORDER: MoodKey[] = ['anxious', 'low', 'foggy', 'restless', 'stressed', 'good'];