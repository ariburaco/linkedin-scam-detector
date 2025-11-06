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
  companyData?: CompanyData; // Full company information
  contacts?: ContactData[]; // Hiring team contacts
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
