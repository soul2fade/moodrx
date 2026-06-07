/**
 * ErrorBoundary Component
 *
 * Wraps the app to catch React errors and report them to CatDoes Watch.
 * Displays a fallback UI when an error occurs.
 */

import React from "react";
import { Pressable, View } from "react-native";
import { WatchErrorBoundary } from "@catdoes/watch";
import { VStack } from "./ui/vstack";
import { Text } from "./ui/text";
import { AlertTriangle } from "lucide-react-native";

interface ErrorFallbackProps {
  error: Error;
  errorInfo: React.ErrorInfo;
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
 * Error boundary component that integrates with CatDoes Watch
 *
 * Wraps children in a WatchErrorBoundary that automatically reports
 * errors to CatDoes Watch and displays a fallback UI.
 */
export function ErrorBoundary({ children, onError }: ErrorBoundaryProps) {
  return (
    <WatchErrorBoundary
      fallback={ErrorFallback}
      onError={onError}
      captureErrors={true}
    >
      {children}
    </WatchErrorBoundary>
  );
}
