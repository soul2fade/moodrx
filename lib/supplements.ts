import { MoodKey } from './storage';

export interface Supplement {
  name: string;
  benefit: string;
  timing: string;
  dose: string;
  moods: MoodKey[];
  science: string;
}

export const SUPPLEMENTS: Supplement[] = [
  {
    name: 'Magnesium Glycinate',
    benefit: 'Calms nervous system',
    timing: 'Night',
    dose: '200-400mg',
    moods: ['anxious', 'stressed'],
    science: "Magnesium regulates your GABA receptors — the same system benzodiazepines target, minus the prescription and the zombie eyes. Most people are deficient and don't know it. The glycinate form crosses the blood-brain barrier better than cheap magnesium oxide, which mostly just makes you run to the bathroom.",
  },
  {
    name: 'Omega-3 EPA/DHA',
    benefit: 'Serotonin support',
    timing: 'With food',
    dose: '1-2g',
    moods: ['low'],
    science: "EPA and DHA are structural components of your brain cell membranes. Low omega-3 levels correlate with reduced serotonin transmission — your brain literally can't move the happy chemical around efficiently. The EPA fraction specifically has anti-inflammatory effects in neural tissue that multiple meta-analyses link to reduced depressive symptoms.",
  },
  {
    name: 'Ashwagandha KSM-66',
    benefit: 'Cortisol reduction',
    timing: 'Morning',
    dose: '300-600mg',
    moods: ['stressed', 'anxious'],
    science: "KSM-66 is a specific full-spectrum extract shown in randomized controlled trials to reduce cortisol by 27-30%. It's an adaptogen, meaning it modulates your stress response rather than sedating you. The 'KSM-66' part matters — it's the most clinically studied extract. Generic ashwagandha is a dice roll.",
  },
  {
    name: 'L-Theanine',
    benefit: 'Calm focus',
    timing: 'As needed',
    dose: '100-200mg',
    moods: ['anxious', 'restless'],
    science: "L-Theanine increases alpha brain wave activity — the same pattern you see in experienced meditators. It boosts GABA, serotonin, and dopamine simultaneously without making you drowsy. It's the reason green tea calms you down despite having caffeine. Works in about 30-40 minutes.",
  },
  {
    name: 'Vitamin D3+K2',
    benefit: 'Mood baseline',
    timing: 'Morning',
    dose: '2-5K IU',
    moods: ['low', 'foggy'],
    science: "Vitamin D receptors exist throughout your brain, particularly in areas controlling mood and cognition. Over 40% of Americans are deficient, and the correlation with depression is one of the most replicated findings in nutritional psychiatry. The K2 is there because D3 increases calcium absorption — K2 makes sure it goes to your bones, not your arteries.",
  },
  {
    name: "Lion's Mane",
    benefit: 'Neurogenesis',
    timing: 'Morning',
    dose: '500-1000mg',
    moods: ['foggy'],
    science: "Lion's Mane stimulates Nerve Growth Factor (NGF) production — a protein that literally grows and repairs neurons. Two clinical trials showed improved cognitive function in adults with mild cognitive impairment. It's one of the only legal, over-the-counter compounds with evidence for actual neurogenesis. Your brain fog isn't permanent. Feed it.",
  },
  {
    name: 'Rhodiola',
    benefit: 'Anti-fatigue',
    timing: 'Morning',
    dose: '200-400mg',
    moods: ['stressed', 'foggy'],
    science: "Rhodiola is an adaptogen that specifically targets mental fatigue. Clinical trials show it reduces cortisol while simultaneously improving attention and cognitive function under stress. It works on the HPA axis — the same stress pathway that ashwagandha hits, but through a different mechanism. They actually stack well together.",
  },
  {
    name: 'B-Complex',
    benefit: 'NT synthesis',
    timing: 'Morning',
    dose: '1 cap',
    moods: ['low', 'foggy', 'stressed'],
    science: "B vitamins are direct cofactors in neurotransmitter synthesis — your brain literally cannot produce serotonin, dopamine, or norepinephrine without B6, B9, and B12. Stress burns through B vitamins faster than normal. A deficiency doesn't feel like 'vitamin deficiency' — it feels like depression, brain fog, and fatigue. Which is why most people never connect the dots.",
  },
];

export function getSupplementsForMood(mood: MoodKey): Supplement[] {
  return SUPPLEMENTS.filter((s) => s.moods.includes(mood));
}