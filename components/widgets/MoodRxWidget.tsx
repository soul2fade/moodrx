'use no memo';
import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import type { ColorProp, TextWidgetStyle } from 'react-native-android-widget';
import type { WidgetSnapshot } from '@/lib/widget';

const BG = '#0a0a0a';
const FG = '#ffffff';
const MUTED = '#888888';
const ACCENT_DEFAULT = '#ffffff';

// Android delivers the current pixel size in widgetInfo. At/above these the
// widget has room for richer content (medium → today's full Rx) or larger
// type (large → bigger streak hero).
const MEDIUM_MIN_WIDTH = 200;
const LARGE_MIN_HEIGHT = 200;

/* eslint-disable local/no-small-fontsize-without-lineheight -- TextWidgetStyle has no lineHeight prop */
const streakLabelStyle: TextWidgetStyle = { fontSize: 12, fontWeight: 'bold', letterSpacing: 2, color: MUTED, marginTop: 2 };
const doneTodayStyleBase: TextWidgetStyle = { fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginTop: 10 };
const todayLabelStyle: TextWidgetStyle = { fontSize: 12, fontWeight: 'bold', letterSpacing: 2, color: MUTED };
const todaySmallStyle: TextWidgetStyle = { fontSize: 12, fontWeight: 'bold', letterSpacing: 1, color: MUTED, marginTop: 10 };
/* eslint-enable local/no-small-fontsize-without-lineheight */

// FlexWidget compiles to an Android LinearLayout where `justifyContent`/
// `alignItems` are an unreliable gravity bitmask, but `space-between`/
// `space-around` inject real `flex:1` spacer children (layout_weight) — the
// dependable way to fill/balance vertical space. Distributing at the ROOT
// (rather than a nested match_parent child) is what makes it fill reliably:
// `space-between` pins the two zones to the top and bottom; `space-around`
// brackets a single zone with spacers so it centers.
function RootColumn({
  justify,
  children,
}: {
  justify: 'space-between' | 'space-around';
  children: React.ReactNode;
}) {
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: justify,
        backgroundColor: BG,
        borderRadius: 20,
        padding: 16,
      }}
      accessibilityLabel="MoodRx streak and today's prescription"
    >
      {children}
    </FlexWidget>
  );
}

export function MoodRxWidget({
  snapshot,
  width,
  height,
}: {
  snapshot: WidgetSnapshot;
  width: number;
  height: number;
}) {
  const accent = (snapshot.today?.moodColor ?? ACCENT_DEFAULT) as ColorProp;
  const isMedium = width >= MEDIUM_MIN_WIDTH;
  const isLarge = height >= LARGE_MIN_HEIGHT;
  const hasStreak = snapshot.streak > 0;
  // A broken streak (0) reads as a deflating accent-colored zero — mute it and
  // reframe the label as an invitation rather than a failure.
  const streakColor: ColorProp = hasStreak ? accent : (MUTED as ColorProp);
  const doneTodayStyle: TextWidgetStyle = { ...doneTodayStyleBase, color: accent };

  // New user: a single hero line, centered via spacers (gravity centering is
  // not honored on the widget root).
  if (!snapshot.hasSessions) {
    return (
      <RootColumn justify="space-around">
        <TextWidget
          text="Log your first mood →"
          style={{ fontSize: isLarge ? 20 : 16, fontWeight: 'bold', color: FG }}
          maxLines={2}
        />
      </RootColumn>
    );
  }

  // Streak hero — present in every has-sessions state.
  const streakHero = (
    <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
      <TextWidget
        text={String(snapshot.streak)}
        style={{ fontSize: isLarge ? 64 : 44, fontWeight: 'bold', color: streakColor }}
        maxLines={1}
      />
      <TextWidget
        text={hasStreak ? 'DAY STREAK' : 'START A NEW STREAK'}
        style={streakLabelStyle}
        maxLines={1}
        truncate="END"
      />
    </FlexWidget>
  );

  // Not yet checked in, on a medium+ widget: anchor today's full Rx to the
  // bottom and pin the streak hero to the top with a weighted spacer between.
  if (!snapshot.checkedInToday && snapshot.today && isMedium) {
    return (
      <RootColumn justify="space-between">
        {streakHero}
        <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
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
      </RootColumn>
    );
  }

  // Every other has-sessions state (DONE TODAY, compact small-width today, or
  // a broken streak with no Rx) is a single cohesive block — streak plus an
  // optional status line — reliably centered with spacers above and below.
  return (
    <RootColumn justify="space-around">
      <FlexWidget style={{ flexDirection: 'column', width: 'match_parent' }}>
        {streakHero}
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
    </RootColumn>
  );
}
