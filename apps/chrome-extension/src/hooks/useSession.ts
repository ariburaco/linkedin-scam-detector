import type { Session } from "@acme/auth/types";
import { sendToBackground } from "@plasmohq/messaging";
import { useStorage } from "@plasmohq/storage/hook";
import { useEffect, useState } from "react";

import type {
  SessionRequestBody,
  SessionResponseBody,
} from "@/background/messages/session";
import { STORAGE_KEYS } from "@/shared/sessionManager";

/**
 * Hook to access the current session data
 * @param autoRefresh Whether to automatically refresh the session
 * @returns Session data and utility functions
 */
export function useSession(autoRefresh = false) {
  // Use Plasmo's useStorage hook for automatic syncing
  const [session, setStoredSession] = useStorage<Session | null>(
    STORAGE_KEYS.SESSION,
    null
  );
  const [cookies] = useStorage<string | null>(STORAGE_KEYS.COOKIES, null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Load session using background messaging
  const loadSession = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("Requesting session from background...");
      const response = await sendToBackground<
        SessionRequestBody,
        SessionResponseBody
      >({
        name: "session",
        body: {
          action: "getSession",
        },
      });

      if (response.success && response.session) {
        // Explicitly update the session in storage to ensure it's synced
        setStoredSession(response.session);
      } else {
        console.log("No active session returned from background");
        // Ensure session is null if none returned
        setStoredSession(null);
      }
    } catch (error) {
      console.error("Error communicating with background:", error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Force refresh session from server
  const refreshSession = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await sendToBackground<
        SessionRequestBody,
        SessionResponseBody
      >({
        name: "session",
        body: {
          action: "refreshSession",
        },
      });

      if (response.success && response.session) {
        // Explicitly update the session in storage to ensure it's synced
        setStoredSession(response.session);
      } else {
        // Ensure session is null if none returned
        setStoredSession(null);
      }
    } catch (error) {
      console.error("Error refreshing session:", error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Logout current user
  const logout = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await sendToBackground<
        SessionRequestBody,
        SessionResponseBody
      >({
        name: "session",
        body: {
          action: "signOut",
        },
      });

      if (response.success) {
        // Explicitly clear the session in storage
        setStoredSession(null);
      } else {
        console.error("Error signing out:", response.error);
      }
    } catch (error) {
      console.error("Error signing out:", error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const signInEmail = async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await sendToBackground<
        SessionRequestBody,
        SessionResponseBody
      >({
        name: "session",
        body: {
          action: "signInEmail",
          email,
          password,
        },
      });

      if (response.error) {
        setError(response.error);
      }
    } catch (error) {
      console.error("Error signing in with email:", error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const signInAnonymous = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await sendToBackground<
        SessionRequestBody,
        SessionResponseBody
      >({
        name: "session",
        body: {
          action: "signInAnonymous",
        },
      });

      if (response.error) {
        setError(response.error);
      }
    } catch (error) {
      console.error("Error signing in anonymously:", error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Setup smart refresh interval - only refresh if session exists
  useEffect(() => {
    if (!autoRefresh) return;

    // More frequent refresh when authenticated (every 30s to catch changes)
    // Less frequent when not authenticated (every 2 minutes)
    const interval = setInterval(
      () => {
        // Only refresh if we have a session - otherwise rely on cookie listener
        if (session?.user) {
          void refreshSession();
        }
      },
      session?.user ? 30000 : 120000
    ); // 30s if authenticated, 2min if not

    return () => clearInterval(interval);
  }, [autoRefresh, session?.user]);

  return {
    session,
    cookies,
    isLoading,
    isAuthenticated: !!session?.user,
    user: session?.user || null,
    refreshSession,
    loadSession, // Add direct access to loadSession for manual retries
    logout,
    signInEmail,
    signInAnonymous,
    error,
  };
}
