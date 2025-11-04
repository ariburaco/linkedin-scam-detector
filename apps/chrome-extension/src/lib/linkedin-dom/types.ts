export interface JobData {
  title: string;
  company: string;
  description: string;
  url: string;
  salary?: string;
  location?: string;
}

export interface JobElement {
  element: HTMLElement;
  data: JobData;
  badgeContainer?: HTMLElement;
}

