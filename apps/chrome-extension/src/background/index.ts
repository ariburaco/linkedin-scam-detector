/**
 * Background service worker for the Chrome extension
 * This script runs in the background and can listen for browser events
 */

import { FEATURE_FLAG_KEYS } from "@acme/shared";
import { Storage } from "@plasmohq/storage";

import {
  getFeatureFlagOverrides,
  mergeFeatureFlags,
} from "../lib/storage/feature-flags-storage";
import { callerApi } from "../trpc/caller";

import { extensionLoggerBackground } from "@/shared/loggers";
import {
  initializeSession,
  isSessionManagerInitialized,
} from "@/shared/sessionManager";

// Initialize the storage
export const storage = new Storage();

// Initialize session manager on startup
extensionLoggerBackground.info("Background service worker starting");

/**
 * Get merged feature flags (server + local overrides)
 */
const getFeatureFlags = async () => {
  try {
    const serverFlags = await callerApi.featureFlags.getAll.query();
    const localOverrides = await getFeatureFlagOverrides();
    return mergeFeatureFlags(serverFlags, localOverrides);
  } catch (error) {
    extensionLoggerBackground.warn(
      "Failed to fetch feature flags, using defaults:",
      error
    );
    // Fail open - return defaults (all enabled)
    return {
      [FEATURE_FLAG_KEYS.JOB_EXTRACTION]: true,
      [FEATURE_FLAG_KEYS.JOB_EMBEDDINGS]: true,
      [FEATURE_FLAG_KEYS.JOB_DISCOVERY]: true,
    };
  }
};

// Initialize session manager - this starts cookie monitoring and loads initial session
const initSessionManager = async () => {
  try {
    // Check if already initialized to prevent duplicate listeners
    const alreadyInitialized = await isSessionManagerInitialized();
    if (alreadyInitialized) {
      extensionLoggerBackground.info(
        "Session manager already initialized, skipping"
      );
      return;
    }

    // Check feature flags before initializing
    const flags = await getFeatureFlags();
    extensionLoggerBackground.info("Feature flags status:", {
      jobExtraction: flags[FEATURE_FLAG_KEYS.JOB_EXTRACTION],
      jobEmbeddings: flags[FEATURE_FLAG_KEYS.JOB_EMBEDDINGS],
      jobDiscovery: flags[FEATURE_FLAG_KEYS.JOB_DISCOVERY],
    });

    await initializeSession();
    extensionLoggerBackground.info("Session manager initialized successfully");
  } catch (error) {
    extensionLoggerBackground.error(
      "Failed to initialize session manager:",
      error
    );
  }
};

// Initialize on service worker startup
initSessionManager();

// Reinitialize on extension startup (browser restart)
chrome.runtime.onStartup.addListener(() => {
  extensionLoggerBackground.info(
    "Extension startup detected, reinitializing session manager"
  );
  initSessionManager();
});

// Reinitialize on extension installation/update
chrome.runtime.onInstalled.addListener(async (details) => {
  extensionLoggerBackground.info(
    "Extension installed/updated:",
    details.reason
  );
  if (details.reason === "install" || details.reason === "update") {
    // Check feature flags on install/update
    const flags = await getFeatureFlags();
    extensionLoggerBackground.info("Feature flags on install/update:", flags);
    initSessionManager();
  }
});

export {};
