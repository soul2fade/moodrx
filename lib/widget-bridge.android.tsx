import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { MoodRxWidget } from '@/components/widgets/MoodRxWidget';
import type { WidgetSnapshot } from './widget';

const WIDGET_NAME = 'MoodRxWidget';

// Android selects this file over widget-bridge.ts via Metro's platform
// extension resolution. Re-renders every on-screen MoodRxWidget instance
// with the latest snapshot; widgetInfo.width drives the small/medium layout.
export async function writeWidgetSnapshot(snapshot: WidgetSnapshot): Promise<void> {
  await requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: (info) => <MoodRxWidget snapshot={snapshot} width={info.width} />,
    widgetNotFound: () => {
      // No widget on the home screen — nothing to update.
    },
  });
}
