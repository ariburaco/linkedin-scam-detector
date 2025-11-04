export interface PlatformFeatures {
  skipIntro?: boolean;
  skipRecap?: boolean;
  nextEpisode?: boolean;
  seek10SecondsForward?: boolean;
  seek10SecondsBackward?: boolean;
  seekToPercentage?: boolean;
  togglePlay?: boolean;
}

export interface VideoPlatform {
  platform: string;
  selectors: Selector[];
  videoSelector?: string;
  features?: PlatformFeatures;
}

export interface Selector {
  purpose:
    | "skipIntro"
    | "nextEpisode"
    | "previousEpisode"
    | "seek10SecondsForward"
    | "seek10SecondsBackward"
    | "skipRecap";
  type:
    | "innerText"
    | "class"
    | "id"
    | "aria-label"
    | "data-testid"
    | "shadow-dom";
  value: string;
}

export const VIDE_PLATFORMS: VideoPlatform[] = [
  {
    platform: "netflix.com",
    selectors: [
      {
        purpose: "skipIntro",
        type: "aria-label",
        value: "Skip Intro",
      },
      {
        purpose: "skipRecap",
        type: "aria-label",
        value: "Skip Recap",
      },
      {
        purpose: "nextEpisode",
        type: "aria-label",
        value: "Next Episode",
      },
      {
        purpose: "seek10SecondsForward",
        type: "aria-label",
        value: "Seek Forward",
      },
      {
        purpose: "seek10SecondsBackward",
        type: "aria-label",
        value: "Seek Back",
      },
    ],
    videoSelector: "video.VideoPlayer",
    features: {
      skipIntro: true,
      skipRecap: true,
      nextEpisode: true,
      seek10SecondsForward: true,
      seek10SecondsBackward: true,
      seekToPercentage: true,
      togglePlay: true,
    },
  },
  {
    platform: "primevideo.com",
    selectors: [
      {
        purpose: "skipIntro",
        type: "innerText",
        value: "Skip Intro",
      },
      {
        purpose: "skipRecap",
        type: "innerText",
        value: "Skip Recap",
      },
      {
        purpose: "nextEpisode",
        type: "innerText",
        value: "Next Episode",
      },
      {
        purpose: "seek10SecondsForward",
        type: "aria-label",
        value: "Seek Forward 10 seconds",
      },
      {
        purpose: "seek10SecondsBackward",
        type: "aria-label",
        value: "Seek Backward 10 seconds",
      },
    ],
    videoSelector: "#dv-web-player video, .webPlayerElement video",
    features: {
      skipIntro: false, // Prime Video doesn't have skip intro feature
      skipRecap: true,
      nextEpisode: true,
      seek10SecondsForward: true,
      seek10SecondsBackward: true,
      seekToPercentage: true,
      togglePlay: true,
    },
  },
  {
    platform: "max.com",
    selectors: [
      {
        purpose: "skipIntro",
        type: "data-testid",
        value: "player-ux-skip-button",
      },
      {
        purpose: "skipRecap",
        type: "data-testid",
        value: "player-ux-skip-button",
      },
      {
        purpose: "nextEpisode",
        type: "data-testid",
        value: "player-ux-next-episode",
      },
    ],
    videoSelector: "video",
    features: {
      skipIntro: true,
      skipRecap: true,
      nextEpisode: true,
      seek10SecondsForward: true,
      seek10SecondsBackward: true,
      seekToPercentage: true,
      togglePlay: true,
    },
  },
  {
    platform: "disneyplus.com",
    selectors: [
      {
        purpose: "skipIntro",
        type: "shadow-dom",
        value: "div.overlay.overlay__skip > button",
      },
      {
        purpose: "nextEpisode",
        type: "aria-label",
        value: "PLAY NEXT",
      },
      {
        purpose: "seek10SecondsForward",
        type: "aria-label",
        value: "Skip ahead 10 seconds",
      },
      {
        purpose: "seek10SecondsBackward",
        type: "aria-label",
        value: "Skip back 10 seconds",
      },
    ],
    videoSelector: "#hivePlayer1",
    features: {
      skipIntro: true,
      skipRecap: false, // Unknown if Disney+ has skip recap, disable for now
      nextEpisode: true,
      seek10SecondsForward: true,
      seek10SecondsBackward: true,
      seekToPercentage: false, // Cannot get actual video duration for Disney+
      togglePlay: true,
    },
  },
];

class SkipIntro {
  private url: string;
  private currentPlatform: VideoPlatform | undefined;
  private videoElement: HTMLVideoElement | null = null;

  // MutationObserver to detect when skip buttons appear on Max
  private maxObserver: MutationObserver | null = null;

  constructor(url?: string) {
    this.url = url || "";
    if (this.url) {
      this.updateCurrentPlatform();
      this.findVideoElement();

      // Start Max observer if on Max platform
      if (this.currentPlatform?.platform === "max.com") {
        this.setupMaxObserver();
      }
    }
  }

  public init = (url: string): void => {
    this.url = url || this.url;
    this.updateCurrentPlatform();
    this.findVideoElement();

    // Start Max observer if on Max platform
    if (this.currentPlatform?.platform === "max.com") {
      this.setupMaxObserver();
    }
  };

  public setUrl = (url: string): void => {
    this.url = url;
    this.updateCurrentPlatform();
    this.findVideoElement();

    // Start Max observer if on Max platform
    if (this.currentPlatform?.platform === "max.com") {
      this.setupMaxObserver();
    }
  };

  // Get the current video element - for direct access
  public getVideoElement = (): HTMLVideoElement | null => {
    if (!this.videoElement || !document.contains(this.videoElement)) {
      console.log("[SmartSkip] No valid video element, finding a new one");
      this.findVideoElement();
    }
    return this.videoElement;
  };

  // Set the video element (used by React hook when it detects a video)
  public setVideoElement = (video: HTMLVideoElement | null): void => {
    this.videoElement = video;
  };

  /**
   * Check if a feature is enabled for the current platform
   * @param feature Feature name to check
   * @returns boolean indicating if the feature is enabled (defaults to true if not specified)
   */
  public isFeatureEnabled = (feature: keyof PlatformFeatures): boolean => {
    if (!this.currentPlatform?.features) {
      // If no features config, default to enabled
      return true;
    }

    const featureValue = this.currentPlatform.features[feature];
    // Default to true if not explicitly set to false
    return featureValue !== false;
  };

  // Direct method to add seconds to current time - bypasses regular flow
  public directSeek = (secondsOffset: number): boolean => {
    const video = this.getVideoElement();
    if (!video) {
      console.warn("[SmartSkip] Cannot perform direct seek, no video element");
      return false;
    }

    try {
      const currentTime = video.currentTime;
      const newTime = Math.max(
        0,
        Math.min(video.duration || 0, currentTime + secondsOffset)
      );

      console.log(
        `[SmartSkip] Attempting direct seek from ${currentTime}s to ${newTime}s (offset: ${secondsOffset}s)`
      );

      // Netflix-specific handling to avoid security protections
      if (this.currentPlatform?.platform === "netflix.com") {
        console.log("[SmartSkip] Using Netflix-safe seeking approach");
        // Instead of directly modifying currentTime, we'll try to find and use Netflix's built-in seek controls

        // Look for Netflix's seek control buttons
        const forwardButton = document.querySelector(
          'button[aria-label*="forward"]'
        ) as HTMLElement;
        const backwardButton = document.querySelector(
          'button[aria-label*="back"]'
        ) as HTMLElement;

        if (secondsOffset > 0 && forwardButton) {
          // For forward seeking, click the forward button multiple times
          const clicksNeeded = Math.round(secondsOffset / 10); // Netflix usually seeks 10s at a time
          console.log(
            `[SmartSkip] Clicking Netflix forward button ${clicksNeeded} times`
          );

          // Use setTimeout to space out the clicks
          for (let i = 0; i < clicksNeeded; i++) {
            setTimeout(() => {
              forwardButton.click();
              console.log(
                `[SmartSkip] Netflix forward click ${i + 1}/${clicksNeeded}`
              );
            }, i * 100); // 100ms between clicks
          }
          return true;
        } else if (secondsOffset < 0 && backwardButton) {
          // For backward seeking, click the backward button multiple times
          const clicksNeeded = Math.round(Math.abs(secondsOffset) / 10); // Netflix usually seeks 10s at a time
          console.log(
            `[SmartSkip] Clicking Netflix backward button ${clicksNeeded} times`
          );

          // Use setTimeout to space out the clicks
          for (let i = 0; i < clicksNeeded; i++) {
            setTimeout(() => {
              backwardButton.click();
              console.log(
                `[SmartSkip] Netflix backward click ${i + 1}/${clicksNeeded}`
              );
            }, i * 100); // 100ms between clicks
          }
          return true;
        }

        console.warn(
          "[SmartSkip] Could not find Netflix seek buttons, seek not performed"
        );
        return false;
      }
      // For platforms that require a different approach to seeking
      else if (this.currentPlatform?.platform === "primevideo.com") {
        // First check if video is ready for seeking
        if (video.readyState < 1) {
          console.warn(
            "[SmartSkip] Video not ready for seeking, readyState:",
            video.readyState
          );
          return false;
        }

        // For Prime, setting currentTime directly sometimes doesn't work
        // Try adding a little extra to overcome potential buffering issues
        video.currentTime = newTime + 0.1;

        // Verify the seek
        setTimeout(() => {
          if (video && Math.abs(video.currentTime - newTime) > 1) {
            console.warn("[SmartSkip] Direct seek verification failed", {
              requested: newTime,
              actual: video.currentTime,
            });
          } else {
            console.log("[SmartSkip] Direct seek verified successful");
          }
        }, 200);
      } else {
        // Standard approach for other platforms
        video.currentTime = newTime;
      }

      return true;
    } catch (error) {
      console.error("[SmartSkip] Error in direct seek:", error);
      return false;
    }
  };

  /**
   * Seeks to a percentage of the video duration (0-9 for 0%-90%)
   * @param percentage Integer between 0-9 representing percentage in 10% increments
   * @param videoElement Optional video element to use (if not provided, will try to get one)
   * @param videoDuration Optional duration to use (if not provided, will get from video element)
   * @returns boolean indicating if the seek was successful
   */
  public seekToPercentage = (
    percentage: number,
    videoElement?: HTMLVideoElement | null,
    videoDuration?: number
  ): boolean => {
    if (!this.isFeatureEnabled("seekToPercentage")) {
      console.log(
        "[SmartSkip] seekToPercentage feature is disabled for this platform"
      );
      return false;
    }

    // Validate input
    if (percentage < 0 || percentage > 9 || !Number.isInteger(percentage)) {
      console.warn(
        `[SmartSkip] Invalid percentage value: ${percentage}. Expected integer 0-9`
      );
      return false;
    }

    // Use provided video element or try to get one
    let video = videoElement;
    if (!video || !document.contains(video)) {
      video = this.getVideoElement();
    }

    if (!video) {
      console.warn(
        "[SmartSkip] Cannot perform percentage seek, no video element"
      );
      return false;
    }

    // Verify video is still in the DOM
    if (!document.contains(video)) {
      console.warn(
        "[SmartSkip] Video element no longer in DOM, trying to find a new one"
      );
      video = this.getVideoElement();
      if (!video) {
        return false;
      }
    }

    try {
      // Use provided duration or get from video element
      let duration = videoDuration;
      if (!duration || isNaN(duration) || duration <= 0) {
        duration = video.duration;
      }

      // Make sure we have a valid duration (check for null, undefined, NaN, and <= 0)
      if (
        duration == null ||
        isNaN(duration) ||
        !isFinite(duration) ||
        duration <= 0
      ) {
        console.warn(
          "[SmartSkip] Cannot perform percentage seek, no valid duration",
          {
            providedDuration: videoDuration,
            videoDuration: video.duration,
            readyState: video.readyState,
            durationType: typeof duration,
          }
        );
        return false;
      }

      // Calculate target time (percentage * 10% of total duration)
      const targetPercentage = percentage * 0.1; // Convert 0-9 to 0-0.9
      const targetTime = duration * targetPercentage;

      // Validate targetTime is finite before using it
      if (!isFinite(targetTime) || isNaN(targetTime)) {
        console.warn("[SmartSkip] Calculated target time is invalid", {
          percentage,
          duration,
          targetPercentage,
          targetTime,
        });
        return false;
      }

      console.log(
        `[SmartSkip] Seeking to ${percentage}0% (${targetPercentage * 100}%) of video: ${targetTime.toFixed(2)}s of ${duration.toFixed(2)}s`
      );

      // Netflix-specific handling to avoid security protections
      if (this.currentPlatform?.platform === "netflix.com") {
        console.log(
          "[SmartSkip] Using Netflix-safe percentage seeking approach"
        );

        // For percentage seeking on Netflix, we'll:
        // 1. Calculate the difference between current time and target time
        // 2. Use that to determine if we should seek forward or backward
        // 3. Click the appropriate button multiple times or try using the scrubber

        const currentTime = video.currentTime;
        const timeDifference = targetTime - currentTime;

        // Try to find Netflix's scrubber/timeline element first
        const scrubber = document.querySelector(
          ".scrubber-bar,.timeline"
        ) as HTMLElement;
        if (scrubber) {
          console.log(
            "[SmartSkip] Found Netflix scrubber, attempting to use it"
          );
          try {
            // Create and dispatch a click event at the appropriate position
            const rect = scrubber.getBoundingClientRect();
            const clickX = rect.left + rect.width * targetPercentage;
            const clickY = rect.top + rect.height / 2;

            // Try simulating a click at that position
            const clickEvent = new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: clickX,
              clientY: clickY,
            });

            scrubber.dispatchEvent(clickEvent);
            console.log(
              `[SmartSkip] Sent click to Netflix scrubber at position ${targetPercentage * 100}%`
            );
            return true;
          } catch (error) {
            console.error("[SmartSkip] Error using Netflix scrubber:", error);
          }
        }

        // If scrubber approach fails, fall back to button clicks
        if (timeDifference > 0) {
          return this.directSeek(timeDifference); // Will use the Netflix-safe approach
        } else if (timeDifference < 0) {
          return this.directSeek(timeDifference); // Will use the Netflix-safe approach
        } else {
          // Already at the correct position
          return true;
        }
      }

      // Use the same platform-specific logic from seekTo
      if (this.currentPlatform?.platform === "primevideo.com") {
        if (video.readyState < 1) {
          console.warn(
            "[SmartSkip] Video not ready for percentage seeking, readyState:",
            video.readyState
          );
          return false;
        }
        // Add a small offset for Prime Video to help with seeking precision
        // Clamp the target time to valid range
        const clampedTime = Math.max(0, Math.min(duration, targetTime + 0.1));
        // Double-check clampedTime is finite before setting
        if (!isFinite(clampedTime) || isNaN(clampedTime)) {
          console.warn("[SmartSkip] Clamped time is invalid, cannot seek", {
            targetTime,
            duration,
            clampedTime,
          });
          return false;
        }
        video.currentTime = clampedTime;
      } else {
        // Clamp the target time to valid range
        const clampedTime = Math.max(0, Math.min(duration, targetTime));
        // Double-check clampedTime is finite before setting
        if (!isFinite(clampedTime) || isNaN(clampedTime)) {
          console.warn("[SmartSkip] Clamped time is invalid, cannot seek", {
            targetTime,
            duration,
            clampedTime,
          });
          return false;
        }
        video.currentTime = clampedTime;
      }

      return true;
    } catch (error) {
      console.error("[SmartSkip] Error in percentage seek:", error);
      return false;
    }
  };

  private updateCurrentPlatform = (): void => {
    const platformHost = this.getPlatformHost();
    this.currentPlatform = VIDE_PLATFORMS.find(
      (videoPlatform) => videoPlatform.platform === platformHost
    );
  };

  private getPlatformHost = (): string => {
    const urlObj = new URL(this.url);
    const hostname = urlObj.hostname;

    // Special case for Max which uses play.max.com
    if (hostname.includes("max.com")) {
      return "max.com";
    }

    return hostname.replace("www.", "");
  };

  /**
   * Finds the video element on the page using the platform's video selector
   */
  private findVideoElement = (): void => {
    // First check if we already have a valid video element
    if (this.videoElement && document.contains(this.videoElement)) {
      console.log(
        "[SmartSkip] Using existing video element",
        this.videoElement
      );
      return;
    }

    // If no platform is found, try generic video selector
    if (!this.currentPlatform?.videoSelector) {
      console.log(
        "[SmartSkip] No platform-specific selector, trying generic selectors"
      );
      const genericSelectors = [
        ".webPlayerElement video", // Prime Video
        "video.VideoPlayer", // Netflix
        ".player-container video", // Max
        ".player-root video", // Max alternative
        "video", // Generic fallback
      ];

      for (const selector of genericSelectors) {
        const video = document.querySelector(selector) as HTMLVideoElement;
        if (video) {
          console.log(
            `[SmartSkip] Found video with generic selector: ${selector}`,
            video
          );
          this.videoElement = video;
          return;
        }
      }

      this.videoElement = null;
      console.warn("[SmartSkip] No video element found with any selector");
      return;
    }

    // Try platform-specific selector
    try {
      const videoElement = document.querySelector(
        this.currentPlatform.videoSelector
      ) as HTMLVideoElement;

      if (videoElement) {
        console.log(
          `[SmartSkip] Found video with platform selector: ${this.currentPlatform.videoSelector}`,
          videoElement
        );
        this.videoElement = videoElement;
      } else {
        console.log(
          `[SmartSkip] Video not found with platform selector: ${this.currentPlatform.videoSelector}, will retry`
        );
        // If not found immediately, try again after a short delay (video might be loading)
        setTimeout(() => {
          // Try again with platform selector
          const retryVideo = document.querySelector(
            this.currentPlatform?.videoSelector!
          ) as HTMLVideoElement;

          if (retryVideo) {
            console.log("[SmartSkip] Found video on retry", retryVideo);
            this.videoElement = retryVideo;
          } else {
            // Fallback to generic video selector
            console.log("[SmartSkip] Retry failed, trying generic video tag");

            // For Max, try special selectors first
            if (this.currentPlatform?.platform === "max.com") {
              const maxSelectors = [
                ".player-container video",
                ".player-root video",
              ];

              for (const selector of maxSelectors) {
                const maxVideo = document.querySelector(
                  selector
                ) as HTMLVideoElement;
                if (maxVideo) {
                  console.log(
                    `[SmartSkip] Found Max video with selector: ${selector}`,
                    maxVideo
                  );
                  this.videoElement = maxVideo;
                  return;
                }
              }
            }

            // If all else fails, try the generic video tag
            this.videoElement = document.querySelector(
              "video"
            ) as HTMLVideoElement;

            if (this.videoElement) {
              console.log(
                "[SmartSkip] Found generic video element",
                this.videoElement
              );
            } else {
              console.warn(
                "[SmartSkip] No video element found after all attempts"
              );
            }
          }
        }, 1000);
      }
    } catch (error) {
      console.error("[SmartSkip] Error finding video element:", error);
      this.videoElement = null;
    }
  };

  /**
   * Special handler for finding Max platform skip buttons
   * Since Max uses the same data-testid for both skip intro and skip recap,
   * we need to check the button text content to distinguish between them
   */
  private findMaxSkipButton = (
    purpose: "skipIntro" | "skipRecap"
  ): HTMLElement | null => {
    if (this.currentPlatform?.platform !== "max.com") {
      return null;
    }

    try {
      // First try using data-testid
      const allSkipButtons = document.querySelectorAll(
        'button[data-testid="player-ux-skip-button"]'
      );

      console.log(
        `[SmartSkip] Found ${allSkipButtons.length} Max skip buttons`
      );

      if (allSkipButtons.length === 0) {
        return null;
      }

      // Check each button's text content to determine its purpose
      for (const button of Array.from(allSkipButtons)) {
        const buttonText = button.textContent?.toLowerCase() || "";

        if (purpose === "skipIntro" && buttonText.includes("intro")) {
          console.log("[SmartSkip] Found Max skip intro button:", button);
          return button as HTMLElement;
        }

        if (purpose === "skipRecap" && buttonText.includes("recap")) {
          console.log("[SmartSkip] Found Max skip recap button:", button);
          return button as HTMLElement;
        }
      }

      // If we reached here, we found skip buttons but none matching our purpose
      console.log(`[SmartSkip] No Max ${purpose} button found in text content`);
      return null;
    } catch (error) {
      console.error("[SmartSkip] Error finding Max skip button:", error);
      return null;
    }
  };

  /**
   * Special handler for finding Disney+ skip intro button in shadow DOM
   */
  private findDisneyPlusSkipButton = (): HTMLElement | null => {
    if (this.currentPlatform?.platform !== "disneyplus.com") {
      return null;
    }

    try {
      // Find the disney-web-player-ui element
      const playerUi = document.querySelector("disney-web-player-ui");
      if (!playerUi) {
        console.log("[SmartSkip] Disney+ player UI element not found");
        return null;
      }

      // Access shadow root
      const shadowRoot = playerUi.shadowRoot;
      if (!shadowRoot) {
        console.log("[SmartSkip] Disney+ shadow root not accessible");
        return null;
      }

      // Find skip button in shadow DOM
      const skipButton = shadowRoot.querySelector(
        "div.overlay.overlay__skip > button"
      ) as HTMLElement;

      if (skipButton) {
        console.log(
          "[SmartSkip] Found Disney+ skip intro button in shadow DOM:",
          skipButton
        );
        return skipButton;
      }

      console.log(
        "[SmartSkip] Disney+ skip intro button not found in shadow DOM"
      );
      return null;
    } catch (error) {
      console.error("[SmartSkip] Error finding Disney+ skip button:", error);
      return null;
    }
  };

  /**
   * Generic method to find button in shadow DOM
   * @param selector CSS selector within shadow DOM
   * @returns HTMLElement or null
   */
  private findButtonInShadowDom = (selector: string): HTMLElement | null => {
    try {
      // Find the disney-web-player-ui element
      const playerUi = document.querySelector("disney-web-player-ui");
      if (!playerUi) {
        console.log("[SmartSkip] Shadow DOM host element not found");
        return null;
      }

      // Access shadow root
      const shadowRoot = playerUi.shadowRoot;
      if (!shadowRoot) {
        console.log("[SmartSkip] Shadow root not accessible");
        return null;
      }

      // Find button in shadow DOM
      const button = shadowRoot.querySelector(selector) as HTMLElement;

      if (button) {
        console.log(
          `[SmartSkip] Found button in shadow DOM with selector "${selector}":`,
          button
        );
        return button;
      }

      console.log(
        `[SmartSkip] Button not found in shadow DOM with selector "${selector}"`
      );
      return null;
    } catch (error) {
      console.error("[SmartSkip] Error finding button in shadow DOM:", error);
      return null;
    }
  };

  /**
   * Generic method to perform an action based on purpose
   * @param purpose The action purpose to execute
   * @returns boolean indicating if action was performed
   */
  private performAction = (purpose: Selector["purpose"]): boolean => {
    if (!this.currentPlatform) {
      console.warn("[SmartSkip] No platform detected for:", this.url);
      return false;
    }

    // Special handling for Max platform
    if (this.currentPlatform.platform === "max.com") {
      if (purpose === "skipIntro" || purpose === "skipRecap") {
        const skipButton = this.findMaxSkipButton(purpose);
        if (skipButton) {
          console.log(
            `[SmartSkip] Clicking Max ${purpose} button:`,
            skipButton
          );
          skipButton.click();
          return true;
        }
      }
    }

    // Special handling for Disney+ shadow DOM
    if (this.currentPlatform.platform === "disneyplus.com") {
      if (purpose === "skipIntro") {
        const skipButton = this.findDisneyPlusSkipButton();
        if (skipButton) {
          console.log(
            `[SmartSkip] Clicking Disney+ ${purpose} button:`,
            skipButton
          );
          skipButton.click();
          return true;
        }
      }
    }

    // First try to use the button-based approach
    const selector = this.currentPlatform.selectors.find(
      (s) => s.purpose === purpose
    );

    if (selector) {
      console.log(
        `[SmartSkip] Found selector for purpose: ${purpose}`,
        selector
      );

      // Special handling for Max platform - need to check text content
      if (
        this.currentPlatform.platform === "max.com" &&
        (purpose === "skipIntro" || purpose === "skipRecap")
      ) {
        const skipButton = this.findButtonBySelector(selector);

        if (skipButton) {
          const buttonText = skipButton.textContent?.toLowerCase() || "";
          console.log(`[SmartSkip] Max skip button text: "${buttonText}"`);

          // For Skip Intro, only click if it contains "intro"
          // if (purpose === "skipIntro" && !buttonText.includes("intro")) {
          //   console.log(
          //     "[SmartSkip] Skip button found but it's not for intro, skipping action",
          //   );
          //   return false;
          // }

          // // For Skip Recap, only click if it contains "recap"
          // if (purpose === "skipRecap" && !buttonText.includes("recap")) {
          //   console.log(
          //     "[SmartSkip] Skip button found but it's not for recap, skipping action",
          //   );
          //   return false;
          // }

          console.log(
            `[SmartSkip] Clicking ${purpose} button on Max:`,
            skipButton
          );
          skipButton.click();
          return true;
        }
      } else {
        // Normal handling for other platforms
        const actionButton = this.findButtonBySelector(selector);
        if (actionButton) {
          console.log(
            `[SmartSkip] Found button for ${purpose}, clicking:`,
            actionButton
          );
          actionButton.click();
          return true;
        } else {
          console.log(
            `[SmartSkip] No button found for ${purpose}, will try video element`
          );
        }
      }
    }

    // If button approach fails, try using the video element directly
    console.log(`[SmartSkip] Trying video action for ${purpose}`);
    return this.performVideoAction(purpose);
  };

  /**
   * Performs an action directly on the video element
   * @param purpose The action to perform
   * @returns boolean indicating if action was performed
   */
  private performVideoAction = (purpose: Selector["purpose"]): boolean => {
    // Make sure we have the most up-to-date video element
    if (!this.videoElement || !document.contains(this.videoElement)) {
      console.log("[SmartSkip] No video element, trying to find one");
      this.findVideoElement();
    }

    if (!this.videoElement) {
      console.warn(
        "[SmartSkip] Cannot perform video action, no video element found"
      );
      return false;
    }

    try {
      console.log(
        `[SmartSkip] Performing video action: ${purpose} on`,
        this.videoElement
      );

      switch (purpose) {
        case "seek10SecondsForward":
          // Use the direct seek method which has special handling for Prime Video
          return this.directSeek(10);

        case "seek10SecondsBackward":
          // Use the direct seek method which has special handling for Prime Video
          return this.directSeek(-10);

        case "skipIntro":
          // Typically intro is within the first few minutes, skip ahead by 90 seconds
          if (this.videoElement.currentTime < 180) {
            const skipTime = this.videoElement.currentTime + 90;
            console.log(
              `[SmartSkip] Skipping intro from ${this.videoElement.currentTime} to ${skipTime}`
            );
            this.videoElement.currentTime = skipTime;
            return true;
          }
          console.log(
            "[SmartSkip] Not skipping intro, already past intro point"
          );
          return false;

        case "skipRecap":
          // Recap is often at the beginning, skip ahead by 60 seconds
          if (this.videoElement.currentTime < 120) {
            const skipTime = this.videoElement.currentTime + 60;
            console.log(
              `[SmartSkip] Skipping recap from ${this.videoElement.currentTime} to ${skipTime}`
            );
            this.videoElement.currentTime = skipTime;
            return true;
          }
          console.log(
            "[SmartSkip] Not skipping recap, already past recap point"
          );
          return false;

        case "nextEpisode":
          // Can't directly control episode navigation through video element
          // But we could try to skip to end of video which might trigger next episode
          if (this.videoElement.duration) {
            const skipToEnd = this.videoElement.duration - 1;
            console.log(
              `[SmartSkip] Trying next episode by skipping to ${skipToEnd}`
            );
            this.videoElement.currentTime = skipToEnd;
            return true;
          }
          console.log(
            "[SmartSkip] Cannot skip to next episode, no duration available"
          );
          return false;

        default:
          console.log(`[SmartSkip] Unsupported purpose: ${purpose}`);
          return false;
      }
    } catch (error) {
      console.error(
        `[SmartSkip] Error performing video action: ${purpose}`,
        error
      );
      return false;
    }
  };

  private findButtonBySelector = (selector: Selector): HTMLElement | null => {
    const { type, value } = selector;
    const allButtons = document.querySelectorAll("button");
    console.log(
      `[SmartSkip] Looking for button with ${type}="${value}" among ${allButtons.length} buttons`
    );

    try {
      switch (type) {
        case "innerText":
          const textButton = Array.from(allButtons).find((button) =>
            button.innerText.toLowerCase().includes(value.toLowerCase())
          );
          if (textButton)
            console.log("[SmartSkip] Found button by innerText:", textButton);
          return textButton || null;

        case "class":
          const classButton = Array.from(allButtons).find((button) =>
            button.classList.contains(value.toLowerCase())
          );
          if (classButton)
            console.log("[SmartSkip] Found button by class:", classButton);
          return classButton || null;

        case "id":
          const idButton = Array.from(allButtons).find((button) =>
            button.id.toLowerCase().includes(value.toLowerCase())
          );
          if (idButton)
            console.log("[SmartSkip] Found button by id:", idButton);
          return idButton || null;

        case "aria-label":
          const ariaButton = Array.from(allButtons).find((button) => {
            const ariaLabel = button.getAttribute("aria-label");
            return (
              ariaLabel?.toLowerCase().includes(value.toLowerCase()) || false
            );
          });
          if (ariaButton)
            console.log("[SmartSkip] Found button by aria-label:", ariaButton);
          return ariaButton || null;

        case "data-testid":
          // First try with button[data-testid="value"]
          const testIdButton = document.querySelector(
            `button[data-testid="${value}"]`
          ) as HTMLElement;

          if (testIdButton) {
            console.log(
              "[SmartSkip] Found button by data-testid:",
              testIdButton
            );
            return testIdButton;
          }

          // If not found, check all buttons
          const testIdButtonFromAll = Array.from(allButtons).find((button) => {
            return button.getAttribute("data-testid") === value;
          });

          if (testIdButtonFromAll) {
            console.log(
              "[SmartSkip] Found button by data-testid from all buttons:",
              testIdButtonFromAll
            );
            return testIdButtonFromAll;
          }

          console.log(
            `[SmartSkip] No button found with data-testid="${value}"`
          );
          return null;

        case "shadow-dom":
          // Handle shadow DOM traversal for Disney+
          return this.findButtonInShadowDom(value);

        default:
          console.warn(`[SmartSkip] Unsupported selector type: ${type}`);
          return null;
      }
    } catch (error) {
      console.error("[SmartSkip] Error finding button:", error);
      return null;
    }
  };

  /**
   * Gets the video element's current time
   * @returns current playback time in seconds
   */
  public getCurrentTime = (): number => {
    if (!this.videoElement || !document.contains(this.videoElement)) {
      console.log(
        "[SmartSkip] Video element not found for getCurrentTime, trying to find it"
      );
      this.findVideoElement();
      if (!this.videoElement) return 0;
    }

    try {
      return this.videoElement.currentTime;
    } catch (error) {
      console.error("[SmartSkip] Error getting current time:", error);
      return 0;
    }
  };

  /**
   * Gets the video element's duration
   * @returns total duration in seconds
   */
  public getDuration = (): number => {
    if (!this.videoElement || !document.contains(this.videoElement)) {
      console.log(
        "[SmartSkip] Video element not found for getDuration, trying to find it"
      );
      this.findVideoElement();
      if (!this.videoElement) return 0;
    }

    try {
      return this.videoElement.duration || 0;
    } catch (error) {
      console.error("[SmartSkip] Error getting duration:", error);
      return 0;
    }
  };

  /**
   * Seeks to a specific time in the video
   * @param time Time in seconds to seek to
   * @returns boolean indicating if the seek was successful
   */
  public seekTo = (time: number): boolean => {
    if (!this.videoElement || !document.contains(this.videoElement)) {
      console.log(
        "[SmartSkip] Video element not found for seekTo, trying to find it"
      );
      this.findVideoElement();
      if (!this.videoElement) {
        console.warn("[SmartSkip] Cannot seek, no video element found");
        return false;
      }
    }

    try {
      console.log(
        `[SmartSkip] Seeking to ${time}s from ${this.videoElement.currentTime}s`
      );

      // Clamp time to valid range
      const clampedTime = Math.max(
        0,
        Math.min(this.videoElement.duration || Infinity, time)
      );

      // Netflix-specific handling
      if (this.currentPlatform?.platform === "netflix.com") {
        console.log("[SmartSkip] Using Netflix-safe seeking for seekTo");

        // Calculate difference between current and target time
        const timeDifference = clampedTime - this.videoElement.currentTime;

        // Try to find Netflix's scrubber/timeline element first
        const scrubber = document.querySelector(
          ".scrubber-bar,.timeline"
        ) as HTMLElement;
        if (scrubber) {
          console.log(
            "[SmartSkip] Found Netflix scrubber, attempting to use it for direct seek"
          );
          try {
            // Create and dispatch a click event at the appropriate position
            const rect = scrubber.getBoundingClientRect();
            const percentage = clampedTime / (this.videoElement.duration || 1);
            const clickX = rect.left + rect.width * percentage;
            const clickY = rect.top + rect.height / 2;

            // Try simulating a click at that position
            const clickEvent = new MouseEvent("click", {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: clickX,
              clientY: clickY,
            });

            scrubber.dispatchEvent(clickEvent);
            console.log(
              `[SmartSkip] Sent click to Netflix scrubber at position ${(percentage * 100).toFixed(1)}%`
            );
            return true;
          } catch (error) {
            console.error("[SmartSkip] Error using Netflix scrubber:", error);
          }
        }

        // If scrubber approach fails, use directSeek which has Netflix-safe handling
        return this.directSeek(timeDifference);
      }
      // For Amazon Prime, we need special handling
      else if (this.currentPlatform?.platform === "primevideo.com") {
        if (this.videoElement.readyState < 1) {
          console.warn(
            "[SmartSkip] Video not ready for seeking, readyState:",
            this.videoElement.readyState
          );
        }
        // Add a small offset to help with precision issues
        this.videoElement.currentTime = clampedTime + 0.1;
      } else {
        this.videoElement.currentTime = clampedTime;
      }

      return true;
    } catch (error) {
      console.error("[SmartSkip] Error seeking to time:", error);
      return false;
    }
  };

  /**
   * Toggles play/pause state of the video
   * @returns boolean indicating the new play state (true = playing, false = paused)
   */
  public togglePlay = (): boolean => {
    if (!this.isFeatureEnabled("togglePlay")) {
      console.log(
        "[SmartSkip] togglePlay feature is disabled for this platform"
      );
      return false;
    }

    if (!this.videoElement || !document.contains(this.videoElement)) {
      console.log(
        "[SmartSkip] Video element not found for togglePlay, trying to find it"
      );
      this.findVideoElement();
      if (!this.videoElement) {
        console.warn("[SmartSkip] Cannot toggle play, no video element found");
        return false;
      }
    }

    try {
      if (this.videoElement.paused) {
        console.log("[SmartSkip] Playing video");
        this.videoElement.play();
        return true;
      } else {
        console.log("[SmartSkip] Pausing video");
        this.videoElement.pause();
        return false;
      }
    } catch (error) {
      console.error("[SmartSkip] Error toggling play state:", error);
      return false;
    }
  };

  // Public action methods
  public skipIntro = (): boolean => {
    if (!this.isFeatureEnabled("skipIntro")) {
      console.log(
        "[SmartSkip] skipIntro feature is disabled for this platform"
      );
      return false;
    }
    return this.performAction("skipIntro");
  };

  public skipRecap = (): boolean => {
    if (!this.isFeatureEnabled("skipRecap")) {
      console.log(
        "[SmartSkip] skipRecap feature is disabled for this platform"
      );
      return false;
    }
    return this.performAction("skipRecap");
  };

  public nextEpisode = (): boolean => {
    if (!this.isFeatureEnabled("nextEpisode")) {
      console.log(
        "[SmartSkip] nextEpisode feature is disabled for this platform"
      );
      return false;
    }
    return this.performAction("nextEpisode");
  };

  public seek10SecondsForward = (): boolean => {
    if (!this.isFeatureEnabled("seek10SecondsForward")) {
      console.log(
        "[SmartSkip] seek10SecondsForward feature is disabled for this platform"
      );
      return false;
    }
    // Use the new direct seek method for more reliable seeking
    return this.directSeek(10);
  };

  public seek10SecondsBackward = (): boolean => {
    if (!this.isFeatureEnabled("seek10SecondsBackward")) {
      console.log(
        "[SmartSkip] seek10SecondsBackward feature is disabled for this platform"
      );
      return false;
    }
    // Use the new direct seek method for more reliable seeking
    return this.directSeek(-10);
  };

  /**
   * Set up a MutationObserver to watch for Max's skip buttons which appear dynamically
   */
  private setupMaxObserver = (): void => {
    // Only set up once and only for Max
    if (this.maxObserver || this.currentPlatform?.platform !== "max.com") {
      return;
    }

    try {
      console.log("[SmartSkip] Setting up Max MutationObserver");

      // Create the observer
      this.maxObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            // Check if any added nodes contain skip buttons
            for (const node of Array.from(mutation.addedNodes)) {
              if (node instanceof HTMLElement) {
                const skipButtons = node.querySelectorAll(
                  '[data-testid="player-ux-skip-button"]'
                );

                if (skipButtons.length > 0) {
                  console.log(
                    "[SmartSkip] Max skip button detected in DOM changes:",
                    skipButtons
                  );

                  // Check if it's an intro or recap button
                  for (const button of Array.from(skipButtons)) {
                    const text = button.textContent?.toLowerCase() || "";
                    if (text.includes("intro")) {
                      console.log(
                        "[SmartSkip] Skip intro button appeared, auto-clicking"
                      );
                      (button as HTMLElement).click();
                    } else if (text.includes("recap")) {
                      console.log(
                        "[SmartSkip] Skip recap button appeared, auto-clicking"
                      );
                      (button as HTMLElement).click();
                    }
                  }
                }
              }
            }
          }
        }
      });

      // Start observing the document body for changes
      this.maxObserver.observe(document.body, {
        childList: true,
        subtree: true,
      });

      console.log("[SmartSkip] Max observer started");
    } catch (error) {
      console.error("[SmartSkip] Error setting up Max observer:", error);
    }
  };

  /**
   * Clean up resources when the controller is no longer needed
   */
  public cleanup = (): void => {
    // Disconnect the Max observer if it exists
    if (this.maxObserver) {
      console.log("[SmartSkip] Disconnecting Max observer");
      this.maxObserver.disconnect();
      this.maxObserver = null;
    }
  };
}

export default SkipIntro;
