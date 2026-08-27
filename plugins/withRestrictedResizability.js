// Keeps MoodRx portrait-locked on large screens under Android 16 (API 36).
//
// Apps targeting API 36 have their screen-orientation, aspect-ratio, and
// resizability restrictions IGNORED by the framework on any display with a
// smallest width >= 600dp — tablets and unfolded foldables. MoodRx declares
// `"orientation": "portrait"` in app.json, so without this opt-out the app
// would suddenly become freely rotatable and resizable on those devices, and
// the paywall / vent / insights layouts have not been adapted for landscape.
//
// `PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY` restores the pre-API-36
// behavior for the whole app. It is applied at the <application> level so it
// covers every activity, including ones contributed by libraries.
//
// THIS IS DELIBERATELY TEMPORARY. Google removes the opt-out at API 37: apps
// targeting 37+ always have these restrictions ignored on sw>=600dp, with no
// escape hatch. The real fix is adaptive layouts. When those land, delete this
// plugin and its entry in app.json rather than trying to carry it forward.
//
// See: https://developer.android.com/develop/adaptive-apps/guides/app-orientation-aspect-ratio-resizability

const { withAndroidManifest } = require('@expo/config-plugins');

const PROPERTY_NAME = 'android.window.PROPERTY_COMPAT_ALLOW_RESTRICTED_RESIZABILITY';

module.exports = function withRestrictedResizability(config) {
  return withAndroidManifest(config, (cfg) => {
    const application = cfg.modResults.manifest?.application?.[0];

    // Nothing to attach the property to — leave the manifest untouched rather
    // than fabricating an <application> node the rest of the build won't match.
    if (!application) {
      return cfg;
    }

    application.property = application.property || [];

    // Re-running the plugin (prebuild is not always from a clean tree) must not
    // stack duplicate <property> entries — the manifest merger rejects those.
    application.property = application.property.filter(
      (p) => p?.$?.['android:name'] !== PROPERTY_NAME,
    );

    application.property.push({
      $: { 'android:name': PROPERTY_NAME, 'android:value': 'true' },
    });

    return cfg;
  });
};
