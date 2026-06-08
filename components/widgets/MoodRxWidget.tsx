'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { ColorProp, TextWidgetStyle } from 'react-native-android-widget';
import type { WidgetSnapshot } from '@/lib/widget';

const BG = '#0a0a0a';
const FG = '#ffffff';
const MUTED = '#888888';
const ACCENT_DEFAULT = '#ffffff';

// Android delivers the current pixel width in widgetInfo; anything at/above
// this is treated as the "medium" layout that also shows today's Rx.
const MEDIUM_MIN_WIDTH = 200;

/* eslint-disable local/no-small-fontsize-without-lineheight -- TextWidgetStyle has no lineHeight prop */
const streakLabelStyle: TextWidgetStyle = { fontSize: 12, fontWeight: 'bold', letterSpacing: 2, color: MUTED, marginTop: 2 };
const doneTodayStyleBase: TextWidgetStyle = { fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginTop: 10 };
const todayLabelStyle: TextWidgetStyle = { fontSize: 12, fontWeight: 'bold', letterSpacing: 2, color: MUTED };
const todaySmallStyle: TextWidgetStyle = { fontSize: 12, fontWeight: 'bold', letterSpacing: 1, color: MUTED, marginTop: 10 };
/* eslint-enable local/no-small-fontsize-without-lineheight */

export function MoodRxWidget({
  snapshot,
  width,
}: {
  snapshot: WidgetSnapshot;
  width: number;
}) {
  const accent = (snapshot.today?.moodColor ?? ACCENT_DEFAULT) as ColorProp;
  const isMedium = width >= MEDIUM_MIN_WIDTH;
  const doneTodayStyle: TextWidgetStyle = { ...doneTodayStyleBase, color: accent };

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: BG,
        borderRadius: 20,
        padding: 16,
      }}
      accessibilityLabel="MoodRx streak and today's prescription"
    >
      {!snapshot.hasSessions ? (
        <TextWidget
          text="Log your first mood →"
          style={{ fontSize: 16, fontWeight: 'bold', color: FG }}
          maxLines={2}
        />
      ) : (
        <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
          <TextWidget
            text={String(snapshot.streak)}
            style={{ fontSize: 44, fontWeight: 'bold', color: accent }}
            maxLines={1}
          />
          <TextWidget
            text="DAY STREAK"
            style={streakLabelStyle}
          />

          {snapshot.checkedInToday && (
            <TextWidget
              text="✓ DONE TODAY"
              style={doneTodayStyle}
            />
          )}

          {!snapshot.checkedInToday && snapshot.today && isMedium && (
            <FlexWidget style={{ flexDirection: 'column', width: 'match_parent', marginTop: 12 }}>
              <TextWidget
                text="TODAY"
                style={todayLabelStyle}
              />
              <TextWidget
                text={`${snapshot.today.moodName} · ${snapshot.today.durationMin} MIN`}
                style={{ fontSize: 13, color: FG, marginTop: 2 }}
                maxLines={1}
                truncate="END"
              />
              <TextWidget
                text={snapshot.today.workoutName}
                style={{ fontSize: 14, fontWeight: 'bold', color: accent, marginTop: 2 }}
                maxLines={1}
                truncate="END"
              />
            </FlexWidget>
          )}

          {!snapshot.checkedInToday && snapshot.today && !isMedium && (
            <TextWidget
              text={`TODAY: ${snapshot.today.moodName}`}
              style={todaySmallStyle}
              maxLines={1}
              truncate="END"
            />
          )}
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
