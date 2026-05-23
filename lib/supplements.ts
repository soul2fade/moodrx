import { MoodKey } from './storage';

export interface Supplement {
  name: string;
  benefit: string;
  timing: string;
  dose: string;
  moods: MoodKey[];
  science: string;
  sources: string[];
}

export const SUPPLEMENTS: Supplement[] = [
  {
    name: 'Magnesium Glycinate',
    benefit: 'Calms nervous system',
    timing: 'Night',
    dose: '200-400mg',
    moods: ['anxious', 'stressed'],
    science: "Magnesium regulates your GABA receptors — the same system benzodiazepines target, minus the prescription and the zombie eyes. NHANES data shows roughly 48% of Americans fall below the estimated average requirement for magnesium — most of them have no idea. The glycinate form is significantly better absorbed than cheap magnesium oxide, which mostly just makes you run to the bathroom.",
    sources: [
      "Boyle et al. (2017). The effects of magnesium supplementation on subjective anxiety and stress. Nutrients.",
      "Costello & Moser (2019). NHANES magnesium intake data. Open Heart.",
      "Abbasi et al. (2012). The effect of magnesium supplementation on primary insomnia. J Res Med Sci.",
    ],
  },
  {
    name: 'Omega-3 EPA/DHA',
    benefit: 'Serotonin support',
    timing: 'With food',
    dose: '1-2g',
    moods: ['low'],
    science: "EPA and DHA are structural components of your brain cell membranes. Low omega-3 levels correlate with reduced serotonin transmission — your brain literally can't move the happy chemical around efficiently. Across multiple meta-analyses, it's EPA specifically — not DHA — that consistently shows antidepressant effects, via its anti-inflammatory action in neural tissue. Look for supplements where EPA is the dominant fraction.",
    sources: [
      "Sublette et al. (2011). Meta-analytic review of EPA antidepressant effects. J Clin Psychiatry.",
      "Su et al. (2008). Omega-3 augmentation of sertraline in major depression. Biol Psychiatry.",
      "Grosso et al. (2014). Role of omega-3 fatty acids in depression. PLoS One.",
    ],
  },
  {
    name: '5-HTP',
    benefit: 'Serotonin precursor',
    timing: 'Evening',
    dose: '50-100mg',
    moods: ['low'],
    science: "5-HTP is the direct precursor to serotonin — your brain converts it one step before making the final molecule. Unlike tryptophan, 5-HTP crosses the blood-brain barrier efficiently and doesn't compete with other amino acids for transport. Multiple randomized trials show significant improvement in depressive symptoms. Don't combine with SSRIs or other serotonergic drugs without medical supervision.",
    sources: [
      "Birdsall (1998). 5-Hydroxytryptophan: a clinically effective serotonin precursor. Altern Med Rev.",
      "Shaw et al. (2002). Tryptophan and 5-HTP for depression. Cochrane Database Syst Rev.",
      "Nakajima et al. (1978). 5-HTP treatment of depression: a double-blind study. Folia Psychiatr Neurol Jpn.",
    ],
  },
  {
    name: 'Ashwagandha KSM-66',
    benefit: 'Cortisol reduction',
    timing: 'Morning',
    dose: '300-600mg',
    moods: ['stressed', 'anxious'],
    science: "KSM-66 is a specific full-spectrum extract shown in randomized controlled trials to reduce cortisol by 27-30%. It's an adaptogen, meaning it modulates your stress response rather than sedating you. The 'KSM-66' part matters — it's the most clinically studied extract. Generic ashwagandha is a dice roll.",
    sources: [
      "Chandrasekhar et al. (2012). Prospective, RCT of ashwagandha root extract. Indian J Psychol Med.",
      "Pratte et al. (2014). Alternative treatment of anxiety: KSM-66. J Altern Complement Med.",
      "Choudhary et al. (2017). Efficacy of ashwagandha root extract in improving memory. J Diet Suppl.",
    ],
  },
  {
    name: 'L-Theanine',
    benefit: 'Calm focus',
    timing: 'As needed',
    dose: '100-200mg',
    moods: ['anxious', 'restless'],
    science: "L-Theanine increases alpha brain wave activity — the same pattern you see in experienced meditators. It boosts GABA, serotonin, and dopamine simultaneously without making you drowsy. It's the reason green tea calms you down despite having caffeine. Works in about 30-40 minutes.",
    sources: [
      "Nobre et al. (2008). L-theanine, a natural constituent in tea and its effect on mental state. Asia Pac J Clin Nutr.",
      "Kimura et al. (2007). L-theanine reduces psychological and physiological stress responses. Biol Psychol.",
      "Ritsner et al. (2011). L-theanine relieves positive, activation, and anxiety symptoms. J Clin Psychiatry.",
    ],
  },
  {
    name: 'GABA',
    benefit: 'Nervous system brake',
    timing: 'Evening',
    dose: '250-500mg',
    moods: ['restless'],
    science: "GABA is your brain's primary inhibitory neurotransmitter — it literally slows down neural activity. When GABA signaling is low, your brain can't stop firing, which is exactly what restlessness feels like. Oral GABA doesn't cross the blood-brain barrier well in standard form, but pharmacological GABA supplements have shown benefits for reducing psychological stress markers and improving sleep onset. Take it 30-60 minutes before you need to wind down.",
    sources: [
      "Abdou et al. (2006). Relaxation and immunity enhancement effects of GABA administration. Biofactors.",
      "Byun et al. (2014). GABA administration and its effects on sleep quality. J Psychiatr Res.",
    ],
  },
  {
    name: 'Magnesium L-Threonate',
    benefit: 'Brain calming',
    timing: 'Night',
    dose: '1-2g',
    moods: ['restless'],
    science: "Magnesium L-Threonate is the only form of magnesium with demonstrated ability to cross the blood-brain barrier and raise brain magnesium levels directly. Developed at MIT, it specifically increases synaptic magnesium, which regulates the NMDA receptors involved in excitatory signaling. When you're wired and can't switch off, this is the tool. It's more expensive than glycinate for good reason.",
    sources: [
      "Slutsky et al. (2010). Enhancement of learning and memory by elevating brain magnesium. Neuron.",
      "Liu et al. (2016). Efficacy and safety of MMFS-01 (Mg-L-threonate) in older adults with cognitive impairment. J Alzheimers Dis.",
    ],
  },
  {
    name: 'Vitamin D3+K2',
    benefit: 'Mood baseline',
    timing: 'Morning',
    dose: '2-5K IU',
    moods: ['low', 'foggy'],
    science: "Vitamin D receptors exist throughout your brain, particularly in areas controlling mood and cognition. Over 40% of Americans are deficient, and the correlation with depression is one of the most replicated findings in nutritional psychiatry. The K2 is there because D3 increases calcium absorption — K2 makes sure it goes to your bones, not your arteries.",
    sources: [
      "Anglin et al. (2013). Vitamin D deficiency and depression in adults: systematic review. Br J Psychiatry.",
      "Shaffer et al. (2014). Vitamin D supplementation for depressive symptoms. Psychosom Med.",
      "Holick (2007). Vitamin D deficiency. N Engl J Med.",
    ],
  },
  {
    name: "Lion's Mane",
    benefit: 'Cognitive support',
    timing: 'Morning',
    dose: '500-1000mg',
    moods: ['foggy'],
    science: "Lion's Mane contains hericenones and erinacines — low-molecular-weight compounds that cross the blood-brain barrier and directly stimulate Nerve Growth Factor (NGF) synthesis in astrocytes. Elevated NGF accelerates hippocampal neurogenesis, supports myelin repair, and improves synaptic plasticity. This is one of the few OTC compounds with a double-blind RCT showing measurable cognitive improvement — and it works on the stress-depression axis too, not just memory.",
    sources: [
      "Mori et al. (2009). Improving effects of Hericium erinaceus on mild cognitive impairment: a double-blind placebo-controlled trial. Phytotherapy Research, 23(3), 367–372.",
      "Nagano et al. (2010). Reduction of depression and anxiety by intake of Hericium erinaceus. Biomed Res.",
      "Lai et al. (2013). Neurotrophic properties of the Lion's Mane medicinal mushroom. Evid Based Complement Alternat Med.",
    ],
  },
  {
    name: 'Phosphatidylserine',
    benefit: 'Memory & clarity',
    timing: 'With breakfast',
    dose: '100-300mg',
    moods: ['foggy', 'stressed'],
    science: "Phosphatidylserine is a structural phospholipid that makes up the architecture of your brain cell membranes. It optimizes membrane permeability, coordinates cell signaling proteins, and directly enhances acetylcholine release. The other angle: it actively suppresses HPA axis overactivation, meaning it measurably lowers cortisol spikes under acute stress. FDA has granted it one of only two qualified health claims for cognitive function in a dietary supplement.",
    sources: [
      "Glade & Smith (2015). Phosphatidylserine and the human brain. Nutrition, 31(6), 781–786.",
      "Kidd (1996). Phosphatidylserine; membrane nutrient for memory. Altern Med Rev.",
      "Benton et al. (2001). The influence of phosphatidylserine supplementation on mood and heart rate. Nutritional Neuroscience.",
    ],
  },
  {
    name: 'Rhodiola',
    benefit: 'Anti-fatigue',
    timing: 'Morning',
    dose: '200-400mg',
    moods: ['stressed', 'foggy'],
    science: "Rhodiola is an adaptogen that specifically targets mental fatigue. A placebo-controlled trial by Olsson et al. (2009) found meaningful reductions in burnout and improved attention after just 14 days of use. It works on the HPA axis — the same stress pathway that ashwagandha hits, but through a different mechanism. They stack well together without overlap.",
    sources: [
      "Olsson et al. (2009). A randomised, double-blind, placebo-controlled study of Rhodiola rosea. Planta Med.",
      "Darbinyan et al. (2000). Rhodiola rosea in stress-induced fatigue. Phytomedicine.",
      "Panossian et al. (2010). Adaptogens: tonic herbs for fatigue and stress. Altern Ther Health Med.",
    ],
  },
  {
    name: 'B-Complex',
    benefit: 'NT synthesis',
    timing: 'Morning',
    dose: '1 cap',
    moods: ['low', 'foggy', 'stressed'],
    science: "B vitamins are direct cofactors in neurotransmitter synthesis — your brain literally cannot produce serotonin, dopamine, or norepinephrine without B6, B9, and B12. Stress burns through B vitamins faster than normal. A deficiency doesn't feel like 'vitamin deficiency' — it feels like depression, brain fog, and fatigue. Which is why most people never connect the dots.",
    sources: [
      "Kennedy (2016). B Vitamins and the Brain: Mechanisms, Dose and Efficacy. Nutrients.",
      "Young (1993). Serotonin and 5-HTP: neuromodulation. J Psychiatry Neurosci.",
      "Coppen & Bolander-Gouaille (2005). Treatment of depression: time to consider folic acid and B12. J Psychopharmacol.",
    ],
  },
  {
    name: 'Creatine Monohydrate',
    benefit: 'Brain energy & performance',
    timing: 'Morning',
    dose: '3-5g',
    moods: ['good'],
    science: "Creatine isn't just for gym bros. Your brain uses phosphocreatine as a rapid energy reserve — studies show creatine supplementation improves working memory and processing speed, particularly under sleep deprivation or mental load. On a good day, you're already operating well; creatine helps you run more of them without degrading. One of the most studied, cheapest, and safest supplements available. The monohydrate form is identical in efficacy to fancier versions at a fraction of the cost.",
    sources: [
      "Rae et al. (2003). Oral creatine monohydrate supplementation improves brain performance. Proc Biol Sci.",
      "McMorris et al. (2007). Creatine supplementation and cognitive performance. Neuropsychol Dev Cogn B Aging Neuropsychol Cogn.",
      "Avgerinos et al. (2018). Effects of creatine supplementation on cognitive function of healthy individuals. Exp Gerontol.",
    ],
  },
  {
    name: 'NAC',
    benefit: 'Glutathione boost',
    timing: 'With food',
    dose: '600-1200mg',
    moods: ['good'],
    science: "N-Acetyl Cysteine is a precursor to glutathione — your body's master antioxidant. It also modulates glutamate transmission, reducing compulsive and obsessive cognitive patterns. On good days, NAC functions as a maintenance tool: clearing oxidative stress, supporting liver detox pathways, and keeping neuroinflammation low so your baseline stays elevated. Think of it as preserving the conditions that made today a good day.",
    sources: [
      "Berk et al. (2008). N-acetyl cysteine as a glutathione precursor for schizophrenia. Biol Psychiatry.",
      "Deepmala et al. (2015). Clinical trials of N-Acetylcysteine in psychiatry. Neurosci Biobehav Rev.",
    ],
  },
  {
    name: 'Zinc',
    benefit: 'NT regulation',
    timing: 'With food',
    dose: '15-30mg',
    moods: ['good'],
    science: "Zinc is involved in the synthesis and regulation of over 300 enzymatic processes, including those governing dopamine, serotonin, and GABA activity. Subclinical zinc deficiency is surprisingly common and often presents not as illness but as emotional blunting, reduced motivation, and poor stress resilience. When you're feeling good, zinc helps maintain the neurotransmitter balance that's producing that state. Take with food — on an empty stomach it causes nausea.",
    sources: [
      "Cope & Levenson (2010). Role of zinc in the development and treatment of mood disorders. Curr Opin Clin Nutr Metab Care.",
      "Nowak et al. (2003). Zinc and depression. Pharmacol Rep.",
    ],
  },
  {
    name: 'Tyrosine',
    benefit: 'Dopamine precursor',
    timing: 'Morning (empty stomach)',
    dose: '500-2000mg',
    moods: ['foggy', 'low'],
    science: "L-Tyrosine is the direct precursor to L-DOPA, which the brain converts into dopamine and norepinephrine. Under intense cognitive demand, sleep deprivation, or acute stress, the brain burns through its catecholamine reserves faster than diet can replenish them. Tyrosine acts as a metabolic safety net — restoring the raw material supply so executive function, processing speed, and working memory stay intact when you need them most. The effect is strongest when you're actually depleted.",
    sources: [
      "Jongkees et al. (2015). Effect of tyrosine supplementation on clinical and healthy populations under stress or cognitive demands. J Psychiatric Research, 70, 50–57.",
      "Neri et al. (1995). The effects of tyrosine on cognitive performance during extended wakefulness. Aviat Space Environ Med.",
      "Deijen & Orlebeke (1994). Effect of tyrosine on cognitive function and blood pressure. Brain Res Bull.",
    ],
  },
  {
    name: 'Alpha-GPC',
    benefit: 'Choline & focus',
    timing: 'Morning',
    dose: '300-600mg',
    moods: ['foggy', 'good'],
    science: "Alpha-GPC is the most bioavailable choline donor — once it crosses the blood-brain barrier, it's immediately used to synthesize acetylcholine, the primary neurotransmitter for focal attention, working memory, and synaptic signaling. Simultaneously, it donates glycerophosphate to repair and stabilize the lipid structure of neuronal membranes. Most people are chronically under-supplying choline from diet. This fills that gap directly at the brain level.",
    sources: [
      "De Jesus Moreno Moreno (2003). Cognitive improvement in mild-to-moderate Alzheimer's dementia after treatment with choline alfoscerate. Clinical Therapeutics, 25(1), 178–193.",
      "Parnetti et al. (2007). Cholinergic precursors in the treatment of cognitive impairment. Mech Ageing Dev.",
      "Bellar et al. (2015). The effect of alpha-GPC on isometric strength. J Int Soc Sports Nutr.",
    ],
  },
  {
    name: 'Bacopa Monnieri',
    benefit: 'Memory & calm',
    timing: 'With food',
    dose: '300-600mg',
    moods: ['foggy', 'stressed'],
    science: "Bacopa is an Ayurvedic herb with one of the strongest human evidence bases for memory improvement. It increases dendrite branching — literally building more connections between your neurons. Multiple double-blind RCTs show improvements in delayed recall, processing speed, and attention. It also reduces cortisol and anxiety via the HPA axis. The catch: it takes 8-12 weeks to fully work. Not instant, but the evidence is real.",
    sources: [
      "Roodenrys et al. (2002). Chronic effects of Brahmi on human memory. Neuropsychopharmacology.",
      "Calabrese et al. (2008). Effects of a standardized Bacopa monnieri extract on cognitive performance. J Altern Complement Med.",
      "Stough et al. (2001). The chronic effects of an extract of Bacopa monniera on cognitive function in healthy human subjects. Psychopharmacology.",
    ],
  },
  {
    name: "St. John's Wort",
    benefit: 'Mild-moderate depression',
    timing: 'With food',
    dose: '300mg (0.3% hypericin)',
    moods: ['low'],
    science: "St. John's Wort is one of the most studied herbal antidepressants in the world. A 2008 Cochrane review of 29 trials concluded it was more effective than placebo and comparably effective to standard antidepressants for mild-to-moderate depression — with fewer side effects. The active mechanism likely involves multiple pathways including serotonin, dopamine, and norepinephrine reuptake inhibition. Critical warning: it significantly interacts with many medications, including birth control and blood thinners.",
    sources: [
      "Linde et al. (2008). St John's wort for major depression. Cochrane Database Syst Rev.",
      "Kasper et al. (2006). Superior efficacy of St John's wort extract in major depression. Pharmacopsychiatry.",
    ],
  },
  {
    name: 'Saffron',
    benefit: 'Mood elevation',
    timing: 'With food',
    dose: '30mg',
    moods: ['low', 'stressed'],
    science: "Saffron — yes, the spice — has emerged as one of the most interesting natural antidepressants in recent research. Meta-analyses of 12+ RCTs show it significantly outperforms placebo for depression and anxiety, with effect sizes comparable to SSRIs in some trials. Its active compounds (crocin, safranal) appear to inhibit serotonin reuptake and modulate GABA and glutamate. The effective dose is tiny — 30mg/day of standardized extract. At therapeutic doses it's safe; at high doses it can be toxic.",
    sources: [
      "Hausenblas et al. (2013). Saffron and depression: a systematic review. J Integr Med.",
      "Akhondzadeh et al. (2005). Comparison of saffron to imipramine for mild-to-moderate depression. BMC Complement Altern Med.",
      "Lopresti & Drummond (2014). Saffron for major depressive disorder. J Affect Disord.",
    ],
  },
  {
    name: 'Lemon Balm',
    benefit: 'Calming & sleep',
    timing: 'Evening',
    dose: '300-600mg',
    moods: ['anxious', 'restless'],
    science: "Lemon balm (Melissa officinalis) works primarily by inhibiting GABA transaminase — the enzyme that breaks down GABA — effectively increasing GABA levels in the brain. It also has direct binding activity at GABA-A receptors. RCTs show significant reductions in anxiety, stress, and sleep latency. It's mild enough to use situationally and doesn't cause the next-day grogginess of heavier sleep aids. Stacks well with L-Theanine for an additive calming effect.",
    sources: [
      "Kennedy et al. (2004). Attenuation of laboratory-induced stress in humans after administration of Melissa officinalis. Psychosom Med.",
      "Cases et al. (2011). Pilot trial of Melissa officinalis for insomnia and quality of life. Mediterr J Nutr Metab.",
    ],
  },
  {
    name: 'CoQ10',
    benefit: 'Cellular energy',
    timing: 'With food',
    dose: '100-300mg',
    moods: ['good'],
    science: "Coenzyme Q10 is central to mitochondrial ATP production — it's literally in the electron transport chain. Brain tissue has extremely high energy demands, and CoQ10 levels decline with age and under oxidative stress. Supplementation improves mitochondrial efficiency and has shown benefits for fatigue, mental clarity, and exercise performance. The ubiquinol form is more bioavailable than ubiquinone, especially in people over 40. On a good day, CoQ10 is about keeping your energy systems efficient so more of them stay good.",
    sources: [
      "Littarru & Tiano (2007). Clinical aspects of coenzyme Q10. Mol Biotechnol.",
      "Sanoobar et al. (2016). Coenzyme Q10 as a treatment for fatigue and depression in multiple sclerosis. Neurol Sci.",
      "Garrido-Maraver et al. (2014). Clinical applications of coenzyme Q10. Front Biosci (Landmark Ed).",
    ],
  },
];

export function getSupplementsForMood(mood: MoodKey): Supplement[] {
  return SUPPLEMENTS.filter((s) => s.moods.includes(mood));
}
