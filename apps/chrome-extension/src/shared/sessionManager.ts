import type { Session } from "@acme/auth/types";
import { Storage } from "@plasmohq/storage";

import { extensionLoggerBackground } from "./loggers";

import { authClient } from "@/auth/auth-client";
import { AUTH_URL } from "@/constants/constants";

// Extract domain from URL
const API_DOMAIN = AUTH_URL ? new URL(AUTH_URL).hostname : "localhost";
extensionLoggerBackground.info("API_DOMAIN:", API_DOMAIN);

// Helper to check if a domain matches API domain (including subdomains)
const matchesApiDomain = (domain: string): boolean => {
  if (domain === API_DOMAIN || domain === "localhost") {
    return true;
  }

  // Check if domain is a subdomain of API_DOMAIN
  // e.g., app.example.com matches example.com
  if (API_DOMAIN && domain.endsWith(`.${API_DOMAIN}`)) {
    return true;
  }

  return false;
};

// Storage for session data
export const storage = new Storage({ area: "sync" });

// Keys for storage
export const STORAGE_KEYS = {
  SESSION: "session",
  COOKIES: "cookies",
  USER_ID: "userId",
  FIRST_INSTALL: "firstInstall",
  SESSION_CACHE_TIMESTAMP: "sessionCacheTimestamp",
  SESSION_MANAGER_INITIALIZED: "sessionManagerInitialized",
};

// Session cache TTL: 30 seconds
const SESSION_CACHE_TTL = 30 * 1000;

// Performance metrics
export interface SessionMetrics {
  lastFetchTime: number;
  fetchCount: number;
  errorCount: number;
  averageFetchTime: number;
}

// Error types for better error handling
export enum SessionErrorType {
  NETWORK = "NETWORK",
  AUTH = "AUTH",
  SERVER = "SERVER",
  RATE_LIMIT = "RATE_LIMIT",
  UNKNOWN = "UNKNOWN",
}

export interface SessionError {
  type: SessionErrorType;
  message: string;
  recoverable: boolean;
  originalError?: unknown;
}

// Network connectivity state
let isOnline = true;

const sessionMetrics: SessionMetrics = {
  lastFetchTime: 0,
  fetchCount: 0,
  errorCount: 0,
  averageFetchTime: 0,
};

// List of auth cookies to monitor
const AUTH_COOKIE_NAMES = [
  // Better Auth cookies
  "access_token",
  "refresh_token",
  "session_token",
  "better-auth.session_token",
  "better-auth.session_data",
  // Secure versions
  "__Secure-access_token",
  "__Secure-refresh_token",
  "__Secure-session_token",
  "__Secure-better-auth.session_token",
  "__Secure-better-auth.session_data",
];

// Get cookies from the API domain (including subdomains)
export const getCookies = async (): Promise<string | null> => {
  try {
    // Get cookies for exact domain and all subdomains
    const exactDomainCookies = await chrome.cookies.getAll({
      domain: API_DOMAIN,
    });

    // Also check parent domain pattern for subdomain cookies
    // For example, if API_DOMAIN is "example.com", also check for cookies set on "app.example.com"
    const allCookies = [...exactDomainCookies];

    // Get all cookies and filter by domain matching
    if (API_DOMAIN && API_DOMAIN !== "localhost") {
      try {
        const allDomainCookies = await chrome.cookies.getAll({});
        const matchingCookies = allDomainCookies.filter((cookie) =>
          matchesApiDomain(cookie.domain)
        );
        // Merge and deduplicate by name
        const cookieMap = new Map<string, chrome.cookies.Cookie>();
        [...allCookies, ...matchingCookies].forEach((cookie) => {
          cookieMap.set(cookie.name, cookie);
        });
        allCookies.length = 0;
        allCookies.push(...cookieMap.values());
      } catch (error) {
        extensionLoggerBackground.warn(
          "Error getting all cookies for domain matching:",
          error
        );
      }
    }

    if (!allCookies.length) {
      return null;
    }

    const cookiesString = allCookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    return cookiesString;
  } catch (error) {
    extensionLoggerBackground.error("Error getting cookies:", error);
    return null;
  }
};

// Check if cached session is still valid
const isSessionCacheValid = async (): Promise<boolean> => {
  try {
    const cachedTimestamp = await storage.get<number>(
      STORAGE_KEYS.SESSION_CACHE_TIMESTAMP
    );
    if (!cachedTimestamp) return false;

    const now = Date.now();
    return now - cachedTimestamp < SESSION_CACHE_TTL;
  } catch {
    return false;
  }
};

// Classify errors for better handling
const classifyError = (error: unknown): SessionError => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (
      message.includes("network") ||
      message.includes("fetch") ||
      message.includes("failed to fetch") ||
      message.includes("networkerror")
    ) {
      return {
        type: SessionErrorType.NETWORK,
        message: "Network error. Please check your connection.",
        recoverable: true,
        originalError: error,
      };
    }

    // Auth errors (401, 403)
    if (
      message.includes("401") ||
      message.includes("403") ||
      message.includes("unauthorized") ||
      message.includes("forbidden")
    ) {
      return {
        type: SessionErrorType.AUTH,
        message: "Authentication failed. Please sign in again.",
        recoverable: false,
        originalError: error,
      };
    }

    // Rate limit errors
    if (
      message.includes("429") ||
      message.includes("rate limit") ||
      message.includes("too many requests")
    ) {
      return {
        type: SessionErrorType.RATE_LIMIT,
        message: "Too many requests. Please wait a moment.",
        recoverable: true,
        originalError: error,
      };
    }

    // Server errors (500+)
    if (
      message.includes("500") ||
      message.includes("502") ||
      message.includes("503") ||
      message.includes("server error")
    ) {
      return {
        type: SessionErrorType.SERVER,
        message: "Server error. Please try again later.",
        recoverable: true,
        originalError: error,
      };
    }
  }

  return {
    type: SessionErrorType.UNKNOWN,
    message: "An unexpected error occurred.",
    recoverable: true,
    originalError: error,
  };
};

// Check network connectivity
const checkNetworkConnectivity = (): boolean => {
  // In service worker context, navigator.onLine may not be available
  // Use isOnline flag which is updated by network listeners
  return isOnline;
};

// Fetch session from better-auth client with caching and retry logic
export const getSession = async (
  forceRefresh = false,
  retryCount = 0
): Promise<Session | null> => {
  const startTime = Date.now();

  // Check network connectivity before making requests
  if (!checkNetworkConnectivity()) {
    extensionLoggerBackground.warn("Offline - using cached session");
    const cachedSession = await getStoredSession();
    if (cachedSession?.user) {
      return cachedSession;
    }
    return null;
  }

  try {
    // Check cache first unless forcing refresh
    if (!forceRefresh && (await isSessionCacheValid())) {
      const cachedSession = await getStoredSession();
      if (cachedSession?.user) {
        extensionLoggerBackground.info("Using cached session");
        return cachedSession;
      }
    }

    // Fetch fresh session from server
    const sessionResponse = await authClient.getSession();
    const session = sessionResponse.data;

    // Update metrics
    const fetchTime = Date.now() - startTime;
    sessionMetrics.fetchCount++;
    sessionMetrics.lastFetchTime = fetchTime;
    sessionMetrics.averageFetchTime =
      (sessionMetrics.averageFetchTime * (sessionMetrics.fetchCount - 1) +
        fetchTime) /
      sessionMetrics.fetchCount;

    if (!session?.user) {
      // Clear cache if no session
      await storage.set(STORAGE_KEYS.SESSION_CACHE_TIMESTAMP, null);
      return null;
    }

    // Validate session before caching
    if (session.user && session.session) {
      // Cache the session with timestamp
      await storage.set(STORAGE_KEYS.SESSION_CACHE_TIMESTAMP, Date.now());
      extensionLoggerBackground.info(`Session fetched in ${fetchTime}ms`, {
        userId: session.user.id,
      });
    }

    // Update network status on success
    updateNetworkStatus(true);
    return session;
  } catch (error) {
    sessionMetrics.errorCount++;
    const classifiedError = classifyError(error);

    // Update network status on failure
    updateNetworkStatus(false);

    extensionLoggerBackground.error(
      `Error getting better-auth session [${classifiedError.type}]:`,
      classifiedError.message,
      error
    );

    // Don't retry if error is not recoverable (auth errors)
    if (!classifiedError.recoverable) {
      await clearSession();
      return null;
    }

    // Retry with exponential backoff (max 3 retries) for recoverable errors
    if (retryCount < 3) {
      const backoffDelay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      extensionLoggerBackground.info(
        `Retrying session fetch in ${backoffDelay}ms (attempt ${retryCount + 1})`
      );
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      return getSession(forceRefresh, retryCount + 1);
    }

    // Return cached session as fallback if available
    const cachedSession = await getStoredSession();
    if (cachedSession?.user) {
      extensionLoggerBackground.info("Using cached session as fallback");
      return cachedSession;
    }

    return null;
  }
};

// Store session in storage
export const setSession = async (session: Session | null): Promise<void> => {
  await storage.set(STORAGE_KEYS.SESSION, session);
};

// Get session from storage
export const getStoredSession = async (): Promise<Session | null> => {
  const session = await storage.get<Session>(STORAGE_KEYS.SESSION);
  return session ?? null;
};

// Store cookies
export const setCookies = async (cookies: string | null): Promise<void> => {
  await storage.set(STORAGE_KEYS.COOKIES, cookies);
};

// Get cookies from storage
export const getStoredCookies = async (): Promise<string | null> => {
  const cookies = await storage.get<string>(STORAGE_KEYS.COOKIES);
  return cookies ?? null;
};

// Ensure a user ID exists
export const ensureUserId = async (): Promise<string> => {
  let userId = await storage.get<string>(STORAGE_KEYS.USER_ID);
  if (!userId) {
    userId = crypto.randomUUID();
    await storage.set(STORAGE_KEYS.USER_ID, userId);
  }
  return userId;
};

// Check if this is first time installation
export const isFirstTimeInstall = async (): Promise<boolean> => {
  const firstInstall = await storage.get<string>(STORAGE_KEYS.FIRST_INSTALL);
  return firstInstall === null || firstInstall === undefined;
};

// Set first install status
export const setFirstInstall = async (isFirst: boolean): Promise<void> => {
  await storage.set(STORAGE_KEYS.FIRST_INSTALL, isFirst.toString());
};

// Clear session data
export const clearSession = async (): Promise<void> => {
  await storage.set(STORAGE_KEYS.SESSION, null);
  await storage.set(STORAGE_KEYS.COOKIES, null);
};

// Sign out the current user
export const signOut = async (): Promise<void> => {
  try {
    await authClient.signOut();
    await clearSession();
    extensionLoggerBackground.info("User signed out successfully");
  } catch (error) {
    extensionLoggerBackground.error("Error signing out:", error);
    throw error;
  }
};

// Sign in anonymously
export const signInAnonymous = async () => {
  try {
    const response = await authClient.signIn.anonymous();
    if (response.error) {
      extensionLoggerBackground.error(
        "Error signing in anonymously:",
        response
      );
      throw new Error(response.error.message);
    }

    return response.data;
  } catch (error) {
    extensionLoggerBackground.error("Error signing in anonymously:", error);
    throw error;
  }
};

// Sign in with email and password
export const signInEmail = async (email: string, password: string) => {
  try {
    const response = await authClient.signIn.email({ email, password });
    if (response.error) {
      extensionLoggerBackground.error("Error signing in with email:", response);
      throw new Error(response.error.message);
    }

    return response.data;
  } catch (error) {
    extensionLoggerBackground.error("Error signing in with email:", error);
    throw error;
  }
};

// Refresh the session with force refresh to bypass cache
export const refreshSession = async (): Promise<Session | null> => {
  try {
    // Force refresh to get latest session from server
    const session = await getSession(true);

    // Store session
    await setSession(session);

    // Get and store cookies
    const cookies = await getCookies();
    await setCookies(cookies);

    extensionLoggerBackground.info("Session refreshed successfully");
    return session;
  } catch (error) {
    extensionLoggerBackground.error("Error refreshing session:", error);
    throw error;
  }
};

// Watch for session changes across different contexts
export const watchSession = (
  callback: (session: Session | null) => void
): (() => void) => {
  const unwatchFn = storage.watch({
    [STORAGE_KEYS.SESSION]: (change) => {
      extensionLoggerBackground.info("Session changed in storage", change);
      callback(change.newValue);
    },
  });

  return () => unwatchFn;
};

// Watch for cookies changes across different contexts
export const watchCookies = (
  callback: (cookies: string | null) => void
): (() => void) => {
  const unwatchFn = storage.watch({
    [STORAGE_KEYS.COOKIES]: (change) => {
      extensionLoggerBackground.info("Cookies changed in storage", change);
      callback(change.newValue);
    },
  });

  return () => unwatchFn;
};

// Initialize cookie monitoring with optimized performance
let debounceTimeout: NodeJS.Timeout | null = null;
let isProcessingCookieChange = false;
let cookieListenerInitialized = false;

export const initCookieListener = (): void => {
  // Prevent duplicate listener registration
  if (cookieListenerInitialized) {
    extensionLoggerBackground.info(
      "Cookie listener already initialized, skipping"
    );
    return;
  }

  cookieListenerInitialized = true;
  chrome.cookies.onChanged.addListener(async (details) => {
    try {
      const { domain, name } = details.cookie;

      // Check if domain matches (including subdomains) and cookie is an auth cookie
      if (!matchesApiDomain(domain) || !AUTH_COOKIE_NAMES.includes(name)) {
        return;
      }

      extensionLoggerBackground.info(`Auth cookie changed: ${name}`, {
        domain,
        cause: details.cause,
        removed: details.removed,
      });

      // Clear any pending timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
        debounceTimeout = null;
      }

      // Optimized debounce: reduced from 100ms to 50ms
      debounceTimeout = setTimeout(async () => {
        if (isProcessingCookieChange) {
          extensionLoggerBackground.info(
            "Skipping cookie change - already processing"
          );
          return;
        }

        isProcessingCookieChange = true;
        const processingStartTime = Date.now();

        try {
          if (details.cause === "expired_overwrite" && details.removed) {
            // User logged out - immediate update
            extensionLoggerBackground.info(
              "Cookie indicates logout, clearing session"
            );

            // Use Promise-based approach instead of fixed wait
            await Promise.all([
              storage.set(STORAGE_KEYS.SESSION, null),
              storage.set(STORAGE_KEYS.COOKIES, null),
              storage.set(STORAGE_KEYS.SESSION_CACHE_TIMESTAMP, null),
            ]);

            const processingTime = Date.now() - processingStartTime;
            const totalLatency = processingTime + 50; // debounce + processing
            extensionLoggerBackground.info(
              `User logged out - session cleared in ${totalLatency}ms`
            );
          } else if (
            details.cause === "explicit" &&
            details.removed === false
          ) {
            // User logged in - fetch fresh session with force refresh
            extensionLoggerBackground.info(
              "Cookie indicates login, fetching fresh session"
            );

            // Force refresh to bypass cache
            const session = await getSession(true);

            // Update storage atomically
            await Promise.all([
              storage.set(STORAGE_KEYS.SESSION, session),
              storage.set(STORAGE_KEYS.SESSION_CACHE_TIMESTAMP, Date.now()),
            ]);

            // Update cookies
            const cookies = await getCookies();
            await storage.set(STORAGE_KEYS.COOKIES, cookies);

            const processingTime = Date.now() - processingStartTime;
            const totalLatency = processingTime + 50; // debounce + processing
            extensionLoggerBackground.info(
              `User logged in - session updated in ${totalLatency}ms`,
              {
                hasSession: !!session,
              }
            );
          }
        } catch (error) {
          extensionLoggerBackground.error(
            "Error processing cookie change:",
            error
          );
        } finally {
          isProcessingCookieChange = false;
        }
      }, 50); // Reduced debounce from 100ms to 50ms
    } catch (error) {
      extensionLoggerBackground.error("Error checking cookies:", error);
    }
  });

  extensionLoggerBackground.info("Cookie listener initialized");
};

// Proactive session polling interval (30 seconds)
let sessionPollingInterval: NodeJS.Timeout | null = null;
let storageListenerInitialized = false;
let networkListenersInitialized = false;

// Start proactive session polling as fallback
const startSessionPolling = (): void => {
  // Clear existing interval if any
  if (sessionPollingInterval) {
    clearInterval(sessionPollingInterval);
  }

  // Poll every 30 seconds to catch any missed cookie changes
  sessionPollingInterval = setInterval(async () => {
    try {
      const currentSession = await getStoredSession();
      const freshSession = await getSession(false);

      // Only update if session state changed
      if (
        currentSession?.user?.id !== freshSession?.user?.id ||
        (!currentSession && freshSession) ||
        (currentSession && !freshSession)
      ) {
        extensionLoggerBackground.info(
          "Session changed detected via polling, updating..."
        );
        await setSession(freshSession);
        const cookies = await getCookies();
        await setCookies(cookies);
      }
    } catch (error) {
      extensionLoggerBackground.error("Error in session polling:", error);
    }
  }, 30000); // 30 seconds

  extensionLoggerBackground.info("Session polling started (30s interval)");
};

// Stop session polling
const stopSessionPolling = (): void => {
  if (sessionPollingInterval) {
    clearInterval(sessionPollingInterval);
    sessionPollingInterval = null;
    extensionLoggerBackground.info("Session polling stopped");
  }
};

// Initialize network connectivity listeners
const initNetworkListeners = (): void => {
  // Prevent duplicate initialization
  if (networkListenersInitialized) {
    extensionLoggerBackground.info(
      "Network listeners already initialized, skipping"
    );
    return;
  }

  networkListenersInitialized = true;

  // Listen for online/offline events
  if (typeof navigator !== "undefined" && navigator.onLine !== undefined) {
    isOnline = navigator.onLine;

    // Note: Service workers don't have direct access to window events
    // We'll update the flag when requests succeed/fail instead
    extensionLoggerBackground.info(
      `Network status initialized: ${isOnline ? "online" : "offline"}`
    );
  }

  extensionLoggerBackground.info("Network listeners initialized");
};

// Update network status based on request success/failure
const updateNetworkStatus = (success: boolean): void => {
  if (success) {
    isOnline = true;
  } else {
    // Only mark as offline if we get multiple failures
    // This prevents false positives from transient errors
  }
};

// Initialize chrome.storage.onChanged listener for immediate cross-context updates
const initStorageChangeListener = (): void => {
  // Prevent duplicate listener registration
  if (storageListenerInitialized) {
    extensionLoggerBackground.info(
      "Storage change listener already initialized, skipping"
    );
    return;
  }

  storageListenerInitialized = true;
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") return;

    if (changes[STORAGE_KEYS.SESSION]) {
      const newSession = changes[STORAGE_KEYS.SESSION].newValue;
      extensionLoggerBackground.info(
        "Session changed via storage listener (cross-context sync)",
        {
          hasSession: !!newSession?.user,
        }
      );
    }

    if (changes[STORAGE_KEYS.COOKIES]) {
      extensionLoggerBackground.info(
        "Cookies changed via storage listener (cross-context sync)"
      );
    }
  });

  extensionLoggerBackground.info("Storage change listener initialized");
};

// Check if session manager is already initialized
export const isSessionManagerInitialized = async (): Promise<boolean> => {
  try {
    const initialized = await storage.get<boolean>(
      STORAGE_KEYS.SESSION_MANAGER_INITIALIZED
    );
    return initialized === true;
  } catch {
    return false;
  }
};

// Mark session manager as initialized
const setSessionManagerInitialized = async (
  initialized: boolean
): Promise<void> => {
  await storage.set(STORAGE_KEYS.SESSION_MANAGER_INITIALIZED, initialized);
};

/**
 * Initialize the session manager
 */
export const initializeSession = async (): Promise<void> => {
  try {
    // Ensure user ID exists
    const userId = await ensureUserId();
    extensionLoggerBackground.info("User ID initialized:", userId);

    // Check if this is first install
    const firstTimeInstall = await isFirstTimeInstall();
    if (firstTimeInstall) {
      extensionLoggerBackground.info("First time installation");
      await setFirstInstall(false);
    } else {
      extensionLoggerBackground.info("Extension reinstallation detected");
    }

    // Initialize network listeners
    initNetworkListeners();

    // Initialize storage change listener for cross-context sync
    initStorageChangeListener();

    // Initialize cookie listener
    initCookieListener();

    // Start proactive session polling
    startSessionPolling();

    // Get initial session
    const session = await getSession();
    await setSession(session);

    // Mark as initialized
    await setSessionManagerInitialized(true);

    // Log performance metrics
    extensionLoggerBackground.info("Session manager initialized", {
      metrics: sessionMetrics,
    });
  } catch (error) {
    extensionLoggerBackground.error("Error in initializeSession:", error);
    await setSessionManagerInitialized(false);
    // Reset initialization flags on error so it can be retried
    cookieListenerInitialized = false;
    storageListenerInitialized = false;
    networkListenersInitialized = false;
    throw error;
  }
};

// Export function to get performance metrics
export const getSessionMetrics = (): SessionMetrics => {
  return { ...sessionMetrics };
};

export const getUserId = async (): Promise<string> => {
  return await ensureUserId();
};
