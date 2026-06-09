/**
 * ErrorBoundary Component
 *
 * Self-contained React error boundary. Catches React render errors, logs them
 * locally (no third-party transmission — data stays on-device), and displays a
 * fallback UI so the user can retry without force-quitting the app.
 */

import React from "react";
import { Pressable, View } from "react-native";
import { VStack } from "./ui/vstack";
import { Text } from "./ui/text";
import { AlertTriangle } from "lucide-react-native";

interface ErrorFallbackProps {
  error: Error;
  errorInfo?: React.ErrorInfo;
  resetError: () => void;
}

/**
 * Fallback UI displayed when an error is caught.
 *
 * Shows the error message plus a Try Again button bound to `resetError`,
 * so a caught error doesn't become a permanent dead screen — the user
 * can retry without force-quitting the app.
 */
function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <View className="flex-1 bg-background-50 items-center justify-center p-6">
      <VStack space="lg" className="items-center max-w-md">
        <AlertTriangle size={48} className="text-red-500" />
        <Text className="text-xl font-semibold text-center">
          Something went wrong
        </Text>
        <Text className="text-sm text-typography-500 text-center">
          {error?.message || "An unexpected error occurred"}
        </Text>
        <Pressable
          onPress={resetError}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          className="border border-typography-500 px-6 py-3 mt-2 active:opacity-70"
        >
          <Text className="text-sm font-semibold tracking-widest text-center">
            TRY AGAIN
          </Text>
        </Pressable>
      </VStack>
    </View>
  );
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Error boundary class component.
 *
 * React error boundaries must be class components. Catches errors in the
 * subtree, logs them locally, and renders the fallback UI with a reset button.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log locally only — no third-party transmission (data stays on-device).
    console.error("[MoodRx] Uncaught error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} resetError={this.reset} />;
    }
    return this.props.children;
  }
}
