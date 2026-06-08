'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { ColorProp } from 'react-native-android-widget/lib/typescript/widgets/utils/style.props';
import type { TextWidgetStyle } from 'react-native-android-widget';
import type { WidgetSnapshot } from '@/lib/widget';

const BG = '#0a0a0a';
const FG = '#ffffff';
const MUTED = '#888888';
const ACCENT_DEFAULT = '#ffffff';

// Android delivers the current pixel width in widgetInfo; anything at/above
// this is treated as the "medium" layout that also shows today's Rx.
const MEDIUM_MIN_WIDTH = 200;

// TextWidgetStyle has no lineHeight prop — disable the project lint rule that
// requires lineHeight for fontSize <= 12, since we cannot satisfy it here.
// eslint-disable-next-line local/no-small-fontsize-without-lineheight
const streakLabelStyle: TextWidgetStyle = { fontSize: 12, fontWeight: 'bold', letterSpacing: 2, color: MUTED, marginTop: 2 };
// eslint-disable-next-line local/no-small-fontsize-without-lineheight
const doneTodayStyleBase: TextWidgetStyle = { fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginTop: 10 };
// eslint-disable-next-line local/no-small-fontsize-without-lineheight
const todayLabelStyle: TextWidgetStyle = { fontSize: 12, fontWeight: 'bold', letterSpacing: 2, color: MUTED };
// eslint-disable-next-line local/no-small-fontsize-without-lineheight
const todaySmallStyle: TextWidgetStyle = { fontSize: 12, fontWeight: 'bold', letterSpacing: 1, color: MUTED, marginTop: 10 };

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
