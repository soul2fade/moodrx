import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  addSession as addSessionStorage,
  clearSessions as clearSessionsStorage,
  getAverageChange,
  getSessions,
  getStreak,
  Session,
} from '@/lib/storage';

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

  return (
    <SessionsContext.Provider
      value={{
        sessions,
        isLoading,
        streak,
        sessionCount,
        avgChange,
        lastSession,
        refresh,
        addSession,
        clearSessions,
      }}
    >
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
