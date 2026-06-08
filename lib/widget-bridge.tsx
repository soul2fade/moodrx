import React from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { ExtensionStorage } from '@bacons/apple-targets';
import { MoodRxWidget } from '@/components/widgets/MoodRxWidget';
import type { WidgetSnapshot } from './widget';

const WIDGET_NAME = 'MoodRxWidget';
// Matches app.json ios.entitlements + targets/widget/expo-target.config.js.
const IOS_APP_GROUP = 'group.com.moodrx.app';

// Single bridge for all platforms, selected by an explicit Platform.OS check.
//
// An earlier design split this into widget-bridge.ts (no-op default) +
// widget-bridge.android.tsx and relied on Metro platform-extension
// resolution. On Android that silently resolved to the no-op `.ts` — Metro
// did not prefer the `.android.tsx` variant over the bare `.ts` default
// (a cross-extension platform-resolution quirk) — so the foreground push did
// nothing and the widget only updated via headless add/resize events. An
// explicit Platform.OS check is transparent and resolution-proof.
//
// Both native modules are safe to import on every platform: react-native-android-widget
// resolves to a no-op off Android, and @bacons/apple-targets' ExtensionStorage falls
// back to a no-op stub when its native module is absent. The Platform.OS branches keep
// each native call on its own platform; web hits neither and returns.
export async function writeWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  if (Platform.OS === 'ios') {
    writeWidgetSnapshotIOS(snapshot);
    return;
  }
  if (Platform.OS !== 'android') return;
  await requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: (info) => <MoodRxWidget snapshot={snapshot} width={info.width} />,
    widgetNotFound: () => {
      // No widget on the home screen — nothing to update.
    },
  });
}

// iOS: write flat primitive keys into the shared App Group UserDefaults suite,
// then ask WidgetKit to reload. The SwiftUI TimelineProvider
// (targets/widget/index.swift) reads these with typed accessors — no decoding.
//
// ExtensionStorage.set bridges only number/string/object, with no setBool, so
// booleans are stored as 0/1 Ints; Swift's UserDefaults.bool reads Int 1 as true.
// Every key is written every time (with empty/zero fallbacks when there's no
// "today") so a previous day's values never linger in the suite.
function writeWidgetSnapshotIOS(snapshot: WidgetSnapshot): void {
  const storage = new ExtensionStorage(IOS_APP_GROUP);
  const today = snapshot.today;
  storage.set('streak', snapshot.streak);
  storage.set('checkedInToday', snapshot.checkedInToday ? 1 : 0);
  storage.set('hasSessions', snapshot.hasSessions ? 1 : 0);
  storage.set('moodName', today?.moodName ?? '');
  storage.set('moodColor', today?.moodColor ?? '');
  storage.set('workoutName', today?.workoutName ?? '');
  storage.set('durationMin', today?.durationMin ?? 0);
  ExtensionStorage.reloadWidget(WIDGET_NAME);
}
