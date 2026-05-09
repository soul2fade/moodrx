export type InsultMood = 'anxious' | 'low' | 'foggy' | 'restless' | 'stressed' | 'good';
export type WorkoutMoment = 'pre' | 'mid' | 'post';

export const INSULTS: Record<InsultMood, Record<WorkoutMoment, string[]>> = {
  anxious: {
    pre: [
      "You're anxious about starting the thing that treats the anxiety. That's a you problem. Start anyway.",
      "Your brain has filed seventeen objections to this workout. All denied. Let's go.",
      "The spiral isn't productive. This is. Pick one.",
    ],
    mid: [
      "Still alive. Your nervous system lied to you again.",
      "You're halfway through. The anxiety didn't kill you. Noted for next time.",
      "Heart rate's up. That's supposed to happen. Calm down about the thing that's supposed to happen.",
    ],
    post: [
      "You were anxious about doing it. You did it. File that away for next time your brain tries that.",
      "Worry: unresolved. Body: better. That's the deal and it's a good one.",
      "Your amygdala had a whole plan for today. You ruined it. Good.",
    ],
  },

  low: {
    pre: [
      "You feel terrible. The workout will also feel terrible. One of those is temporary.",
      "Motivation's not coming. It never arrives first. Move anyway.",
      "You opened the app while feeling like this. That's not nothing. Don't make it nothing.",
    ],
    mid: [
      "Still going. Your brain is confused. Let it be confused.",
      "You don't have to feel it working. It's working.",
      "Halfway. The version of you that didn't start is furious.",
    ],
    post: [
      "You did the hardest version of this workout — the one where you didn't want to.",
      "Doesn't fix everything. Fixes some things. Come back tomorrow for the rest.",
      "Your brain chemistry is marginally less against you now. Take the win.",
    ],
  },

  foggy: {
    pre: [
      "You can't think. Perfect. Thinking is optional for the next 30 minutes.",
      "The fog isn't going anywhere sitting still. Tested. Didn't work. Try this instead.",
      "Your brain is buffering. Your legs work fine. Use those.",
    ],
    mid: [
      "Still foggy? Give it a minute. You've been sedentary longer than a minute.",
      "You don't have to feel sharp. You just have to keep moving. One of those is actually optional.",
      "Blood flow to the brain is up. You probably can't tell yet. That's fine.",
    ],
    post: [
      "Fog's lifting. Not because the universe is kind. Because you moved.",
      "You finished a workout while running on empty. Mildly impressive. Don't tell anyone we said that.",
      "Come back when you're foggy again. Which, statistically, is tomorrow.",
    ],
  },

  restless: {
    pre: [
      "All that energy and you've just been sitting in it. That's one way to live.",
      "You've been pacing, haven't you. Put it somewhere useful.",
      "Restless with nowhere to put it is just suffering. We found somewhere.",
    ],
    mid: [
      "Still got gas? Good. That's what this is for. Stop saving it.",
      "You were going to spend this energy staring at the ceiling anyway. Might as well.",
      "Channel it or waste it. Those are the only two options.",
    ],
    post: [
      "Edge: gone. You: slightly less unlivable. Progress.",
      "The restlessness had to go somewhere. Here works. Remember that next time you're climbing the walls.",
      "You're not cured. But you're not pacing around the apartment anymore either. Net positive.",
    ],
  },

  stressed: {
    pre: [
      "The stress isn't leaving. Your cortisol levels, however, are negotiable.",
      "Whatever's causing it will still be there after. It'll just feel less like a physical emergency.",
      "You're stressed and you came here anyway. That's either discipline or denial. Either works.",
    ],
    mid: [
      "Still stressed? Yes. Less than five minutes ago? Also yes. Keep going.",
      "Your jaw's still clenched. We noticed. Unclench the jaw.",
      "The emails aren't going anywhere. Neither is this workout. Finish this one first.",
    ],
    post: [
      "Cortisol's down. Nothing else changed. That's still something.",
      "The problems are exactly where you left them. Your ability to deal with them is slightly better. You're welcome.",
      "Stress relief through movement. Boring answer. Correct answer.",
    ],
  },

  good: {
    pre: [
      "Feeling good? Rare. Suspicious. Let's not waste it.",
      "You're in the window. The window closes. Move.",
      "Good mood, functional body, no excuses today. You've got nothing. Let's go.",
    ],
    mid: [
      "Still feeling good? We're working on it.",
      "This is you at your best. Try to look less surprised.",
      "Peak functioning human. The bar was low but you cleared it.",
    ],
    post: [
      "Good mood going in, better baseline coming out. Don't thank us.",
      "You worked out on a good day. That's how streaks start. No pressure. Some pressure.",
      "Banked some resilience. Try not to immediately spend it on something stupid.",
    ],
  },
};
