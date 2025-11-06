/**
 * Utility functions for waiting for DOM elements to appear
 * Useful for LinkedIn's dynamic content loading
 */

import { extensionLoggerContent } from "@/shared/loggers";

export interface WaitForElementOptions {
  /**
   * Maximum number of retry attempts (default: 10)
   */
  maxRetries?: number;
  /**
   * Initial delay in milliseconds before first check (default: 100)
   */
  initialDelay?: number;
  /**
   * Delay between retries in milliseconds (default: 300)
   */
  retryDelay?: number;
  /**
   * Whether to use exponential backoff (default: false)
   * If true, delay increases exponentially: initialDelay * 2^retryCount
   */
  exponentialBackoff?: boolean;
  /**
   * Custom validator function to check if element is "ready"
   * Element is considered ready if this returns true
   * Default: checks if element exists and has content (textContent length > 0)
   */
  validator?: (element: HTMLElement) => boolean;
  /**
   * Minimum content length to consider element ready (default: 0)
   * Only used if validator is not provided
   */
  minContentLength?: number;
  /**
   * Whether to check for nested content elements (default: true)
   * If true, also checks for common content indicators like p, ul, ol, div.mt4
   */
  checkNestedContent?: boolean;
}

/**
 * Wait for an element to appear in the DOM with retry/backoff strategy
 *
 * @param selector - CSS selector or array of selectors to find the element
 * @param container - Container to search in (default: document)
 * @param options - Wait options
 * @returns Promise that resolves with the found element or null if not found
 *
 * @example
 * ```ts
 * // Wait for job details with default options
 * const element = await waitForElement('#job-details');
 *
 * // Wait with custom options
 * const element = await waitForElement('.jobs-box__html-content', document, {
 *   maxRetries: 15,
 *   initialDelay: 200,
 *   retryDelay: 500,
 *   exponentialBackoff: true,
 *   minContentLength: 500,
 *   validator: (el) => el.textContent.length > 1000
 * });
 * ```
 */
export async function waitForElement(
  selector: string | string[],
  container: HTMLElement | Document = document,
  options: WaitForElementOptions = {}
): Promise<HTMLElement | null> {
  const {
    maxRetries = 10,
    initialDelay = 100,
    retryDelay = 300,
    exponentialBackoff = false,
    validator,
    minContentLength = 0,
    checkNestedContent = true,
  } = options;

  const selectors = Array.isArray(selector) ? selector : [selector];

  // Initial delay before first check
  if (initialDelay > 0) {
    await new Promise((resolve) => setTimeout(resolve, initialDelay));
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Try each selector
    for (const sel of selectors) {
      const element = container.querySelector(sel) as HTMLElement | null;

      if (element) {
        // Skip if element itself is a skeleton/loader
        if (isSkeletonOrLoader(element)) {
          continue;
        }

        // Check if element contains only skeleton/loader children
        const hasOnlySkeletons =
          element.querySelector(".scaffold-skeleton-container") !== null &&
          element.querySelector("p, ul, ol, div.mt4") === null;

        if (hasOnlySkeletons) {
          continue;
        }

        // Check if element is "ready" using validator or default checks
        const isReady = validator
          ? validator(element)
          : isElementReady(element, minContentLength, checkNestedContent);

        if (isReady) {
          if (process.env.NODE_ENV === "development") {
            extensionLoggerContent.debug(
              `[waitForElement] Found element after ${attempt + 1} attempts: ${sel}`
            );
          }
          return element;
        }
      }
    }

    // If not found or not ready, wait before next retry
    if (attempt < maxRetries - 1) {
      const delay = exponentialBackoff
        ? initialDelay * Math.pow(2, attempt)
        : retryDelay;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Element not found after all retries
  if (process.env.NODE_ENV === "development") {
    extensionLoggerContent.debug(
      `[waitForElement] Element not found after ${maxRetries} attempts: ${selectors.join(", ")}`
    );
  }
  return null;
}

/**
 * Check if an element is a skeleton/loader (should be skipped)
 */
function isSkeletonOrLoader(element: HTMLElement): boolean {
  // Check for skeleton containers
  if (
    element.classList.contains("scaffold-skeleton-container") ||
    element.classList.contains("job-description-skeleton__text-container") ||
    element.querySelector(".scaffold-skeleton-container") !== null ||
    element.querySelector(".scaffold-skeleton-text") !== null ||
    element.querySelector(".scaffold-skeleton--shimmer") !== null
  ) {
    return true;
  }

  // Check for loaders
  if (
    element.classList.contains("artdeco-loader") ||
    element.querySelector(".artdeco-loader") !== null ||
    element.querySelector("[data-test-loader-a11y]") !== null
  ) {
    return true;
  }

  // Check for loading indicators in text
  const textContent = element.textContent?.toLowerCase() || "";
  if (
    textContent.includes("loading") ||
    textContent.includes("loading job details")
  ) {
    // But make sure it's actually a loader, not just text mentioning "loading"
    if (
      element.querySelector(".artdeco-loader") !== null ||
      element.querySelector(".artdeco-loader__bars") !== null
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Check if an element is "ready" (has meaningful content, not a skeleton/loader)
 */
function isElementReady(
  element: HTMLElement,
  minContentLength: number,
  checkNestedContent: boolean
): boolean {
  // First check: Skip skeleton/loader elements
  if (isSkeletonOrLoader(element)) {
    return false;
  }

  // Check if element contains skeleton/loader children (parent container with loaders inside)
  const hasSkeletonChildren =
    element.querySelector(".scaffold-skeleton-container") !== null ||
    element.querySelector(".artdeco-loader") !== null ||
    element.querySelector("[data-test-loader-a11y]") !== null;

  if (hasSkeletonChildren) {
    // Check if there's actual content alongside the skeleton
    // If skeleton is the only content, element is not ready
    const textContent = element.textContent?.trim() || "";
    const skeletonText = Array.from(
      element.querySelectorAll(".scaffold-skeleton-text, .artdeco-loader")
    )
      .map((el) => el.textContent?.trim() || "")
      .join(" ")
      .trim();

    // If textContent is mostly skeleton text, element is not ready
    if (textContent.length > 0 && skeletonText.length > 0) {
      const nonSkeletonText = textContent
        .replace(skeletonText, "")
        .replace(/loading/gi, "")
        .trim();
      if (nonSkeletonText.length < minContentLength) {
        return false;
      }
    } else if (textContent.length === 0 || skeletonText.length > 0) {
      return false;
    }
  }

  // Check textContent length
  const textContent = element.textContent?.trim() || "";
  // Remove common loading/skeleton text
  const cleanText = textContent
    .replace(/loading/gi, "")
    .replace(/scaffold-skeleton/gi, "")
    .trim();

  if (cleanText.length < minContentLength) {
    return false;
  }

  // If minContentLength is 0 and textContent is empty, element might not be ready
  if (minContentLength === 0 && cleanText.length === 0) {
    return false;
  }

  // Check for nested content elements if enabled
  if (checkNestedContent) {
    // Look for actual content elements (not skeletons)
    const contentSelectors = "p, ul, ol, div.mt4, .mt4, h2, h3";
    const contentElements = element.querySelectorAll(contentSelectors);

    // Filter out skeleton elements
    const realContentElements = Array.from(contentElements).filter(
      (el) => !isSkeletonOrLoader(el as HTMLElement)
    );

    const hasNestedContent = realContentElements.length > 0;

    // If we have nested content indicators, element is likely ready
    if (hasNestedContent) {
      return true;
    }

    // If no nested content but textContent exists, still consider ready
    if (cleanText.length > 0) {
      return true;
    }

    return false;
  }

  // If not checking nested content, just check textContent length
  return cleanText.length >= minContentLength;
}

/**
 * Wait for multiple elements to appear (all must be found)
 *
 * @param selectors - Object mapping names to selectors
 * @param container - Container to search in
 * @param options - Wait options
 * @returns Promise that resolves with object mapping names to elements, or null if any element not found
 */
export async function waitForElements(
  selectors: Record<string, string | string[]>,
  container: HTMLElement | Document = document,
  options: WaitForElementOptions = {}
): Promise<Record<string, HTMLElement> | null> {
  const results: Record<string, HTMLElement> = {};
  const maxRetries = options.maxRetries || 10;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let allFound = true;

    for (const [name, selector] of Object.entries(selectors)) {
      if (!results[name]) {
        const element = await waitForElement(selector, container, {
          ...options,
          maxRetries: 1, // Single attempt per iteration
        });

        if (element) {
          results[name] = element;
        } else {
          allFound = false;
        }
      }
    }

    if (allFound) {
      return results;
    }

    // Wait before next attempt
    if (attempt < maxRetries - 1) {
      const delay = options.exponentialBackoff
        ? (options.initialDelay || 100) * Math.pow(2, attempt)
        : options.retryDelay || 300;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return null;
}
