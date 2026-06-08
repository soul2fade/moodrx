import type { WidgetSnapshot } from './widget';

// Default bridge for web and iOS (until the iOS bridge lands in PR 2).
// The Android implementation lives in widget-bridge.android.tsx and is
// selected automatically by Metro's platform-extension resolution.
export async function writeWidgetSnapshot(_snapshot: WidgetSnapshot): Promise<void> {
  // no-op
}
