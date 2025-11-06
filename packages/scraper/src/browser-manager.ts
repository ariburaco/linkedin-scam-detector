/**
 * Browser Manager
 * Manages Puppeteer browser instances with stealth configuration
 * Supports both local browser instances and Browserless WebSocket connections
 */

import type { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { env } from '@acme/shared/env';
import { Logger } from '@acme/shared/Logger';

import type { BrowserConfig } from './types';
import type { LinkedInCookie } from './cookie-utils';

const logger = new Logger('BrowserManager');

// Add stealth plugin
puppeteer.use(StealthPlugin());

export class BrowserManager {
  private browser: Browser | null = null;
  private config: BrowserConfig;
  private isClosing = false;
  private browserlessWsUrl: string | null = null;
  private cookieProvider?: () => Promise<LinkedInCookie[]>;

  constructor(
    config?: BrowserConfig,
    cookieProvider?: () => Promise<LinkedInCookie[]>
  ) {
    this.config = {
      headless: env.SCRAPER_HEADLESS ?? true,
      timeout: env.SCRAPER_TIMEOUT ?? 30000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled',
      ],
      ...config,
    };

    // Check for Browserless WebSocket URL
    if (env.BROWSERLESS_WS_URL) {
      this.browserlessWsUrl = env.BROWSERLESS_WS_URL;
      logger.info('Browserless WebSocket URL configured', {
        url: this.browserlessWsUrl.replace(/\/[^/]*$/, '/***'), // Mask token if present
      });
    }

    // Store cookie provider if provided
    if (cookieProvider) {
      this.cookieProvider = cookieProvider;
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
    logger.info('Connecting to Browserless', {
      url: this.browserlessWsUrl?.replace(/\/[^/]*$/, '/***'), // Mask token
    });

    try {
      // Connect to Browserless WebSocket endpoint
      this.browser = await puppeteer.connect({
        browserWSEndpoint: this.browserlessWsUrl!,
        defaultViewport: null, // Use Browserless default viewport
      });

      logger.info('Connected to Browserless successfully');

      // Handle browser disconnection
      this.browser.on('disconnected', () => {
        logger.warn('Browserless connection disconnected');
        this.browser = null;
      });

      return this.browser;
    } catch (error) {
      logger.error('Failed to connect to Browserless', {
        error: error instanceof Error ? error.message : 'Unknown error',
        url: this.browserlessWsUrl?.replace(/\/[^/]*$/, '/***'),
      });
      throw error;
    }
  }

  /**
   * Launch local browser instance
   */
  private async launchLocalBrowser(): Promise<Browser> {
    logger.info('Launching local browser', {
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

      logger.info('Local browser launched successfully');

      // Handle browser disconnection
      this.browser.on('disconnected', () => {
        logger.warn('Browser disconnected');
        this.browser = null;
      });

      return this.browser;
    } catch (error) {
      logger.error('Failed to launch local browser', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Create a new page with stealth configuration and cookie injection
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
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    // Remove webdriver property
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });

    // Inject LinkedIn cookies if available
    if (this.cookieProvider) {
      try {
        const cookies = await this.cookieProvider();
        if (cookies.length > 0) {
          // Format cookies for Puppeteer (ensure sameSite is valid)
          const formattedCookies = cookies.map((cookie) => {
            const formatted: any = {
              name: cookie.name,
              value: cookie.value,
              domain: cookie.domain,
              path: cookie.path || '/',
              httpOnly: cookie.httpOnly ?? false,
              secure: cookie.secure ?? true,
            };

            // Only include expires if present
            if (cookie.expires) {
              formatted.expires = cookie.expires;
            }

            // Only include sameSite if it's a valid string value (not null or undefined)
            if (
              cookie.sameSite &&
              ['Strict', 'Lax', 'None'].includes(cookie.sameSite)
            ) {
              formatted.sameSite = cookie.sameSite;
            }

            return formatted;
          });

          // Get browser context (non-deprecated API)
          const context =
            browser.browserContexts()[0] || browser.defaultBrowserContext();

          // Set cookies in browser context (non-deprecated API)
          await context.setCookie(...formattedCookies);

          logger.info('LinkedIn cookies injected', {
            count: formattedCookies.length,
            domains: [...new Set(formattedCookies.map((c) => c.domain))],
          });
        } else {
          logger.warn('No LinkedIn cookies available for injection');
        }
      } catch (error) {
        logger.warn('Failed to inject LinkedIn cookies', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        // Continue without cookies - graceful degradation
      }
    }

    logger.debug('Page created with stealth configuration');

    return page;
  }

  /**
   * Establish LinkedIn session by navigating to homepage
   * This ensures cookies are properly set and session is active
   */
  async establishSession(page: Page): Promise<boolean> {
    if (!this.cookieProvider) {
      logger.debug('No cookie provider, skipping session establishment');
      return false;
    }

    try {
      logger.info('Establishing LinkedIn session...');

      // Navigate to LinkedIn homepage
      await page.goto('https://www.linkedin.com', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      // Wait a bit for page to fully load
      const { sleep } = await import('./utils');
      await sleep(2000);

      // Check if session is established
      const { verifySession } = await import('./utils');
      const sessionEstablished = await verifySession(page);

      if (sessionEstablished) {
        logger.info('LinkedIn session established successfully');
        return true;
      } else {
        // Check if login is required
        const { requiresLogin } = await import('./utils');
        const loginRequired = await requiresLogin(page);
        if (loginRequired) {
          logger.warn('LinkedIn session establishment failed - login required');
        } else {
          logger.warn(
            'LinkedIn session establishment failed - unable to verify session'
          );
        }
        return false;
      }
    } catch (error) {
      logger.warn('Failed to establish LinkedIn session', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
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
        logger.info('Disconnecting from Browserless');
        await this.browser.disconnect();
        logger.info('Disconnected from Browserless successfully');
      } else {
        logger.info('Closing local browser');
        await this.browser.close();
        logger.info('Local browser closed successfully');
      }
      this.browser = null;
    } catch (error) {
      logger.error('Error closing browser', {
        error: error instanceof Error ? error.message : 'Unknown error',
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
