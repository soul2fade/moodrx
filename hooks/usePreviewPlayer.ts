import { useEffect, useState } from 'react';
import { useAudioPlayer } from 'expo-audio';

/** One-shot preview player: `play(uri)` loads the clip and plays it from the
 *  start. Encapsulates the previewSrc state + useAudioPlayer + the
 *  seekTo(0)+play()-on-source-change effect that was copy-pasted across the
 *  voice / severity pickers. Returns the underlying player too, for pause(). */
export function usePreviewPlayer() {
  const [src, setSrc] = useState<{ uri: string } | null>(null);
  const player = useAudioPlayer(src);

  useEffect(() => {
    if (src) { try { player.seekTo(0); player.play(); } catch {} }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- player is a stable expo-audio ref; src change drives playback
  }, [src]);

  return { play: (uri: string) => setSrc({ uri }), player };
}
