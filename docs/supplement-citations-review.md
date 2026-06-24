# Supplement Science — Citation Audit & Copy Review

**Purpose:** Same rigor as the workout audit, applied to all 31 supplement `science` blurbs + their existing `sources[]` in [lib/supplements.ts](../lib/supplements.ts). Goal: bulletproof against Apple 1.4.1 before resubmission.

**Method:** 6 parallel agents, each verifying every existing citation against the real paper (Crossref/PubMed) and flagging overstated/unsafe claims. Proposed copy is in the app's voice.

> **STATUS: IMPLEMENTED** ✅ — All copy softened, all citations corrected, a `safety` field added to the `Supplement` type and populated for every entry, and SAFETY blocks rendered on the priority card, both catalog detail panels, and the prescription supplement modal. Every corrected/added citation passed a final Crossref verification pass (refinements applied: **McMorris is 2006** not 2007; the CoQ10 Sanoobar citation is the *fatigue-and-depression* paper, *Nutritional Neuroscience* 19(3):138–143). Typecheck, 204 tests, and lint all pass.

## Headline
- ✅ **No fabricated studies.** Every cited paper is real.
- ❌ **Pervasive citation errors** — wrong year/journal/title on ~15 entries (detailed below). These are exactly what a careful reviewer (or savvy user) catches.
- ❌ **Several high-liability claims** — prescription-drug comparisons, "as effective as medication," and disease-population studies implying healthy-user benefit.
- 🚑 **One critical safety gap: Kava has no liver-toxicity warning.** Highest priority.

---

## TIER 1 — Critical (fix before any resubmission)

### 🚑 Kava Kava — MISSING hepatotoxicity warning
Kava is linked to rare but serious **liver injury/failure**; FDA consumer advisory (2002); restricted/banned in several countries. Current copy has **no liver warning** and claims it works "without the sedation or dependence risk of benzodiazepines" + "within an hour" (unsupported).
- **Drop:** benzodiazepine comparison; "works acutely — within an hour."
- **Soften:** "Multiple RCTs confirm significant reductions" → Cochrane calls the effect *small*.
- **Citation fix:** Pittler & Ernst → *Cochrane Database Syst Rev,* CD003383 (not J Clin Psychopharmacol).
- **ADD safety block:** "⚠️ Kava has been linked to rare but serious liver injury, including liver failure, and is restricted in several countries. Don't use it if you have liver problems, drink heavily, or take medications processed by the liver. Stop and see a doctor if you notice yellowing skin/eyes, dark urine, or persistent fatigue. Talk to a clinician first."

### Magnesium Glycinate — benzodiazepine comparison (this is on the screen Apple already saw)
- **Drop:** "the same system benzodiazepines target, minus the prescription and the zombie eyes."
- **Citation fix:** "Costello & Moser (2019), Open Heart" is wrong → the 48% figure is **Rosanoff, Weaver & Rude (2012), Nutrition Reviews, 70(3), 153–164.**
- **Proposed copy:** "Magnesium helps run your GABA system — the brain's main 'calm down' signal. And most people run low: NHANES data shows roughly 48% of Americans don't hit the estimated average requirement. The glycinate form absorbs far better than cheap magnesium oxide, which mostly just sends you to the bathroom."

### 5-HTP — serotonin-syndrome warning too weak + efficacy overstated
- **Strengthen safety:** current "Don't combine with SSRIs… without medical supervision" understates a potentially fatal risk. → "Serious interaction risk. Do NOT combine with SSRIs, SNRIs, MAOIs, triptans, tramadol, or other serotonergic drugs — risk of serotonin syndrome, which can be life-threatening. Clear it with your doctor first."
- **Soften:** "Multiple randomized trials show significant improvement" → the best evidence (Cochrane, Shaw 2002) is explicitly *inconclusive on quality grounds*.

### St. John's Wort — interaction list incomplete
- **Broaden warning** beyond "birth control and blood thinners": it's a potent CYP3A4/P-gp inducer → also HIV antiretrovirals, transplant anti-rejection drugs, some chemo, heart/seizure meds; serotonin syndrome with antidepressants.
- **Citation fix:** Kasper 2006 → *BMC Medicine* 4:14 (not Pharmacopsychiatry); attribute "comparable to antidepressants" to **Linde 2008** (which does support it), not Kasper.

### SAMe — unsupported drug comparison + missing warning
- **Soften:** "comparable to tricyclics" + "head-to-head trial data against pharmaceutical antidepressants" — the cited Papakostas 2010 is an *SSRI-augmentation* trial, not head-to-head. Not supported by the listed sources.
- **ADD safety (currently none):** "Talk to your doctor before combining with antidepressants (serotonin-syndrome risk); can trigger mania/agitation in bipolar disorder."

### Passionflower — prescription-drug equivalence claim
- **Drop/soften:** "An RCT comparing passionflower to oxazepam… found equivalent effectiveness" — small pilot (n=36); absence of significant difference ≠ proven equivalence, and it's a controlled-drug comparison.
- **Citation fix:** remove Firth (doesn't cover passionflower).

### Inositol — "more effective than an SSRI"
- **Drop superiority framing:** Palatnik 2001 found inositol and fluvoxamine *broadly similar*; the "more effective" rests on one month-1 submeasure (n=20). Add high-dose clinician caution.

### Probiotics — human-anxiety claim from a mouse study
- **Soften:** the "L. rhamnosus JB-1 → vagus nerve → measurably reduce anxiety" claim is **Bravo 2011 (mouse)**; the human replication (**Kelly 2017**) *failed*. Drop JB-1 as a "look for this strain"; keep L. helveticus R0052 (has human data).
- **Add caveat:** "~90% of serotonin made in the gut" is true but gut serotonin doesn't cross into the brain — don't imply a direct brain-serotonin benefit.
- **Citation fixes:** Wallace & Milev → **2017** (not 2021); it's a systematic review, not meta-analysis, so soften "meta-analyses confirm."

---

## TIER 2 — Disease-population studies implying healthy-user benefit (1.4.1 risk)

- **Alpha-GPC** — all cognition evidence is Alzheimer's/vascular dementia; the one healthy-subject cite (Bellar) is a *strength* study. Add "studied mainly in dementia; everyday benefit for healthy people isn't well established." Citation fix: Parnetti → *J Neurol Sci*.
- **CoQ10** — fatigue/mood data is in MS patients. Add hedge. Citation fixes: Littarru & Tiano conflated (pick 2007 *Mol Biotechnol* OR 2010 *Nutrition*); Sanoobar → *Nutritional Neuroscience*. Safety: reduces warfarin effect.
- **Lion's Mane** — cognitive RCT (Mori) is in MCI patients; NGF/neurogenesis claims are in-vitro/rodent. Hedge to "early evidence." Citation fix: Lai → *Int J Medicinal Mushrooms*.

---

## TIER 3 — Overstatements & citation fixes (per supplement)

| Supplement | Claim fix | Citation fix |
|---|---|---|
| Rhodiola | "after just **14 days**" → **28 days** (Olsson ran 4 weeks); "stack well without overlap" unsupported → soften | Panossian conflated → **Panossian & Wikman (2010), Pharmaceuticals, 3(1), 188–224** |
| Ashwagandha | "27-**30%**" → single trial, **27.9%**; drop plural "trials" for the % | Pratte (2014) isn't KSM-66-specific — drop the "KSM-66" label |
| Saffron | "**12+** RCTs" → **5** (Hausenblas); soften "comparable to SSRIs" | Akhondzadeh imipramine = **2004** (not 2005); Lopresti → **Human Psychopharmacology** (not J Affect Disord) |
| Omega-3 | "literally can't move the happy chemical" → soften | Su 2008 is a *pregnancy* study in *J Clin Psychiatry* (not sertraline/Biol Psychiatry; that's Carney 2009 JAMA — and **negative**). Fix or drop augmentation framing |
| L-Methylfolate | "**only** form that crosses the BBB" overstated; hedge "40% MTHFR" | Firth → 2019 (see global) |
| Lemon Balm | "RCTs show…" → Cases is *open-label*; "increases GABA in the brain" → "in lab studies" | both OK as-is |
| GABA | "have shown benefits" → "may help" (small/industry studies) | Byun → **2018, J Clin Neurol** (not 2014/J Psychiatr Res) |
| Mag L-Threonate | "demonstrated" BBB → largely *animal* data; "when you're wired" — cites are *cognition* studies | both OK |
| Chamomile | soften apigenin "not theoretical / same site as clinical anxiolytics" (weak affinity, debated) | **ADD missing Mao et al. (2016), Phytomedicine, 23(14), 1735–1742** — it's the source for the 26-week claim |
| Valerian | "meta-analysis **confirmed**" → Bent 2006 found evidence **mixed/inconsistent**; soften mechanism + "2–4 weeks" | OK |
| Phosphatidylserine | FDA "qualified health claim" → disclose *qualified* = FDA says evidence is preliminary | all 3 OK |
| Bacopa | "increases dendrite branching… your neurons" = *animal* data → hedge; cortisol claim weak | all 3 OK |
| B-Complex | optional: "feels like depression" → "low mood, brain fog, fatigue" | **Young (1993)** title is invented → "The use of diet and dietary components in the study of factors controlling affect in humans: a review. J Psychiatry Neurosci, 18(5), 235–244." |
| Vitamin D3+K2 | "one of the most replicated findings" overstated (Shaffer found *no overall* supplementation effect) → soften to "linked" | all 3 OK (K2 + 40% stat true but technically uncited) |
| NAC | soften "liver detox" + "keeps baseline elevated" | both OK (Berk subtitle truncated) |
| Zinc | "300 enzymatic processes" → "enzymes"; soften "governing" → "involved in" | **Nowak (2003)** → journal is **Pol J Pharmacol** (renamed to Pharmacol Rep only in 2005); title mismatch |
| Creatine | effect concentrated in low-baseline (vegetarian/sleep-deprived) — soften "good day" framing | **McMorris (2007)** title+journal mismatch (worst offender) → fix to the real *Physiology & Behavior* sleep-dep paper |
| Tyrosine | light touch — best supported in batch | all 3 OK (minor title truncations) |
| Saffron/others | — | — |

---

## GLOBAL FIX — the "Firth 2020" citation is wrong everywhere
Appears on **~9 entries** (L-Methylfolate, SAMe, Kava, Passionflower, Chamomile, Inositol, Melatonin, Valerian, Probiotics). Correct it to:
> **Firth et al. (2019). The efficacy and safety of nutrient supplements in the treatment of mental disorders: a meta-review of meta-analyses of randomized controlled trials. World Psychiatry, 18(3), 308–324.**

AND **remove it from the botanical entries** (Kava, Chamomile, Valerian, Passionflower) — that meta-review covers *nutrients*, not botanicals, so it doesn't support those claims.

---

## Cross-cutting recommendation
Add a short standing line near the supplement section: *"Educational only — not medical advice. Supplements aren't evaluated to treat or cure any condition. Talk to a clinician before starting one, especially if you take other medications."* This materially strengthens the 1.4.1 posture across the board.

## Before implementing
Every **corrected/added** citation (Rosanoff 2012, Byun 2018, Mao 2016, Panossian & Wikman 2010, Carney/Su, Kasper→BMC Medicine, Akhondzadeh 2004, Lopresti→Hum Psychopharmacol, Nowak→Pol J Pharmacol, McMorris→Phys Behav, Firth 2019) gets a final Crossref verification pass — same standard as the workouts — before it lands.

## Lowest-risk (minimal/no change)
Melatonin (soften "0.5mg = 5mg" absolute), Tyrosine, Creatine (citation fix only), L-Theanine (minor hedge).
