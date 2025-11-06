/**
 * Scraper Package
 * Puppeteer-based scraping utilities for LinkedIn job scraping
 * 
 * NOTE: This package should only be imported in workers, not in Next.js
 */

export { BrowserManager } from "./browser-manager";
export { LinkedInScraper } from "./linkedin-scraper";
export * from "./types";
export * from "./utils";
export * from "./cookie-utils";

