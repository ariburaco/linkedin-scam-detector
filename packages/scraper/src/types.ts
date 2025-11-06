/**
 * Scraper Types
 * Type definitions for scraper package
 */

export interface ScrapeJobSearchParams {
  keywords?: string;
  location?: string;
  experienceLevel?: "internship" | "entry" | "associate" | "mid-senior" | "director" | "executive";
  jobType?: "F" | "C" | "P" | "T" | "I" | "V" | "O"; // Full-time, Contract, Part-time, Temporary, Internship, Volunteer, Other
  remote?: boolean;
  datePosted?: "r86400" | "r604800" | "r2592000"; // 24h, 7d, 30d
  maxResults?: number;
  start?: number; // Pagination offset
}

export interface ScrapedJobData {
  linkedinJobId: string;
  url: string;
  title: string;
  company: string;
  companyUrl?: string;
  location?: string;
  employmentType?: string;
  workType?: "remote" | "hybrid" | "on-site";
  description?: string;
  postedDate?: string;
  applicationCount?: string;
  applicants?: string;
  isPromoted?: boolean;
  isEasyApply?: boolean;
  salary?: string;
  companyLogoUrl?: string;
  insight?: string;
  discoverySource?: string; // e.g., "scraper", "extension", "manual"
  rawData?: Record<string, unknown>;
}

export interface ScrapeJobDetailsParams {
  url: string;
  linkedinJobId?: string;
}

export interface BrowserConfig {
  headless?: boolean;
  timeout?: number;
  userDataDir?: string;
  args?: string[];
  browserlessWsUrl?: string; // Override Browserless WebSocket URL from env
}

export interface ScraperConfig {
  rateLimitDelay?: number; // ms between requests
  pageTimeout?: number; // ms timeout for page operations
  maxRetries?: number;
  retryDelay?: number; // ms delay between retries
}

