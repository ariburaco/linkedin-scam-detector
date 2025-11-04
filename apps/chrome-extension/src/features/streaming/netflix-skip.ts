import SkipIntro from "./smart-skip";

import { extensionLoggerContent } from "@/shared/loggers";

// Netflix's API interfaces
interface NetflixVideoPlayer {
  getVideoPlayerBySessionId: (sessionId: string) => NetflixPlayer;
  getAllPlayerSessionIds: () => string[];
}

interface NetflixPlayer {
  seek: (timeMs: number) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  play: () => void;
  pause: () => void;
  isPlaying: () => boolean;
}

interface NetflixPlayerApp {
  getAPI: () => { videoPlayer: NetflixVideoPlayer };
}

interface NetflixState {
  playerApp: NetflixPlayerApp;
}

interface NetflixAppContext {
  state: NetflixState;
}

// Declare global Netflix object
declare global {
  interface Window {
    netflix?: {
      appContext: NetflixAppContext;
    };
  }
}

/**
 * Extended Netflix-specific implementation of SkipIntro that leverages Netflix's internal API
 */
class NetflixSkip extends SkipIntro {
  // Internal reference to Netflix player
  private netflixPlayer: NetflixPlayer | null = null;

  constructor(url?: string) {
    super(url);
    this.initNetflixPlayer();
  }

  /**
   * Initialize the Netflix player API
   */
  private initNetflixPlayer = (): void => {
    extensionLoggerContent.info(
      "[NetflixSkip] Initializing Netflix player API"
    );
    try {
      if (window.netflix?.appContext?.state?.playerApp) {
        const videoPlayer =
          window.netflix.appContext.state.playerApp.getAPI().videoPlayer;
        const sessionIds = videoPlayer.getAllPlayerSessionIds();

        if (sessionIds && sessionIds.length > 0) {
          this.netflixPlayer = videoPlayer.getVideoPlayerBySessionId(
            sessionIds[0]
          );
          extensionLoggerContent.info(
            "[NetflixSkip] Successfully initialized Netflix player API"
          );
        } else {
          extensionLoggerContent.info(
            "[NetflixSkip] No player session IDs available"
          );
        }
      } else {
        extensionLoggerContent.info(
          "[NetflixSkip] Netflix API not available yet"
        );

        // Try again in a moment as Netflix might initialize its player later
        setTimeout(() => {
          this.initNetflixPlayer();
        }, 1000);
      }
    } catch (error) {
      extensionLoggerContent.error(
        "[NetflixSkip] Error initializing Netflix player:",
        error
      );
    }
  };

  /**
   * Check if Netflix API is available and re-initialize if needed
   */
  private ensureNetflixPlayer = (): NetflixPlayer | null => {
    if (!this.netflixPlayer) {
      this.initNetflixPlayer();
    }
    return this.netflixPlayer;
  };

  /**
   * Override the direct seek method to use Netflix's API
   */
  public directSeek = (secondsOffset: number): boolean => {
    try {
      const player = this.ensureNetflixPlayer();

      if (player) {
        // Netflix API uses milliseconds
        const currentTimeMs = player.getCurrentTime();
        const newTimeMs = currentTimeMs + secondsOffset * 1000;

        extensionLoggerContent.info(
          `[NetflixSkip] Seeking from ${currentTimeMs}ms to ${newTimeMs}ms via Netflix API`
        );

        player.seek(newTimeMs);
        return true;
      } else {
        extensionLoggerContent.info(
          "[NetflixSkip] Netflix player API not available, falling back to default method"
        );
        // Use the original implementation
        return SkipIntro.prototype.directSeek.call(this, secondsOffset);
      }
    } catch (error) {
      extensionLoggerContent.info(
        "[NetflixSkip] Error using Netflix API for seek:",
        error
      );
      extensionLoggerContent.info(
        "[NetflixSkip] Falling back to default method"
      );
      // Use the original implementation
      return SkipIntro.prototype.directSeek.call(this, secondsOffset);
    }
  };

  /**
   * Override seekToPercentage to use Netflix's API
   */
  public seekToPercentage = (percentage: number): boolean => {
    try {
      const player = this.ensureNetflixPlayer();

      if (player) {
        // Validate input
        if (percentage < 0 || percentage > 9 || !Number.isInteger(percentage)) {
          extensionLoggerContent.info(
            `[NetflixSkip] Invalid percentage value: ${percentage}. Expected integer 0-9`
          );
          return false;
        }

        // Calculate target time
        const targetPercentage = percentage * 0.1; // Convert 0-9 to 0-0.9
        const durationMs = player.getDuration();
        const targetTimeMs = durationMs * targetPercentage;

        extensionLoggerContent.info(
          `[NetflixSkip] Seeking to ${percentage}0% of video (${targetTimeMs}ms of ${durationMs}ms) via Netflix API`
        );

        player.seek(targetTimeMs);
        return true;
      } else {
        extensionLoggerContent.info(
          "[NetflixSkip] Netflix player API not available, falling back to default method"
        );
        // Use the original implementation
        return SkipIntro.prototype.seekToPercentage.call(this, percentage);
      }
    } catch (error) {
      extensionLoggerContent.info(
        "[NetflixSkip] Error using Netflix API for percentage seek:",
        error
      );
      extensionLoggerContent.info(
        "[NetflixSkip] Falling back to default method"
      );
      // Use the original implementation
      return SkipIntro.prototype.seekToPercentage.call(this, percentage);
    }
  };

  /**
   * Override seekTo to use Netflix's API
   */
  public seekTo = (time: number): boolean => {
    try {
      const player = this.ensureNetflixPlayer();

      if (player) {
        // Convert seconds to milliseconds for Netflix API
        const timeMs = time * 1000;
        extensionLoggerContent.info(
          `[NetflixSkip] Seeking to ${timeMs}ms via Netflix API`
        );

        player.seek(timeMs);
        return true;
      } else {
        extensionLoggerContent.info(
          "[NetflixSkip] Netflix player API not available, falling back to default method"
        );
        // Use the original implementation
        return SkipIntro.prototype.seekTo.call(this, time);
      }
    } catch (error) {
      extensionLoggerContent.info(
        "[NetflixSkip] Error using Netflix API for seekTo:",
        error
      );
      extensionLoggerContent.info(
        "[NetflixSkip] Falling back to default method"
      );
      // Use the original implementation
      return SkipIntro.prototype.seekTo.call(this, time);
    }
  };

  /**
   * Override togglePlay to use Netflix's API
   */
  public togglePlay = (): boolean => {
    try {
      const player = this.ensureNetflixPlayer();

      if (player) {
        const isPlaying = player.isPlaying();

        if (isPlaying) {
          extensionLoggerContent.info(
            "[NetflixSkip] Pausing video via Netflix API"
          );
          player.pause();
          return false;
        } else {
          extensionLoggerContent.info(
            "[NetflixSkip] Playing video via Netflix API"
          );
          player.play();
          return true;
        }
      } else {
        extensionLoggerContent.info(
          "[NetflixSkip] Netflix player API not available, falling back to default method"
        );
        // Use the original implementation
        return SkipIntro.prototype.togglePlay.call(this);
      }
    } catch (error) {
      extensionLoggerContent.info(
        "[NetflixSkip] Error using Netflix API for togglePlay:",
        error
      );
      extensionLoggerContent.info(
        "[NetflixSkip] Falling back to default method"
      );
      // Use the original implementation
      return SkipIntro.prototype.togglePlay.call(this);
    }
  };
}

export default NetflixSkip;
