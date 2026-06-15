import type { HealthSnapshot } from './health';
import type { SessionHealthFields } from './storage';

/** Map a Health snapshot to the optional Session health fields, including only
 *  genuinely-present finite readings. null/unavailable/NaN → omitted, so a
 *  session logged without health simply lacks the fields (back-compat clean).
 *
 *  Both imports are type-only, so this module has NO runtime dependencies — it
 *  never loads lib/health (react-native) or lib/storage, which keeps it unit-
 *  testable under Node. */
export function healthFieldsFromSnapshot(snapshot: HealthSnapshot): SessionHealthFields {
  const fields: SessionHealthFields = {};
  if (typeof snapshot.stepsToday === 'number' && Number.isFinite(snapshot.stepsToday)) {
    fields.stepsToday = snapshot.stepsToday;
  }
  if (
    typeof snapshot.sleepHoursLastNight === 'number' &&
    Number.isFinite(snapshot.sleepHoursLastNight)
  ) {
    fields.sleepHoursLastNight = snapshot.sleepHoursLastNight;
  }
  return fields;
}
