import 'expo-router/entry';
import { Platform } from 'react-native';

// Register the Android widget task handler. Lazily required behind a platform
// check so the Android-only native module is never loaded on iOS or web.
if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./lib/widget-task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
