import { useEffect, useState } from 'react';
import type { WorkoutMoment } from '@/constants/insults';
import { getVoiceEnabled } from '@/lib/storage';
import { getInsult } from '@/utils/insults';

export function useDrMoodRxLine(mood: string, moment: WorkoutMoment): string {
  const [line, setLine] = useState('');

  useEffect(() => {
    let cancelled = false;
    getVoiceEnabled().then((enabled) => {
      if (cancelled) return;
      setLine(getInsult(mood, moment, { enabled }));
    });
    return () => {
      cancelled = true;
    };
  }, [mood, moment]);

  return line;
}
