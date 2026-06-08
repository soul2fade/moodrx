import React from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { MoodRxWidget } from '@/components/widgets/MoodRxWidget';
import type { WidgetSnapshot } from './widget';

const WIDGET_NAME = 'MoodRxWidget';

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
// react-native-android-widget is safe to import on iOS/web (its native module
// resolves to a no-op there), and the guard means requestWidgetUpdate only
// ever runs on Android. The iOS ExtensionStorage path (PR 2) will slot in
// behind a `Platform.OS === 'ios'` branch here.
export async function writeWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  if (Platform.OS !== 'android') return;
  await requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: (info) => <MoodRxWidget snapshot={snapshot} width={info.width} />,
    widgetNotFound: () => {
      // No widget on the home screen — nothing to update.
    },
  });
}
