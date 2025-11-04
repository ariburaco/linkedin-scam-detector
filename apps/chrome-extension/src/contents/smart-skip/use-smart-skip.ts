import { useCallback, useEffect, useRef, useState } from "react";

import createSkipController from "@/features/streaming/skip-factory";
import type SkipIntro from "@/features/streaming/smart-skip";
import { extensionLoggerContent } from "@/shared/loggers";

// Smart Skip Hook - for better React integration
function useSmartSkip(url: string) {
  const [skipController, setSkipController] = useState<SkipIntro | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(
    null
  );
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Use a ref to track if the component is still mounted
  const isMountedRef = useRef(true);

  // Track listeners for cleanup
  const listenersRef = useRef<
    { element: HTMLVideoElement; listener: EventListener; eventType: string }[]
  >([]);

  // Initialize the controller
  useEffect(() => {
    extensionLoggerContent.info("Initializing SmartSkip with URL", { url });

    // Reset video element state when URL changes (SPA navigation)
    setVideoElement(null);
    setCurrentTime(0);
    setDuration(0);

    // Create a controller instance using the factory
    const controller = createSkipController(url);
    setSkipController(controller);

    // Cleanup function
    return () => {
      // Call the controller's cleanup method
      if (controller) {
        extensionLoggerContent.debug("Cleaning up SmartSkip controller");
        controller.cleanup();
      }

      // Clean up any listeners that were added
      listenersRef.current.forEach(({ element, listener, eventType }) => {
        try {
          element.removeEventListener(eventType, listener);
        } catch (error) {
          extensionLoggerContent.error("Error removing event listener", {
            error,
            eventType,
          });
        }
      });
      listenersRef.current = [];
    };
  }, [url]);

  // Monitor video elements on the page
  useEffect(() => {
    if (!skipController) return;

    extensionLoggerContent.info("Setting up video monitoring");

    // Helper function to get duration from video seekable ranges
    const getDurationFromSeekable = (
      video: HTMLVideoElement
    ): number | null => {
      try {
        if (
          video.seekable &&
          video.seekable.length > 0 &&
          video.seekable.end(video.seekable.length - 1) > 0
        ) {
          const duration = video.seekable.end(video.seekable.length - 1);
          extensionLoggerContent.info("Found duration from seekable ranges", {
            duration,
            seekableLength: video.seekable.length,
          });
          return duration;
        }
        return null;
      } catch (error) {
        extensionLoggerContent.debug("Error getting duration from seekable", {
          error,
        });
        return null;
      }
    };

    // Function to set up listeners on a found video element
    const setupVideoElementListeners = (video: HTMLVideoElement) => {
      if (!video || !isMountedRef.current) return null;

      extensionLoggerContent.info("Setting up video listeners", {
        currentTime: video.currentTime,
        duration: video.duration || 0,
        paused: video.paused,
        videoSrc: video.currentSrc || "unknown",
      });

      setVideoElement(video);
      setCurrentTime(video.currentTime);

      // Try to get duration - check video.duration first, then fallbacks
      let initialDuration = video.duration;
      if (!initialDuration || isNaN(initialDuration) || initialDuration <= 0) {
        // If still no duration, try seekable ranges
        if (
          !initialDuration ||
          isNaN(initialDuration) ||
          initialDuration <= 0
        ) {
          const seekableDuration = getDurationFromSeekable(video);
          if (seekableDuration) {
            initialDuration = seekableDuration;
            extensionLoggerContent.info("Using duration from seekable ranges", {
              duration: initialDuration,
            });
          }
        }
      }

      setDuration(initialDuration || 0);

      // Update the skipController's video element reference
      if (skipController) {
        skipController.setVideoElement(video);
      }

      // Clear any previous listeners
      listenersRef.current.forEach(({ element, listener, eventType }) => {
        try {
          element.removeEventListener(eventType, listener);
        } catch {
          // Ignore errors for detached elements
        }
      });

      // Set up time update listener
      const updateTimeListener = () => {
        if (isMountedRef.current) {
          setCurrentTime(video.currentTime);

          // Check if duration is available or needs to be updated
          let detectedDuration = video.duration;
          if (
            !detectedDuration ||
            isNaN(detectedDuration) ||
            detectedDuration <= 0
          ) {
            // Try fallbacks if video.duration is not available
            // Try seekable ranges as fallback
            if (
              !detectedDuration ||
              isNaN(detectedDuration) ||
              detectedDuration <= 0
            ) {
              const seekableDuration = getDurationFromSeekable(video);
              if (seekableDuration) {
                detectedDuration = seekableDuration;
              }
            }
          }

          // Update duration if we have a valid value and it's different
          if (
            detectedDuration &&
            detectedDuration > 0 &&
            detectedDuration !== duration
          ) {
            setDuration(detectedDuration);
          }
        }
      };

      // Set up metadata listener to detect when duration becomes available
      const metadataListener = () => {
        if (isMountedRef.current) {
          let detectedDuration = video.duration;

          // If video.duration is still not available, try fallbacks
          if (
            !detectedDuration ||
            isNaN(detectedDuration) ||
            detectedDuration <= 0
          ) {
            // Try seekable ranges as fallback
            if (
              !detectedDuration ||
              isNaN(detectedDuration) ||
              detectedDuration <= 0
            ) {
              const seekableDuration = getDurationFromSeekable(video);
              if (seekableDuration) {
                detectedDuration = seekableDuration;
              }
            }
          }

          if (detectedDuration && detectedDuration > 0) {
            extensionLoggerContent.info("Video metadata loaded", {
              duration: detectedDuration,
              videoDuration: video.duration,
              readyState: video.readyState,
            });
            setDuration(detectedDuration);
            // Ensure skipController has the correct video element
            if (skipController) {
              skipController.setVideoElement(video);
            }
          }
        }
      };

      // Set up duration change listener (for dynamic duration changes)
      const durationChangeListener = () => {
        if (isMountedRef.current) {
          let detectedDuration = video.duration;

          // If video.duration is still not available, try fallbacks
          if (
            !detectedDuration ||
            isNaN(detectedDuration) ||
            detectedDuration <= 0
          ) {
            // Try seekable ranges as fallback
            if (
              !detectedDuration ||
              isNaN(detectedDuration) ||
              detectedDuration <= 0
            ) {
              const seekableDuration = getDurationFromSeekable(video);
              if (seekableDuration) {
                detectedDuration = seekableDuration;
              }
            }
          }

          if (detectedDuration && detectedDuration > 0) {
            extensionLoggerContent.debug("Video duration changed", {
              duration: detectedDuration,
              videoDuration: video.duration,
            });
            setDuration(detectedDuration);
            // Ensure skipController has the correct video element
            if (skipController) {
              skipController.setVideoElement(video);
            }
          }
        }
      };

      // Set up loadeddata listener (fires when first frame is loaded, sometimes fires before loadedmetadata for blob URLs)
      const loadedDataListener = () => {
        if (isMountedRef.current) {
          let detectedDuration = video.duration;

          // If video.duration is still not available, try fallbacks
          if (
            !detectedDuration ||
            isNaN(detectedDuration) ||
            detectedDuration <= 0
          ) {
            // Try seekable ranges as fallback
            if (
              !detectedDuration ||
              isNaN(detectedDuration) ||
              detectedDuration <= 0
            ) {
              const seekableDuration = getDurationFromSeekable(video);
              if (seekableDuration) {
                detectedDuration = seekableDuration;
              }
            }
          }

          if (detectedDuration && detectedDuration > 0) {
            extensionLoggerContent.debug("Video loadeddata event", {
              duration: detectedDuration,
              videoDuration: video.duration,
              readyState: video.readyState,
            });
            setDuration(detectedDuration);
            // Ensure skipController has the correct video element
            if (skipController) {
              skipController.setVideoElement(video);
            }
          }
        }
      };

      // Set up canplay listener (fires when video can start playing)
      const canPlayListener = () => {
        if (isMountedRef.current) {
          let detectedDuration = video.duration;

          // If video.duration is still not available, try fallbacks
          if (
            !detectedDuration ||
            isNaN(detectedDuration) ||
            detectedDuration <= 0
          ) {
            // Try seekable ranges as fallback
            if (
              !detectedDuration ||
              isNaN(detectedDuration) ||
              detectedDuration <= 0
            ) {
              const seekableDuration = getDurationFromSeekable(video);
              if (seekableDuration) {
                detectedDuration = seekableDuration;
              }
            }
          }

          if (detectedDuration && detectedDuration > 0) {
            extensionLoggerContent.debug("Video canplay event", {
              duration: detectedDuration,
              videoDuration: video.duration,
              readyState: video.readyState,
            });
            setDuration(detectedDuration);
            // Ensure skipController has the correct video element
            if (skipController) {
              skipController.setVideoElement(video);
            }
          }
        }
      };

      // Add all listeners and track them for cleanup
      video.addEventListener("timeupdate", updateTimeListener);
      video.addEventListener("loadedmetadata", metadataListener);
      video.addEventListener("durationchange", durationChangeListener);
      video.addEventListener("loadeddata", loadedDataListener);
      video.addEventListener("canplay", canPlayListener);

      listenersRef.current.push(
        {
          element: video,
          listener: updateTimeListener,
          eventType: "timeupdate",
        },
        {
          element: video,
          listener: metadataListener,
          eventType: "loadedmetadata",
        },
        {
          element: video,
          listener: durationChangeListener,
          eventType: "durationchange",
        },
        {
          element: video,
          listener: loadedDataListener,
          eventType: "loadeddata",
        },
        { element: video, listener: canPlayListener, eventType: "canplay" }
      );

      // If metadata is already loaded, update duration immediately
      if (video.readyState >= 1 && video.duration > 0) {
        setDuration(video.duration);
      } else if (video.readyState >= 2) {
        // Sometimes readyState 2 (HAVE_CURRENT_DATA) has duration even if readyState < 4
        // Check periodically for blob URLs
        let retryCount = 0;
        const maxRetries = 20; // Retry for up to 10 seconds (20 * 500ms)

        const checkDuration = () => {
          if (!isMountedRef.current) return;

          let detectedDuration = video.duration;

          // If video.duration is still not available, try fallbacks
          if (
            !detectedDuration ||
            isNaN(detectedDuration) ||
            detectedDuration <= 0
          ) {
            // Try seekable ranges as fallback
            if (
              !detectedDuration ||
              isNaN(detectedDuration) ||
              detectedDuration <= 0
            ) {
              const seekableDuration = getDurationFromSeekable(video);
              if (seekableDuration) {
                detectedDuration = seekableDuration;
              }
            }
          }

          if (detectedDuration && detectedDuration > 0) {
            extensionLoggerContent.info(
              "Duration available on periodic check",
              {
                duration: detectedDuration,
                videoDuration: video.duration,
                readyState: video.readyState,
                retryCount,
              }
            );
            setDuration(detectedDuration);
            if (skipController) {
              skipController.setVideoElement(video);
            }
          } else if (
            retryCount < maxRetries &&
            isMountedRef.current &&
            video.readyState < 4
          ) {
            // Continue checking if video is still loading
            retryCount++;
            setTimeout(checkDuration, 500);
          } else if (retryCount >= maxRetries) {
            extensionLoggerContent.debug(
              "Stopped retrying duration check after max retries",
              { retryCount, readyState: video.readyState }
            );
          }
        };
        // Check after a short delay to allow blob URL to initialize
        setTimeout(checkDuration, 100);
      }

      return updateTimeListener;
    };

    // Function to periodically check for video elements
    const checkForVideoElement = () => {
      // Common video selectors for streaming platforms (ordered by specificity)
      const videoSelectors = [
        "#hivePlayer1", // Disney+ - specific selector
        "#dv-web-player video", // Prime Video - specific selector
        "#dv-web-player div[class*='atvwebplayersdk-video-surface'] video", // Prime Video - more specific
        ".webPlayerElement video", // Prime Video - legacy selector
        "video.VideoPlayer", // Netflix
        ".player-container video", // Max
        ".player-root video", // Max alternative
        "video", // Generic fallback
      ];

      for (const selector of videoSelectors) {
        const videos = document.querySelectorAll(
          selector
        ) as NodeListOf<HTMLVideoElement>;

        if (videos.length > 0) {
          // Prioritize videos with loaded metadata (readyState >= 1) and valid duration
          const videosWithMetadata = Array.from(videos).filter(
            (v) => v && v.readyState >= 1 && v.duration > 0
          );

          if (videosWithMetadata.length > 0) {
            // Use the video with the highest readyState
            const bestVideo = videosWithMetadata.reduce((best, current) =>
              current.readyState > best.readyState ? current : best
            );

            extensionLoggerContent.info(
              "Found active video element with metadata",
              {
                selector,
                duration: bestVideo.duration,
                currentTime: bestVideo.currentTime,
                paused: bestVideo.paused,
                readyState: bestVideo.readyState,
              }
            );

            setupVideoElementListeners(bestVideo);
            return true;
          }

          // If no video with metadata, find one that might load soon
          for (const video of Array.from(videos)) {
            if (video && document.contains(video)) {
              // Check if video has a src or source elements (likely to load)
              // Include blob URLs which Disney+ uses
              const hasSource =
                video.src ||
                video.currentSrc ||
                video.querySelector("source") !== null;

              // For Disney+ and other platforms using blob URLs, also check if video is in DOM
              // even without explicit src (blob URLs might be set dynamically)
              const isBlobUrl =
                video.src?.startsWith("blob:") ||
                video.currentSrc?.startsWith("blob:");
              const shouldSetupListeners =
                hasSource || isBlobUrl || selector === "#hivePlayer1";

              if (shouldSetupListeners) {
                extensionLoggerContent.info(
                  "Found video element, waiting for metadata",
                  {
                    selector,
                    readyState: video.readyState,
                    hasSrc: !!video.src,
                    hasCurrentSrc: !!video.currentSrc,
                    isBlobUrl,
                    src: video.src?.substring(0, 50) || "none",
                  }
                );

                setupVideoElementListeners(video);

                // Try to trigger metadata loading if not already loading
                // Skip this for blob URLs as they're managed by the player
                if (
                  video.readyState === 0 &&
                  !isBlobUrl &&
                  !video.src &&
                  video.querySelector("source")
                ) {
                  // Video might be waiting to load, try to trigger it
                  try {
                    video.load();
                  } catch {
                    // Ignore errors
                  }
                }

                return true;
              }
            }
          }

          // Fallback: use the first video found (especially for Disney+)
          if (videos[0] && document.contains(videos[0])) {
            const video = videos[0];
            const isBlobUrl =
              video.src?.startsWith("blob:") ||
              video.currentSrc?.startsWith("blob:");
            const isDisneyPlusSelector = selector === "#hivePlayer1";

            // Always set up listeners for Disney+ or videos with blob URLs
            if (
              isDisneyPlusSelector ||
              isBlobUrl ||
              video.src ||
              video.currentSrc
            ) {
              extensionLoggerContent.info("Found video element (fallback)", {
                selector,
                count: videos.length,
                readyState: video.readyState,
                isBlobUrl,
                hasSrc: !!video.src,
                hasCurrentSrc: !!video.currentSrc,
              });

              setupVideoElementListeners(video);
              return true;
            }
          }
        }
      }

      extensionLoggerContent.warn(
        "No video element found with known selectors"
      );
      return false;
    };

    // Initial check
    const foundVideo = checkForVideoElement();

    // If not found immediately, set up a MutationObserver to watch for video elements
    let observer: MutationObserver | null = null;
    let checkTimeout: number | null = null;

    if (!foundVideo) {
      extensionLoggerContent.info(
        "Setting up MutationObserver for video element"
      );

      // Use a debounce to avoid checking too frequently
      const debouncedCheck = () => {
        if (checkTimeout !== null) {
          window.clearTimeout(checkTimeout);
        }
        checkTimeout = window.setTimeout(() => {
          const found = checkForVideoElement();
          if (found && observer) {
            extensionLoggerContent.info("Found video, disconnecting observer");
            observer.disconnect();
            observer = null;
          }
        }, 100); // Debounce checks by 100ms
      };

      observer = new MutationObserver((mutations) => {
        // Check if any added nodes contain video elements
        for (const mutation of mutations) {
          if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            // Check if any added node is a video or contains videos
            for (const node of Array.from(mutation.addedNodes)) {
              if (
                node instanceof HTMLVideoElement ||
                (node instanceof HTMLElement &&
                  node.querySelector("video") !== null)
              ) {
                debouncedCheck();
                return;
              }
            }
          }
          // Also check for attribute changes that might affect video loading
          if (mutation.type === "attributes") {
            debouncedCheck();
          }
        }
      });

      // Start observing the document body for changes
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["src", "data-src"], // Watch for video src changes
      });
    }

    // On unmount
    return () => {
      if (observer) {
        extensionLoggerContent.info("Disconnecting video element observer");
        observer.disconnect();
        observer = null;
      }
      if (checkTimeout !== null) {
        window.clearTimeout(checkTimeout);
        checkTimeout = null;
      }
    };
  }, [skipController, duration]);

  // Set mounted status on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Log video state when it changes (for debugging)
  useEffect(() => {
    if (videoElement) {
      extensionLoggerContent.debug("Video state updated", {
        currentTime,
        duration,
        paused: videoElement.paused,
      });
    }
  }, [videoElement, currentTime, duration]);

  // Define action methods with enhanced error handling
  const skipIntro = useCallback(() => {
    extensionLoggerContent.debug("Attempting to skip intro");
    try {
      return skipController?.skipIntro() || false;
    } catch (error) {
      extensionLoggerContent.error("Error in skipIntro", { error });
      return false;
    }
  }, [skipController]);

  const skipRecap = useCallback(() => {
    extensionLoggerContent.debug("Attempting to skip recap");
    try {
      return skipController?.skipRecap() || false;
    } catch (error) {
      extensionLoggerContent.error("Error in skipRecap", { error });
      return false;
    }
  }, [skipController]);

  const nextEpisode = useCallback(() => {
    extensionLoggerContent.debug("Attempting to go to next episode");
    try {
      return skipController?.nextEpisode() || false;
    } catch (error) {
      extensionLoggerContent.error("Error in nextEpisode", { error });
      return false;
    }
  }, [skipController]);

  const seek10SecondsForward = useCallback(() => {
    extensionLoggerContent.debug("Seeking forward 10s");
    try {
      return skipController?.seek10SecondsForward() || false;
    } catch (error) {
      extensionLoggerContent.error("Error in seek10SecondsForward", { error });
      return false;
    }
  }, [skipController]);

  const seek10SecondsBackward = useCallback(() => {
    extensionLoggerContent.debug("Seeking backward 10s");
    try {
      return skipController?.seek10SecondsBackward() || false;
    } catch (error) {
      extensionLoggerContent.error("Error in seek10SecondsBackward", { error });
      return false;
    }
  }, [skipController]);

  const seekTo = useCallback(
    (time: number) => {
      extensionLoggerContent.debug(`Seeking to specific time: ${time}s`);
      try {
        return skipController?.seekTo(time) || false;
      } catch (error) {
        extensionLoggerContent.error("Error in seekTo", { error, time });
        return false;
      }
    },
    [skipController]
  );

  const seekToPercentage = useCallback(
    (percentage: number) => {
      extensionLoggerContent.debug(`Seeking to ${percentage}0% of video`, {
        percentage,
        duration,
        hasVideoElement: !!videoElement,
        videoDuration: videoElement?.duration,
      });

      // Validate we have what we need
      if (!videoElement) {
        extensionLoggerContent.warn(
          "Cannot seek to percentage, no video element"
        );
        return false;
      }

      // Check for null, undefined, NaN, or non-finite values
      if (
        duration == null ||
        isNaN(duration) ||
        !isFinite(duration) ||
        duration <= 0
      ) {
        extensionLoggerContent.warn(
          "Cannot seek to percentage, no valid duration",
          {
            duration,
            durationType: typeof duration,
            videoDuration: videoElement.duration,
            readyState: videoElement.readyState,
          }
        );
        return false;
      }

      try {
        // Pass the video element and duration directly to ensure we use the correct ones
        return (
          skipController?.seekToPercentage(
            percentage,
            videoElement,
            duration
          ) || false
        );
      } catch (error) {
        extensionLoggerContent.error("Error in seekToPercentage", {
          error,
          percentage,
          duration,
        });
        return false;
      }
    },
    [skipController, videoElement, duration]
  );

  const togglePlay = useCallback(() => {
    extensionLoggerContent.debug("Toggling play/pause state");
    try {
      return skipController?.togglePlay() || false;
    } catch (error) {
      extensionLoggerContent.error("Error in togglePlay", { error });
      return false;
    }
  }, [skipController]);

  // Set up keyboard shortcuts (after callbacks are defined)
  useEffect(() => {
    if (!skipController) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in an input field or similar
      if (
        document.activeElement &&
        (document.activeElement.tagName === "INPUT" ||
          document.activeElement.tagName === "TEXTAREA" ||
          document.activeElement.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      extensionLoggerContent.debug("Key pressed", {
        key: event.key,
        keyCode: event.keyCode,
      });

      switch (event.key) {
        // Existing keyboard shortcuts
        case "s":
          skipIntro();
          break;
        case "n":
          nextEpisode();
          break;
        case "p":
          seek10SecondsForward();
          break;
        case "o":
          seek10SecondsBackward();
          break;
        case "D":
          if (event.shiftKey) {
            // Toggle debug panel is handled elsewhere
          }
          break;
        // Add numeric key handlers for percentage seeking
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9": {
          // Convert string key to number and seek to that percentage
          const percentage = parseInt(event.key, 10);
          extensionLoggerContent.debug(
            `Percentage seek shortcut pressed: ${percentage}`
          );
          seekToPercentage(percentage);
          break;
        }
      }
    };

    // Add the keyboard event listener
    document.addEventListener("keydown", handleKeyDown);

    // Remove the listener on cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    skipController,
    skipIntro,
    skipRecap,
    nextEpisode,
    seek10SecondsForward,
    seek10SecondsBackward,
    seekToPercentage,
  ]);

  // Get feature flags from the controller
  const features = skipController
    ? {
        skipIntro: skipController.isFeatureEnabled("skipIntro"),
        skipRecap: skipController.isFeatureEnabled("skipRecap"),
        nextEpisode: skipController.isFeatureEnabled("nextEpisode"),
        seek10SecondsForward: skipController.isFeatureEnabled(
          "seek10SecondsForward"
        ),
        seek10SecondsBackward: skipController.isFeatureEnabled(
          "seek10SecondsBackward"
        ),
        seekToPercentage: skipController.isFeatureEnabled("seekToPercentage"),
        togglePlay: skipController.isFeatureEnabled("togglePlay"),
      }
    : {
        skipIntro: true,
        skipRecap: true,
        nextEpisode: true,
        seek10SecondsForward: true,
        seek10SecondsBackward: true,
        seekToPercentage: true,
        togglePlay: true,
      };

  return {
    videoElement,
    currentTime,
    duration,
    skipIntro,
    skipRecap,
    nextEpisode,
    seek10SecondsForward,
    seek10SecondsBackward,
    seekTo,
    seekToPercentage,
    togglePlay,
    features,
  };
}

export default useSmartSkip;
