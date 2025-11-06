/**
 * Scraper Types
 * Type definitions for scraper package
 */

export interface ScrapeJobSearchParams {
  keywords?: string;
  location?: string;
  experienceLevel?:
    | 'internship'
    | 'entry'
    | 'associate'
    | 'mid-senior'
    | 'director'
    | 'executive';
  jobType?: 'F' | 'C' | 'P' | 'T' | 'I' | 'V' | 'O'; // Full-time, Contract, Part-time, Temporary, Internship, Volunteer, Other
  remote?: boolean;
  datePosted?: 'r86400' | 'r604800' | 'r2592000'; // 24h, 7d, 30d
  maxResults?: number;
  start?: number; // Pagination offset
}

export interface CompanyData {
  linkedinCompanyId: string; // e.g., "pegasus-airlines" from /company/pegasus-airlines/
  name: string;
  url: string;
  logoUrl?: string;
  description?: string;
  industry?: string;
  employeeCount?: string; // e.g., "5,001-10,000 employees"
  linkedinEmployeeCount?: string; // e.g., "6,997 on LinkedIn"
  followerCount?: string; // e.g., "412,931 followers"
  rawData?: Record<string, unknown>;
}

export interface ContactData {
  linkedinProfileId: string; // e.g., "ebrueksi" from /in/ebrueksi
  name: string;
  profileUrl: string;
  profileImageUrl?: string;
  isVerified?: boolean;
  role?: string; // e.g., "Senior Talent Acquisition Specialist"
  title?: string; // e.g., "Senior Talent Acquisition and Employer Branding Specialist @Pegasus Airlines"
  connectionDegree?: string; // e.g., "2nd", "3rd"
  isJobPoster?: boolean;
  relationshipType?: string; // e.g., "job_poster", "hiring_manager", "recruiter", "hiring_team_member"
  rawData?: Record<string, unknown>;
}

export interface ScrapedJobData {
  linkedinJobId: string;
  url: string;
  title: string;
  company: string;
  companyUrl?: string;
  companyData?: CompanyData; // Full company information
  location?: string;
  employmentType?: string;
  workType?: 'remote' | 'hybrid' | 'on-site';
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
  seniorityLevel?: string;
  jobFunction?: string;
  industries?: string;
  contacts?: ContactData[]; // Hiring team contacts
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
