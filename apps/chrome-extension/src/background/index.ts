/**
 * Background service worker for the Chrome extension
 * This script runs in the background and can listen for browser events
 */

import { Storage } from "@plasmohq/storage";

import { extensionLoggerBackground } from "@/shared/loggers";
import {
  initializeSession,
  isSessionManagerInitialized,
} from "@/shared/sessionManager";

// Initialize the storage
export const storage = new Storage();

// Initialize session manager on startup
extensionLoggerBackground.info("Background service worker starting");

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
chrome.runtime.onInstalled.addListener((details) => {
  extensionLoggerBackground.info(
    "Extension installed/updated:",
    details.reason
  );
  if (details.reason === "install" || details.reason === "update") {
    initSessionManager();
  }
});

export {};
