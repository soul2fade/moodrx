import WidgetKit
import SwiftUI

// Must match: the App Group in app.json / expo-target.config.js, the kind passed
// to ExtensionStorage.reloadWidget("MoodRxWidget"), and the keys written by
// lib/widget-bridge.tsx. The app writes a precomputed snapshot to this suite;
// the widget only reads — it never recomputes business logic.
private let appGroup = "group.com.moodrx.app"

private enum Brand {
  static let bg = Color(hex: "#0a0a0a") ?? .black
  static let fg = Color.white
  static let muted = Color(hex: "#888888") ?? .gray
}

// MARK: - Timeline

struct MoodRxEntry: TimelineEntry {
  let date: Date
  let streak: Int
  let checkedInToday: Bool
  let hasSessions: Bool
  let moodName: String
  let moodColor: String
  let workoutName: String
  let durationMin: Int

  var accent: Color {
    moodColor.isEmpty ? Brand.fg : (Color(hex: moodColor) ?? Brand.fg)
  }
}

struct Provider: TimelineProvider {
  // Shown in the widget gallery / while real data loads.
  func placeholder(in context: Context) -> MoodRxEntry {
    MoodRxEntry(
      date: Date(), streak: 7, checkedInToday: false, hasSessions: true,
      moodName: "Anxious", moodColor: "#E8B84B",
      workoutName: "Mobility Flow", durationMin: 20
    )
  }

  func getSnapshot(in context: Context, completion: @escaping (MoodRxEntry) -> Void) {
    completion(readEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<MoodRxEntry>) -> Void) {
    let entry = readEntry()
    // The app pushes refreshes via ExtensionStorage.reloadWidget on every
    // sessions change and on foreground. This timeline reload is the safety net
    // for day rollover when the app isn't opened: re-read just after midnight.
    let calendar = Calendar.current
    let nextRefresh = calendar.nextDate(
      after: Date(),
      matching: DateComponents(hour: 0, minute: 1),
      matchingPolicy: .nextTime
    ) ?? Date().addingTimeInterval(60 * 60)
    completion(Timeline(entries: [entry], policy: .after(nextRefresh)))
  }

  private func readEntry() -> MoodRxEntry {
    let defaults = UserDefaults(suiteName: appGroup)
    // Flat primitive keys → typed accessors, no JSON decoding. Booleans are
    // written as 0/1 Ints by the JS bridge (ExtensionStorage has no setBool);
    // UserDefaults.bool reads a stored Int 1 as true.
    return MoodRxEntry(
      date: Date(),
      streak: defaults?.integer(forKey: "streak") ?? 0,
      checkedInToday: defaults?.bool(forKey: "checkedInToday") ?? false,
      hasSessions: defaults?.bool(forKey: "hasSessions") ?? false,
      moodName: defaults?.string(forKey: "moodName") ?? "",
      moodColor: defaults?.string(forKey: "moodColor") ?? "",
      workoutName: defaults?.string(forKey: "workoutName") ?? "",
      durationMin: defaults?.integer(forKey: "durationMin") ?? 0
    )
  }
}

// MARK: - Views

struct MoodRxWidgetEntryView: View {
  @Environment(\.widgetFamily) private var family
  var entry: MoodRxEntry

  var body: some View {
    content
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
      .containerBackground(Brand.bg, for: .widget)
      .widgetURL(URL(string: "moodrx://home"))
  }

  @ViewBuilder private var content: some View {
    if !entry.hasSessions {
      newUser
    } else if family == .systemMedium {
      medium
    } else {
      small
    }
  }

  // New user: no sessions yet — an invitation, not an empty state.
  private var newUser: some View {
    VStack(alignment: .leading) {
      Spacer(minLength: 0)
      Text("Log your first mood →")
        .font(.system(size: 18, weight: .bold))
        .foregroundStyle(Brand.fg)
        .minimumScaleFactor(0.8)
      Spacer(minLength: 0)
    }
  }

  // systemSmall: streak hero + a compact today/done line.
  private var small: some View {
    VStack(alignment: .leading, spacing: 0) {
      Spacer(minLength: 0)
      streakHero
      if entry.checkedInToday {
        doneToday.padding(.top, 10)
      } else if !entry.moodName.isEmpty {
        Text("TODAY: \(entry.moodName.uppercased())")
          .font(.system(size: 11, weight: .bold))
          .tracking(1)
          .foregroundStyle(Brand.muted)
          .lineLimit(1)
          .padding(.top, 10)
      }
      Spacer(minLength: 0)
    }
  }

  // systemMedium: streak hero on the left, today's Rx (or done state) on the right.
  private var medium: some View {
    HStack(alignment: .center, spacing: 16) {
      VStack(alignment: .leading, spacing: 0) {
        streakHero
        if entry.checkedInToday {
          doneToday.padding(.top, 10)
        }
      }
      Spacer(minLength: 0)
      if !entry.checkedInToday && !entry.moodName.isEmpty {
        todayBlock
      }
    }
  }

  // MARK: building blocks

  private var hasStreak: Bool { entry.streak > 0 }

  private var streakHero: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text(String(entry.streak))
        .font(.system(size: 44, weight: .bold))
        // A broken streak (0) reads as a deflating accent zero — mute it and
        // reframe the label as an invitation rather than a failure.
        .foregroundStyle(hasStreak ? entry.accent : Brand.muted)
        .lineLimit(1)
        .minimumScaleFactor(0.5)
      Text(hasStreak ? "DAY STREAK" : "START A NEW STREAK")
        .font(.system(size: 11, weight: .bold))
        .tracking(2)
        .foregroundStyle(Brand.muted)
        .lineLimit(1)
    }
  }

  private var doneToday: some View {
    Text("✓ DONE TODAY")
      .font(.system(size: 12, weight: .bold))
      .tracking(1)
      .foregroundStyle(entry.accent)
      .lineLimit(1)
  }

  private var todayBlock: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text("TODAY")
        .font(.system(size: 11, weight: .bold))
        .tracking(2)
        .foregroundStyle(Brand.muted)
      Text("\(entry.moodName) · \(entry.durationMin) MIN")
        .font(.system(size: 13))
        .foregroundStyle(Brand.fg)
        .lineLimit(1)
      Text(entry.workoutName)
        .font(.system(size: 15, weight: .bold))
        .foregroundStyle(entry.accent)
        .lineLimit(2)
        .minimumScaleFactor(0.8)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

// MARK: - Widget

struct MoodRxWidget: Widget {
  // This kind string is what ExtensionStorage.reloadWidget("MoodRxWidget") targets.
  let kind = "MoodRxWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in
      MoodRxWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("MoodRx")
    .description("Your streak and today's prescription.")
    .supportedFamilies([.systemSmall, .systemMedium])
    .contentMarginsDisabled()
  }
}

@main
struct MoodRxWidgetBundle: WidgetBundle {
  var body: some Widget {
    MoodRxWidget()
  }
}

// MARK: - Color hex

extension Color {
  init?(hex: String) {
    var s = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    if s.hasPrefix("#") { s.removeFirst() }
    guard s.count == 6, let value = UInt64(s, radix: 16) else { return nil }
    let r = Double((value & 0xFF0000) >> 16) / 255
    let g = Double((value & 0x00FF00) >> 8) / 255
    let b = Double(value & 0x0000FF) / 255
    self.init(.sRGB, red: r, green: g, blue: b, opacity: 1)
  }
}
