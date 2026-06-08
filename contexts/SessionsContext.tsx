import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import {
  addSession as addSessionStorage,
  clearSessions as clearSessionsStorage,
  getAverageChange,
  getSessions,
  getStreak,
  Session,
} from '@/lib/storage';
import { syncWidget } from '@/lib/widget';

interface SessionsContextValue {
  sessions: Session[];
  isLoading: boolean;
  streak: number;
  sessionCount: number;
  avgChange: number;
  lastSession: Session | null;
  refresh: () => Promise<void>;
  addSession: (session: Session) => Promise<void>;
  clearSessions: () => Promise<void>;
}

// Default is `null` (not an empty-shape stub) so that any consumer
// rendered outside <SessionsProvider> fails loudly in useSessions()
// instead of silently reading `sessions: []` and `isLoading: true`
// forever (which masks real bugs as "no data yet").
const SessionsContext = createContext<SessionsContextValue | null>(null);

export function SessionsProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const data = await getSessions();
    setSessions(data);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Keep the home-screen widget in sync. The sessions effect covers load,
  // add, and clear; the AppState listener covers day rollover (streak /
  // today's Rx change at midnight while the app was backgrounded). No-op on
  // platforms without a widget bridge.
  const sessionsRef = useRef(sessions);
  useEffect(() => {
    sessionsRef.current = sessions;
    void syncWidget(sessions);
  }, [sessions]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncWidget(sessionsRef.current);
    });
    return () => sub.remove();
  }, []);

  const addSession = useCallback(async (session: Session) => {
    await addSessionStorage(session);
    setSessions((prev) => [...prev, session]);
  }, []);

  const clearSessions = useCallback(async () => {
    await clearSessionsStorage();
    setSessions([]);
  }, []);

  const streak = useMemo(() => getStreak(sessions), [sessions]);
  const sessionCount = sessions.length;
  const avgChange = useMemo(() => getAverageChange(sessions), [sessions]);
  const lastSession = sessionCount > 0 ? sessions[sessionCount - 1] : null;

  // Memoize the context value so consumers don't re-render just because
  // SessionsProvider itself re-rendered with an identical state. Without
  // this, every render of the provider produced a new value object and
  // every useContext(SessionsContext) consumer re-rendered — i.e. every
  // screen that reads sessions/streak/etc., on every focus change.
  const value = useMemo<SessionsContextValue>(
    () => ({
      sessions,
      isLoading,
      streak,
      sessionCount,
      avgChange,
      lastSession,
      refresh,
      addSession,
      clearSessions,
    }),
    [sessions, isLoading, streak, sessionCount, avgChange, lastSession, refresh, addSession, clearSessions],
  );

  return (
    <SessionsContext.Provider value={value}>
      {children}
    </SessionsContext.Provider>
  );
}

export function useSessions(): SessionsContextValue {
  const ctx = useContext(SessionsContext);
  if (!ctx) {
    throw new Error('useSessions must be used inside <SessionsProvider>');
  }
  return ctx;
}
