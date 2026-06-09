import { View, Text, Pressable, StyleSheet } from "react-native";
import { Stack, router } from "expo-router";
import { colors } from "@/lib/colors";
import { type } from "@/lib/typography";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.root}>
        <Text style={styles.label}>404</Text>
        <Text style={styles.headline}>This screen doesn&apos;t exist.</Text>
        <Text style={styles.body}>
          The link you followed may be broken or outdated.
        </Text>
        <Pressable
          onPress={() => router.replace("/")}
          accessibilityRole="button"
          accessibilityLabel="Go to home screen"
          style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
        >
          <Text style={styles.linkText}>Go to home screen</Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  label: {
    ...type.label,
    color: colors.accent,
    marginBottom: 16,
  },
  headline: {
    ...type.headlineSm,
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    ...type.bodyMuted,
    textAlign: "center",
    marginBottom: 32,
  },
  link: {
    borderBottomWidth: 1,
    borderBottomColor: colors.accent,
    paddingBottom: 2,
  },
  linkPressed: {
    opacity: 0.6,
  },
  linkText: {
    ...type.body,
    color: colors.accent,
  },
});
