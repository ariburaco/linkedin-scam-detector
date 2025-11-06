/**
 * Browser Manager
 * Manages Puppeteer browser instances with stealth configuration
 * Supports both local browser instances and Browserless WebSocket connections
 */

import type { Browser, Page } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { env } from "@acme/shared/env";
import { Logger } from "@acme/shared/Logger";

import type { BrowserConfig } from "./types";

const logger = new Logger("BrowserManager");

// Add stealth plugin
puppeteer.use(StealthPlugin());

export class BrowserManager {
  private browser: Browser | null = null;
  private config: BrowserConfig;
  private isClosing = false;
  private browserlessWsUrl: string | null = null;

  constructor(config?: BrowserConfig) {
    this.config = {
      headless: env.SCRAPER_HEADLESS ?? true,
      timeout: env.SCRAPER_TIMEOUT ?? 30000,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920,1080",
        "--disable-blink-features=AutomationControlled",
      ],
      ...config,
    };

    // Check for Browserless WebSocket URL
    if (env.BROWSERLESS_WS_URL) {
      this.browserlessWsUrl = env.BROWSERLESS_WS_URL;
      logger.info("Browserless WebSocket URL configured", {
        url: this.browserlessWsUrl.replace(/\/[^/]*$/, "/***"), // Mask token if present
      });
    }
  }

  /**
   * Get or create browser instance
   * Uses Browserless WebSocket if configured, otherwise launches local browser
   */
  async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    if (this.isClosing) {
      // Wait for closing to finish
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Use Browserless if configured
    if (this.browserlessWsUrl) {
      return this.connectToBrowserless();
    }

    // Otherwise launch local browser
    return this.launchLocalBrowser();
  }

  /**
   * Connect to Browserless via WebSocket
   */
  private async connectToBrowserless(): Promise<Browser> {
    logger.info("Connecting to Browserless", {
      url: this.browserlessWsUrl?.replace(/\/[^/]*$/, "/***"), // Mask token
    });

    try {
      // Connect to Browserless WebSocket endpoint
      this.browser = await puppeteer.connect({
        browserWSEndpoint: this.browserlessWsUrl!,
        defaultViewport: null, // Use Browserless default viewport
      });

      logger.info("Connected to Browserless successfully");

      // Handle browser disconnection
      this.browser.on("disconnected", () => {
        logger.warn("Browserless connection disconnected");
        this.browser = null;
      });

      return this.browser;
    } catch (error) {
      logger.error("Failed to connect to Browserless", {
        error: error instanceof Error ? error.message : "Unknown error",
        url: this.browserlessWsUrl?.replace(/\/[^/]*$/, "/***"),
      });
      throw error;
    }
  }

  /**
   * Launch local browser instance
   */
  private async launchLocalBrowser(): Promise<Browser> {
    logger.info("Launching local browser", {
      headless: this.config.headless,
      timeout: this.config.timeout,
    });

    try {
      this.browser = await puppeteer.launch({
        headless: this.config.headless ?? true,
        timeout: this.config.timeout,
        args: this.config.args,
        userDataDir: this.config.userDataDir,
      });

      logger.info("Local browser launched successfully");

      // Handle browser disconnection
      this.browser.on("disconnected", () => {
        logger.warn("Browser disconnected");
        this.browser = null;
      });

      return this.browser;
    } catch (error) {
      logger.error("Failed to launch local browser", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Create a new page with stealth configuration
   */
  async createPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    // Set viewport
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
    });

    // Set user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Set extra headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
    });

    // Remove webdriver property
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => false,
      });
    });

    logger.debug("Page created with stealth configuration");

    return page;
  }

  /**
   * Close browser and cleanup
   * For Browserless connections, only disconnects (doesn't close the remote browser)
   */
  async closeBrowser(): Promise<void> {
    if (!this.browser) {
      return;
    }

    this.isClosing = true;

    try {
      if (this.browserlessWsUrl) {
        logger.info("Disconnecting from Browserless");
        await this.browser.disconnect();
        logger.info("Disconnected from Browserless successfully");
      } else {
        logger.info("Closing local browser");
        await this.browser.close();
        logger.info("Local browser closed successfully");
      }
      this.browser = null;
    } catch (error) {
      logger.error("Error closing browser", {
        error: error instanceof Error ? error.message : "Unknown error",
        isBrowserless: !!this.browserlessWsUrl,
      });
      this.browser = null;
    } finally {
      this.isClosing = false;
    }
  }

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    await this.closeBrowser();
  }

  /**
   * Check if browser is available
   */
  isAvailable(): boolean {
    return this.browser !== null && this.browser.isConnected();
  }
}

