import cssText from "data-text:@/style.css";
import type { PlasmoCSConfig } from "plasmo";
import { useEffect, useState } from "react";

import DebugPanel from "./smart-skip/debug-panel";
import useSmartSkip from "./smart-skip/use-smart-skip";

import { extensionLoggerContent } from "@/shared/loggers";

// Configure the content script to run on streaming platforms
export const config: PlasmoCSConfig = {
  matches: [
    "https://*.netflix.com/*",
    "https://www.primevideo.com/*",
    "https://*.primevideo.com/*",
    "https://play.max.com/*",
    "https://*.disneyplus.com/*",
    "https://www.disneyplus.com/*",
  ],
  all_frames: false,
  run_at: "document_end",
  world: "MAIN", // this is critical to ensure the script runs in the main world
};

// Define CSS for Shadow DOM
export const getStyle = (): HTMLStyleElement => {
  const baseFontSize = 16;

  let updatedCssText = cssText.replaceAll(":root", ":host(plasmo-csui)");
  const remRegex = /([\d.]+)rem/g;
  updatedCssText = updatedCssText.replace(remRegex, (match, remValue) => {
    const pixelsValue = parseFloat(remValue) * baseFontSize;
    return `${pixelsValue}px`;
  });

  const styleElement = document.createElement("style");
  styleElement.textContent = updatedCssText;
  return styleElement;
};

export default function App() {
  const [url, setUrl] = useState(window.location.href);
  const [showDebug, setShowDebug] = useState(false);

  // Monitor URL changes for SPA navigation
  useEffect(() => {
    extensionLoggerContent.info("SmartSkip content script initialized", {
      url,
    });

    // Handle SPA navigation by listening to popstate and watching for URL changes
    const checkUrlChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== url) {
        extensionLoggerContent.info("URL changed (SPA navigation)", {
          oldUrl: url,
          newUrl: currentUrl,
        });
        setUrl(currentUrl);
      }
    };

    // Check URL periodically for SPAs that don't trigger popstate
    const urlCheckInterval = setInterval(checkUrlChange, 500);

    // Listen to popstate for browser back/forward
    window.addEventListener("popstate", checkUrlChange);

    // Listen to pushstate/replacestate by intercepting them
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      originalPushState.apply(history, args);
      setTimeout(checkUrlChange, 0);
    };

    history.replaceState = function (...args) {
      originalReplaceState.apply(history, args);
      setTimeout(checkUrlChange, 0);
    };

    return () => {
      clearInterval(urlCheckInterval);
      window.removeEventListener("popstate", checkUrlChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, [url]);

  // Use our custom hook
  const {
    videoElement,
    currentTime,
    duration,
    skipIntro: doSkipIntro,
    skipRecap: doSkipRecap,
    nextEpisode: doNextEpisode,
    seek10SecondsForward: doSeek10Forward,
    seek10SecondsBackward: doSeek10Backward,
    seekTo,
    seekToPercentage,
    togglePlay,
    features,
  } = useSmartSkip(url);

  // Toggle debug panel with Shift+D
  useEffect(() => {
    const handleDebugToggle = (e: KeyboardEvent) => {
      if (e.key === "D" && e.shiftKey) {
        setShowDebug((prev) => {
          const newState = !prev;
          extensionLoggerContent.info(
            `Debug panel ${newState ? "shown" : "hidden"}`
          );
          return newState;
        });
      }
    };

    document.addEventListener("keydown", handleDebugToggle);
    return () => document.removeEventListener("keydown", handleDebugToggle);
  }, []);

  return (
    <>
      {showDebug && videoElement && (
        <DebugPanel
          videoElement={videoElement}
          currentTime={currentTime}
          duration={duration}
          features={features}
          actions={{
            skipIntro: doSkipIntro,
            skipRecap: doSkipRecap,
            nextEpisode: doNextEpisode,
            seek10SecondsForward: doSeek10Forward,
            seek10SecondsBackward: doSeek10Backward,
            togglePlay,
            seekTo,
            seekToPercentage,
          }}
        />
      )}
    </>
  );
}
