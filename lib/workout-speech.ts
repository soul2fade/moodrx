import * as Speech from 'expo-speech';

export function stopWorkoutSpeech(): void {
  try {
    Speech.stop();
  } catch {
    // non-critical
  }
}

export function speakWorkoutLine(text: string, rate = 0.92): void {
  const line = text.trim();
  if (!line) return;
  try {
    Speech.stop();
    Speech.speak(line, {
      language: 'en-US',
      rate,
      pitch: 1,
    });
  } catch {
    // expo-speech unavailable on this platform
  }
}

export function buildStepSpeech(stepIndex: number, totalSteps: number, stepText: string): string {
  return `Step ${stepIndex + 1} of ${totalSteps}. ${stepText}`;
}

export function buildRestSpeech(secondsLeft: number): string | null {
  if (secondsLeft <= 0) return 'Rest complete. Get ready.';
  if (secondsLeft === 30 || secondsLeft === 10 || secondsLeft <= 5) {
    return `${secondsLeft} seconds left. Breathe.`;
  }
  return null;
}

export function buildActiveSpeech(secondsLeft: number): string | null {
  if (secondsLeft <= 0) return 'Time. Hit next.';
  if (secondsLeft === 10 || secondsLeft <= 3) {
    return `${secondsLeft}`;
  }
  return null;
}
