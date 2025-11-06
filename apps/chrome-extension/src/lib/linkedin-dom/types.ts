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
