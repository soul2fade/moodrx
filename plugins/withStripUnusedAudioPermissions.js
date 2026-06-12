// Strips Android permissions that `expo-audio` declares in its library manifest
// but MoodRx never uses. The app only PLAYS audio (soundscapes, coach voice) —
// it never records, and it does not play in the background.
//
//   (RECORD_AUDIO is KEPT — voice venting uses on-device STT; see array below)
//   FOREGROUND_SERVICE                 → no background/foreground audio service
//   FOREGROUND_SERVICE_MEDIA_PLAYBACK  → no background media playback
//
// Also strips an advertising-identifier permission that a transitive Play
// Services dependency (via expo-notifications / FCM) can merge into the final
// manifest even though MoodRx uses NO ads, analytics, or attribution SDK:
//
//   com.google.android.gms.permission.AD_ID → no advertising ID usage
//
// This keeps the merged manifest consistent with the Play "Advertising ID"
// declaration (answered "No") and avoids release-time AD_ID warnings.
//
// Leaving the audio permissions in would force a Play "Foreground service
// permissions" declaration and surface an unused microphone permission (a
// rejection / trust risk for a mental-health app). MODIFY_AUDIO_SETTINGS is
// kept (used by playback).
//
// Implemented via `tools:node="remove"` so the Android manifest merger drops the
// library-declared permissions from the final merged manifest. Removing a
// permission that isn't present is a harmless no-op.

const { withAndroidManifest } = require('@expo/config-plugins');

// RECORD_AUDIO is intentionally NOT stripped: voice venting (on-device STT via
// expo-speech-recognition) genuinely uses the microphone. Audio is never stored
// or transmitted — only an on-device transcript leaves the recorder. The other
// permissions remain unused and are still removed. (Play Data Safety must now
// reflect microphone use — handled in the privacy/store-declaration plan.)
const PERMISSIONS_TO_REMOVE = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'com.google.android.gms.permission.AD_ID',
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
