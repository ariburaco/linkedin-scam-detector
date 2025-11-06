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
 * Expand job description by clicking "Show more" button if present
 * Returns true if button was clicked, false if button doesn't exist or is already expanded
 */
export async function expandJobDescription(page: Page): Promise<boolean> {
  try {
    const showMoreButton = await page.$(
      '.show-more-less-html__button.show-more-less-html__button--more'
    );

    if (!showMoreButton) {
      return false; // Button doesn't exist (already expanded or not present)
    }

    // Check if button is visible
    const isVisible = await page.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0'
      );
    }, showMoreButton);

    if (!isVisible) {
      return false; // Button is hidden
    }

    // Click the button
    await showMoreButton.click();
    await sleep(500); // Wait for animation/expansion

    // Verify expansion by checking if "Show less" button appears or content expanded
    const showLessButton = await page.$(
      '.show-more-less-html__button.show-more-less-html__button--less'
    );
    if (showLessButton) {
      return true; // Successfully expanded
    }

    // Alternative check: verify description is no longer clamped
    const descriptionSection = await page.$('.show-more-less-html');
    if (descriptionSection) {
      const isExpanded = await page.evaluate((el) => {
        return !el.classList.contains(
          'show-more-less-html__markup--clamp-after-5'
        );
      }, descriptionSection);
      return isExpanded;
    }

    return false;
  } catch (error) {
    // Fail silently - if expansion fails, we'll still try to extract what's visible
    return false;
  }
}

/**
 * Dismiss LinkedIn contextual sign-in modal if present
 * Returns true if modal was dismissed, false if no modal found or dismissal failed
 */
export async function dismissContextualSignInModal(
  page: Page
): Promise<boolean> {
  try {
    // Check if contextual sign-in modal exists
    const modalSelector = '.contextual-sign-in-modal__screen';
    const modal = await page.$(modalSelector);

    if (!modal) {
      return false; // No modal found
    }

    // Check if modal is visible
    const isVisible = await page.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0'
      );
    }, modal);

    if (!isVisible) {
      return false; // Modal not visible
    }

    // Try multiple dismiss button selectors
    const dismissSelectors = [
      'button.modal__dismiss[aria-label="Dismiss"]',
      'button.contextual-sign-in-modal__dismiss',
      'button[aria-label="Dismiss"]',
      '.modal__dismiss',
      '.contextual-sign-in-modal__dismiss',
      'button.sign-in-modal__dismiss',
    ];

    let dismissButton = null;
    for (const selector of dismissSelectors) {
      dismissButton = await page.$(selector);
      if (dismissButton) {
        // Check if button is visible
        const buttonVisible = await page.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        }, dismissButton);
        if (buttonVisible) {
          break;
        }
        dismissButton = null;
      }
    }

    if (!dismissButton) {
      // Try to find close icon/X button
      const closeIcon = await page.$(
        'icon.sign-in-modal__dismiss-icon, svg[class*="dismiss"]'
      );
      if (closeIcon) {
        const parentButton = await page.evaluateHandle((icon) => {
          return icon.closest('button');
        }, closeIcon);
        if (parentButton) {
          dismissButton = parentButton as any;
        }
      }
    }

    if (dismissButton) {
      // Click dismiss button
      await dismissButton.click();

      // Wait for modal to disappear (check for removal or visibility change)
      await sleep(500);

      // Verify modal is gone
      const modalStillExists = await page.$(modalSelector);
      if (modalStillExists) {
        const stillVisible = await page.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return (
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0'
          );
        }, modalStillExists);

        if (!stillVisible) {
          return true; // Modal dismissed (hidden)
        }
      } else {
        return true; // Modal removed from DOM
      }
    }

    // If we couldn't dismiss, try pressing Escape key
    await page.keyboard.press('Escape');
    await sleep(500);

    // Check if modal is gone
    const modalAfterEscape = await page.$(modalSelector);
    if (!modalAfterEscape) {
      return true;
    }

    const stillVisibleAfterEscape = await page.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0'
      );
    }, modalAfterEscape);

    return !stillVisibleAfterEscape;
  } catch (error) {
    // Log error but don't throw - graceful degradation
    return false;
  }
}

/**
 * Check if page requires login
 */
export async function requiresLogin(page: Page): Promise<boolean> {
  try {
    // Check for contextual sign-in modal first (this is a blocking modal)
    const contextualModal = await page.$('.contextual-sign-in-modal__screen');
    if (contextualModal) {
      const isVisible = await page.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          style.opacity !== '0'
        );
      }, contextualModal);
      if (isVisible) {
        return true; // Modal is blocking content
      }
    }

    // Check for LinkedIn login page indicators
    const loginIndicators = [
      'input[name="session_key"]',
      'input[type="email"]',
      'a[href*="/login"]',
      '.authwall',
      'div[data-test-id="sign-in-modal"]',
      'div[class*="sign-in-modal"]',
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
 * Verify if LinkedIn session is established
 * Checks for indicators that user is logged in
 */
export async function verifySession(page: Page): Promise<boolean> {
  try {
    // Check for logged-in indicators
    const loggedInIndicators = [
      'nav[class*="global-nav"]', // Main navigation (only visible when logged in)
      'div[data-test-id="nav-settings"]', // Settings menu
      'button[aria-label*="profile"]', // Profile button
      'div[class*="feed-identity-module"]', // Feed identity module
    ];

    for (const selector of loggedInIndicators) {
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

    // Check if login is NOT required (negative check)
    const loginRequired = await requiresLogin(page);
    if (loginRequired) {
      return false;
    }

    // Check URL - if we're on homepage or feed, likely logged in
    const url = page.url();
    if (
      url === 'https://www.linkedin.com/' ||
      url === 'https://www.linkedin.com/feed' ||
      url.startsWith('https://www.linkedin.com/feed/')
    ) {
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
