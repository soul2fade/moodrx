import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

interface Props {
  source: number;
  accentColor: string;
  size?: number;
}

export function ExerciseVideo({ source, accentColor, size = 200 }: Props) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  useEffect(() => {
    player.play();
    return () => {
      player.pause();
    };
  }, [player]);

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: accentColor, opacity: 0.12 },
        ]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#0a0a0a',
  },
});
