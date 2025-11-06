/**
 * Scraper Utilities
 * Helper functions for web scraping
 */

/// <reference lib="dom" />

import type { Page } from 'puppeteer';

/**
 * Wait for selector with timeout
 */
export async function waitForSelector(
  page: Page,
  selector: string,
  timeout: number = 30000
): Promise<void> {
  try {
    await page.waitForSelector(selector, { timeout });
  } catch (error) {
    throw new Error(`Selector "${selector}" not found within ${timeout}ms`);
  }
}

/**
 * Extract text from element
 */
export async function extractText(
  page: Page,
  selector: string
): Promise<string | null> {
  try {
    const element = await page.$(selector);
    if (!element) {
      return null;
    }
    const text = await page.evaluate(
      (el) => el.textContent?.trim() || null,
      element
    );
    return text;
  } catch (error) {
    return null;
  }
}

/**
 * Extract attribute from element
 */
export async function extractAttribute(
  page: Page,
  selector: string,
  attribute: string
): Promise<string | null> {
  try {
    const element = await page.$(selector);
    if (!element) {
      return null;
    }
    const value = await page.evaluate(
      (el, attr) => el.getAttribute(attr),
      element,
      attribute
    );
    return value;
  } catch (error) {
    return null;
  }
}

/**
 * Extract text from multiple elements
 */
export async function extractTexts(
  page: Page,
  selector: string
): Promise<string[]> {
  try {
    return await page.$$eval(selector, (elements) =>
      elements.map((el) => el.textContent?.trim() || '').filter(Boolean)
    );
  } catch (error) {
    return [];
  }
}

/**
 * Scroll to bottom of page (for lazy-loaded content)
 */
export async function scrollToBottom(
  page: Page,
  scrollDelay: number = 1000
): Promise<void> {
  await page.evaluate(async (delay) => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 100;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, delay);
    });
  }, scrollDelay);
}

/**
 * Wait for network to be idle
 * Note: Puppeteer doesn't have a built-in networkidle wait, so we use a custom implementation
 */
export async function waitForNetworkIdle(
  page: Page,
  timeout: number = 30000,
  idleTime: number = 500
): Promise<void> {
  try {
    await Promise.race([
      new Promise<void>((resolve) => {
        let idleTimer: NodeJS.Timeout;
        let requestCount = 0;

        const resetTimer = () => {
          clearTimeout(idleTimer);
          requestCount++;
          idleTimer = setTimeout(() => {
            if (requestCount === 0) {
              resolve();
            } else {
              requestCount = 0;
              resetTimer();
            }
          }, idleTime);
        };

        const onRequest = () => {
          requestCount++;
          resetTimer();
        };

        const onResponse = () => {
          requestCount = Math.max(0, requestCount - 1);
          resetTimer();
        };

        page.on('request', onRequest);
        page.on('response', onResponse);
        resetTimer();
      }),
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error('Network idle timeout')), timeout)
      ),
    ]);
  } catch (error) {
    // Ignore timeout errors - network may not be fully idle
  }
}

/**
 * Extract LinkedIn job ID from URL
 */
export function extractLinkedInJobIdFromUrl(url: string): string | null {
  try {
    // Format: /jobs/view/123456 or /jobs/view/job-title-slug-123456
    const match = url.match(/\/jobs\/view\/(?:[^/]+-)?(\d+)/);
    if (match?.[1]) {
      return match[1];
    }

    // Format: ?currentJobId=123456
    const urlObj = new URL(url);
    const currentJobId = urlObj.searchParams.get('currentJobId');
    if (currentJobId) {
      return currentJobId;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Sleep/delay utility
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if page requires login
 */
export async function requiresLogin(page: Page): Promise<boolean> {
  try {
    // Check for LinkedIn login page indicators
    const loginIndicators = [
      'input[name="session_key"]',
      'input[type="email"]',
      'a[href*="/login"]',
      '.authwall',
    ];

    for (const selector of loginIndicators) {
      const element = await page.$(selector);
      if (element) {
        const isVisible = await page.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        }, element);
        if (isVisible) {
          return true;
        }
      }
    }

    // Check URL
    const url = page.url();
    if (url.includes('/login') || url.includes('/authwall')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Check if rate limited
 */
export async function isRateLimited(page: Page): Promise<boolean> {
  try {
    const rateLimitIndicators = [
      'Rate limit exceeded',
      'Too many requests',
      '429',
      'Please slow down',
    ];

    const bodyText = await page.evaluate(() => document.body.textContent || '');
    return rateLimitIndicators.some((indicator) =>
      bodyText.toLowerCase().includes(indicator.toLowerCase())
    );
  } catch {
    return false;
  }
}
