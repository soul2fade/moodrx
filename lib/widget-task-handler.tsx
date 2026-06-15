import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { getSessions } from '@/lib/storage';
import { buildWidgetSnapshot } from '@/lib/widget';
import { MoodRxWidget } from '@/components/widgets/MoodRxWidget';

const WIDGET_NAME = 'MoodRxWidget';

// Headless handler for Android widget lifecycle events. Runs outside the React
// tree, so it re-derives the snapshot directly from AsyncStorage rather than
// from app state. OPEN_APP clicks are handled natively — no JS work needed.
export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  if (props.widgetInfo.widgetName !== WIDGET_NAME) return;

  // Headless background task — runs outside the React tree (no ErrorBoundary).
  // An unguarded throw here would surface as an Android background crash / ANR,
  // so degrade to "widget doesn't update" instead.
  try {
    switch (props.widgetAction) {
      case 'WIDGET_ADDED':
      case 'WIDGET_UPDATE':
      case 'WIDGET_RESIZED': {
        const sessions = await getSessions();
        const snapshot = buildWidgetSnapshot(sessions);
        props.renderWidget(<MoodRxWidget snapshot={snapshot} width={props.widgetInfo.width} />);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.warn('[MoodRx] widgetTaskHandler failed:', e);
  }
}
