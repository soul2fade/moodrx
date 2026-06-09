// Strips Android permissions that `expo-audio` declares in its library manifest
// but MoodRx never uses. The app only PLAYS audio (soundscapes, coach voice) —
// it never records, and it does not play in the background.
//
//   RECORD_AUDIO                       → no recording feature (microphone)
//   FOREGROUND_SERVICE                 → no background/foreground audio service
//   FOREGROUND_SERVICE_MEDIA_PLAYBACK  → no background media playback
//
// Leaving these in would force a Play "Foreground service permissions"
// declaration and surface an unused microphone permission (a rejection / trust
// risk for a mental-health app). MODIFY_AUDIO_SETTINGS is kept (used by playback).
//
// Implemented via `tools:node="remove"` so the Android manifest merger drops the
// library-declared permissions from the final merged manifest.

const { withAndroidManifest } = require('@expo/config-plugins');

const PERMISSIONS_TO_REMOVE = [
  'android.permission.RECORD_AUDIO',
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
];

module.exports = function withStripUnusedAudioPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;

    manifest.$ = manifest.$ || {};
    manifest.$['xmlns:tools'] =
      manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';

    manifest['uses-permission'] = manifest['uses-permission'] || [];

    for (const name of PERMISSIONS_TO_REMOVE) {
      // Drop any plain add of this permission...
      manifest['uses-permission'] = manifest['uses-permission'].filter(
        (p) => p?.$?.['android:name'] !== name,
      );
      // ...and add an explicit removal so the merger strips the library's copy.
      manifest['uses-permission'].push({
        $: { 'android:name': name, 'tools:node': 'remove' },
      });
    }

    return cfg;
  });
};
