export interface JobData {
  title: string;
  company: string;
  description: string;
  url: string;
  salary?: string;
  location?: string;
  employmentType?: string; // e.g., "Full-time", "Part-time", "Contract", etc.
  postedDate?: string; // Date string when job was posted
  linkedinJobId?: string; // Extracted LinkedIn job ID from URL or DOM
}

export interface JobElement {
  element: HTMLElement;
  data: JobData;
  badgeContainer?: HTMLElement;
}

export interface DiscoveredJobData {
  linkedinJobId: string;
  url: string;
  title: string;
  company: string;
  location?: string;
  employmentType?: string;
  workType?: string; // Remote, Hybrid, On-site
  isPromoted?: boolean;
  isEasyApply?: boolean;
  hasVerified?: boolean;
  insight?: string;
  postedDate?: string;
  companyLogoUrl?: string;
  discoverySource: string; // "search", "recommended", etc.
  discoveryUrl: string;
}
