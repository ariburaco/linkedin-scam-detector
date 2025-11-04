import NetflixSkip from "./netflix-skip";
import SkipIntro from "./smart-skip";

/**
 * Factory function to create the appropriate skip controller based on the platform
 * @param url The current URL to determine the platform
 * @returns The appropriate skip controller for the platform
 */
export function createSkipController(url: string): SkipIntro {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.replace("www.", "");

    // Check if we're on Netflix
    if (hostname.includes("netflix.com")) {
      console.log("[SkipFactory] Creating Netflix-specific controller");
      return new NetflixSkip(url);
    }

    // Default to the standard controller for other platforms
    console.log(`[SkipFactory] Creating standard controller for ${hostname}`);
    return new SkipIntro(url);
  } catch (error) {
    console.error("[SkipFactory] Error creating controller:", error);
    // Fallback to standard controller
    return new SkipIntro(url);
  }
}

export default createSkipController;
