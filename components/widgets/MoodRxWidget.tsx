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
  const hasStreak = snapshot.streak > 0;
  // A broken streak (0) reads as a deflating accent-colored zero — mute it and
  // reframe the label as an invitation rather than a failure.
  const streakColor: ColorProp = hasStreak ? accent : (MUTED as ColorProp);
  const doneTodayStyle: TextWidgetStyle = { ...doneTodayStyleBase, color: accent };
  // Whether the bottom "today's Rx" block is shown (medium, not yet checked in).
  const showTodayBlock = !snapshot.checkedInToday && snapshot.today != null && isMedium;

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
        // Fill the widget height: streak hero at the top, today's Rx anchored to
        // the bottom on the medium size (space-between); centered otherwise.
        <FlexWidget
          style={{
            width: 'match_parent',
            height: 'match_parent',
            flexDirection: 'column',
            justifyContent: showTodayBlock ? 'space-between' : 'center',
          }}
        >
          <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
            <TextWidget
              text={String(snapshot.streak)}
              style={{ fontSize: 44, fontWeight: 'bold', color: streakColor }}
              maxLines={1}
            />
            <TextWidget
              text={hasStreak ? 'DAY STREAK' : 'START A NEW STREAK'}
              style={streakLabelStyle}
              maxLines={1}
              truncate="END"
            />

            {snapshot.checkedInToday && (
              <TextWidget text="✓ DONE TODAY" style={doneTodayStyle} />
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

          {!snapshot.checkedInToday && snapshot.today && isMedium && (
            <FlexWidget style={{ flexDirection: 'column', width: 'match_parent', marginTop: 12 }}>
              <TextWidget text="TODAY" style={todayLabelStyle} />
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
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
