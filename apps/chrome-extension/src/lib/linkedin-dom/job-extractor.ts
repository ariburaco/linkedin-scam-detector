import { convertHtmlToMarkdown } from "@acme/shared/utils";

import { findElement, SELECTORS } from "./selectors";
import type {
  CompanyData,
  ContactData,
  DiscoveredJobData,
  JobData,
} from "./types";

import { extensionLoggerContent } from "@/shared/loggers";

/**
 * Extract LinkedIn job ID from URL
 * Supports multiple URL formats:
 * - /jobs/view/123456
 * - /jobs/view/job-title-slug-123456
 * - /jobs/collections/recommended/?currentJobId=123456
 * - /jobs/search/?currentJobId=123456
 */
function extractLinkedInJobId(url: string): string | undefined {
  if (!url || typeof url !== "string") {
    return undefined;
  }

  try {
    // Format 1: Direct view format with slug: /jobs/view/job-title-slug-123456
    // Extract the numeric ID at the end of the slug (before query params)
    const slugFormatMatch = url.match(/\/jobs\/view\/[^/?]+-(\d+)(?:\/|\?|$)/);
    if (slugFormatMatch?.[1]) {
      return slugFormatMatch[1];
    }

    // Format 2: Direct view format with numeric ID only: /jobs/view/123456
    const directMatch = url.match(/\/jobs\/view\/(\d+)/);
    if (directMatch?.[1]) {
      return directMatch[1];
    }

    // Format 3: Query parameter format (collections, search, etc.)
    // Handle both absolute and relative URLs
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      // If URL is relative, try with window.location.origin
      try {
        urlObj = new URL(url, window.location.origin);
      } catch {
        // If still fails, try parsing manually
        const match = url.match(/[?&]currentJobId=(\d+)/);
        if (match?.[1]) {
          return match[1];
        }
        return undefined;
      }
    }
    const currentJobId = urlObj.searchParams.get("currentJobId");
    if (currentJobId) {
      return currentJobId;
    }
  } catch (error) {
    // Invalid URL format, continue to return undefined
    extensionLoggerContent.debug(
      "[LinkedIn Scam Detector] Failed to extract job ID from URL:",
      error
    );
  }

  return undefined;
}

/**
 * Extract employment type from job insights
 * New LinkedIn structure: Look in .job-details-fit-level-preferences for buttons
 */
function extractEmploymentType(
  container: HTMLElement | Document
): string | undefined {
  // First try: New LinkedIn structure - look for buttons in fit-level-preferences
  const preferencesContainer = container.querySelector(
    ".job-details-fit-level-preferences"
  );
  
  if (preferencesContainer) {
    const buttons = preferencesContainer.querySelectorAll("button");
    for (const button of buttons) {
      const text = button.textContent?.trim() || "";
      // Check for employment type indicators
      if (text.match(/full[- ]?time/i)) {
        return "Full-time";
      }
      if (text.match(/part[- ]?time/i)) {
        return "Part-time";
      }
      if (text.match(/contract/i)) {
        return "Contract";
      }
      if (text.match(/temporary|temp/i)) {
        return "Temporary";
      }
      if (text.match(/internship/i)) {
        return "Internship";
      }
    }
  }
  
  // Fallback: Look for job insights that might contain employment type
  const insights = container.querySelectorAll(
    ".job-details-jobs-unified-top-card__job-insight"
  );
  for (const insight of insights) {
    const text = insight.textContent?.trim().toLowerCase() || "";
    if (text.includes("full-time") || text.includes("full time")) {
      return "Full-time";
    }
    if (text.includes("part-time") || text.includes("part time")) {
      return "Part-time";
    }
    if (text.includes("contract")) {
      return "Contract";
    }
    if (text.includes("temporary") || text.includes("temp")) {
      return "Temporary";
    }
    if (text.includes("internship")) {
      return "Internship";
    }
  }
  return undefined;
}

/**
 * Extract posted date if available
 * New LinkedIn structure: Look in .job-details-jobs-unified-top-card__tertiary-description-container
 */
function extractPostedDate(
  container: HTMLElement | Document
): string | undefined {
  // First try: New LinkedIn structure - look in tertiary description container
  const tertiaryContainer = container.querySelector(
    ".job-details-jobs-unified-top-card__tertiary-description-container"
  );
  
  if (tertiaryContainer) {
    // Look for spans containing date patterns
    const spans = tertiaryContainer.querySelectorAll("span");
    for (const span of spans) {
      const text = span.textContent?.trim() || "";
      // Match patterns like "4 weeks ago", "2 days ago", "1 month ago", etc.
      if (text.match(/\d+\s+(day|days|week|weeks|month|months|hour|hours)\s+ago/i)) {
        return text;
      }
    }
  }
  
  // Fallback: Look for "Posted X days ago" or similar patterns in old structure
  const insightElements = container.querySelectorAll(
    ".job-details-jobs-unified-top-card__job-insight, .jobs-unified-top-card__primary-description-without-tagline"
  );
  for (const element of insightElements) {
    const text = element.textContent?.trim() || "";
    // Match patterns like "Posted 2 days ago", "2 days ago", etc.
    if (
      text.toLowerCase().includes("posted") ||
      text.match(/\d+\s+(day|days|week|weeks|month|months)\s+ago/i)
    ) {
      return text;
    }
  }
  return undefined;
}

/**
 * Extract job data from a job card element (search results)
 */
export function extractJobDataFromCard(
  cardElement: HTMLElement
): JobData | null {
  try {
    // Extract job title
    const titleElement = findElement(cardElement, SELECTORS.jobTitle);
    const title = titleElement?.textContent?.trim() || "";

    if (!title) {
      return null;
    }

    // Extract company name
    const companyElement = findElement(cardElement, SELECTORS.companyName);
    const company = companyElement?.textContent?.trim() || "";

    // Extract job URL
    const linkElement = findElement(
      cardElement,
      SELECTORS.jobLink
    ) as HTMLAnchorElement | null;
    const url = linkElement?.href || window.location.href;

    // Extract LinkedIn job ID from URL
    const linkedinJobId = extractLinkedInJobId(url);

    // Extract description as HTML (may be truncated in cards)
    const descriptionElement = findElement(
      cardElement,
      SELECTORS.jobDescription
    );

    // Safely extract HTML - ensure element is HTMLElement and has innerHTML property
    let descriptionHtml = "";
    if (descriptionElement && descriptionElement instanceof HTMLElement) {
      try {
        descriptionHtml = descriptionElement.innerHTML?.trim() || "";
      } catch (error) {
        // Fallback to textContent if innerHTML access fails
        extensionLoggerContent.debug(
          "[LinkedIn Scam Detector] innerHTML access failed, using textContent:",
          error
        );
        descriptionHtml = descriptionElement.textContent?.trim() || "";
      }
    }

    // Convert HTML to Markdown with error handling
    let description = "";
    if (descriptionHtml) {
      try {
        description = convertHtmlToMarkdown(descriptionHtml);
      } catch (error) {
        extensionLoggerContent.error(
          "[LinkedIn Scam Detector] Failed to convert HTML to Markdown:",
          error
        );
        // Fallback to plain text if conversion fails
        description = descriptionHtml.replace(/<[^>]*>/g, "").trim();
      }
    }

    // Extract salary if available
    const salaryElement = findElement(cardElement, SELECTORS.salary);
    const salary = salaryElement?.textContent?.trim();

    // Extract location if available
    const locationElement = findElement(cardElement, SELECTORS.location);
    const location = locationElement?.textContent?.trim();

    // Extract employment type
    const employmentType = extractEmploymentType(cardElement);

    // Extract posted date
    const postedDate = extractPostedDate(cardElement);

    return {
      title,
      company,
      description,
      url,
      salary,
      location,
      employmentType,
      postedDate,
      linkedinJobId,
    };
  } catch (error) {
    extensionLoggerContent.error(
      "[LinkedIn Scam Detector] Error extracting job data from card:",
      {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        url: window.location.href,
      }
    );
    return null;
  }
}

/**
 * Extract company information from job details page
 */
function extractCompanyInfo(document: Document): CompanyData | null {
  try {
    // Find the "About the company" section
    const companySectionSelectors = [
      ".jobs-company__box",
      ".jobs-company__card",
      '[data-test-id="about-us"]',
      'section[class*="company"]',
    ];

    let companySection: Element | null = null;
    for (const selector of companySectionSelectors) {
      companySection = findElement(document, [selector]);
      if (companySection) break;
    }

    if (!companySection) {
      return null;
    }

    // Extract company name
    const nameElement =
      companySection.querySelector("h3") ||
      companySection.querySelector('a[data-test-id="about-us"]') ||
      companySection.querySelector(".jobs-company__name");
    const name = nameElement?.textContent?.trim() || null;

    if (!name) {
      return null;
    }

    // Extract company URL and LinkedIn ID
    const companyLinkElement = companySection.querySelector(
      'a[href*="/company/"]'
    );
    const companyUrl = companyLinkElement?.getAttribute("href") || null;

    let linkedinCompanyId: string | null = null;
    if (companyUrl) {
      const match = companyUrl.match(/\/company\/([^/?]+)/);
      if (match?.[1]) {
        linkedinCompanyId = match[1];
      }
    }

    if (!linkedinCompanyId) {
      return null;
    }

    // Extract logo URL
    const logoElement = companySection.querySelector("img");
    const logoUrl = logoElement?.getAttribute("src") || null;

    // Extract description
    const descriptionElement =
      companySection.querySelector(".jobs-company__description") ||
      companySection.querySelector("p");
    const description = descriptionElement?.textContent?.trim() || null;

    // Extract industry
    const industryElement =
      companySection.querySelector(".jobs-company__industry") ||
      companySection.querySelector('[data-test-id="company-industry"]');
    const industry = industryElement?.textContent?.trim() || null;

    // Extract employee counts
    const employeeCountElement =
      companySection.querySelector(".jobs-company__employee-count") ||
      companySection.querySelector('[data-test-id="company-size"]');
    const employeeCount = employeeCountElement?.textContent?.trim() || null;

    const linkedinEmployeeCountElement = companySection.querySelector(
      ".jobs-company__linkedin-employee-count"
    );
    const linkedinEmployeeCount =
      linkedinEmployeeCountElement?.textContent?.trim() || null;

    // Extract follower count
    const followerCountElement =
      companySection.querySelector(".jobs-company__follower-count") ||
      companySection.querySelector('[data-test-id="company-followers"]');
    const followerCount = followerCountElement?.textContent?.trim() || null;

    // Build full company URL if relative
    const fullUrl = companyUrl?.startsWith("http")
      ? companyUrl
      : `https://www.linkedin.com${companyUrl}`;

    return {
      linkedinCompanyId,
      name,
      url: fullUrl || "",
      logoUrl: logoUrl || undefined,
      description: description || undefined,
      industry: industry || undefined,
      employeeCount: employeeCount || undefined,
      linkedinEmployeeCount: linkedinEmployeeCount || undefined,
      followerCount: followerCount || undefined,
    };
  } catch (error) {
    extensionLoggerContent.warn(
      "[LinkedIn Scam Detector] Failed to extract company info:",
      error
    );
    return null;
  }
}

/**
 * Extract hiring team contacts from job details page
 */
function extractHiringTeam(document: Document): ContactData[] {
  const contacts: ContactData[] = [];

  try {
    // Find the "Meet the hiring team" section
    // Try multiple selectors to catch different LinkedIn UI variations
    const hiringTeamSelectors = [
      // New LinkedIn structure (from DOM provided)
      ".job-details-people-who-can-help__section--two-pane",
      '[class*="job-details-people-who-can-help"]',
      // Old selectors for backward compatibility
      'section[data-test-id="hiring-team"]',
      'section[data-test-id*="hiring"]',
      ".jobs-hiring-team",
      '[class*="hiring-team"]',
      '[class*="hiringTeam"]',
      // Look for h2 containing "Meet the hiring team" and get parent
      (() => {
        const h2 = Array.from(document.querySelectorAll("h2")).find(
          (el) =>
            el.textContent
              ?.toLowerCase()
              .includes("meet the hiring team") ||
            el.textContent?.toLowerCase().includes("hiring team")
        );
        return h2?.closest("div[class*='people-who-can-help']") ||
          h2?.closest("section") ||
          h2?.parentElement;
      })(),
    ].filter(Boolean) as string[];

    let hiringTeamSection: Element | null = null;
    
    // First try: Look for h2 containing "Meet the hiring team" and get parent container
    const h2Element = Array.from(document.querySelectorAll("h2")).find(
      (el) =>
        el.textContent?.toLowerCase().includes("meet the hiring team") ||
        el.textContent?.toLowerCase().includes("hiring team")
    );
    
    if (h2Element) {
      // Find the parent container (usually a div with class containing "people-who-can-help")
      hiringTeamSection =
        h2Element.closest(".job-details-people-who-can-help__section--two-pane") ||
        h2Element.closest('[class*="people-who-can-help"]') ||
        h2Element.closest("section") ||
        h2Element.parentElement;
    }
    
    // Fallback: Try other selectors
    if (!hiringTeamSection) {
      for (const selector of hiringTeamSelectors) {
        if (typeof selector === "function") continue; // Skip function selectors
        hiringTeamSection = findElement(document, [selector]);
        if (hiringTeamSection) break;
      }
    }

    if (!hiringTeamSection) {
      extensionLoggerContent.debug(
        "[LinkedIn Scam Detector] Hiring team section not found. Tried selectors:",
        hiringTeamSelectors
      );
      return contacts;
    }

    extensionLoggerContent.debug(
      "[LinkedIn Scam Detector] Found hiring team section:",
      {
        tagName: hiringTeamSection.tagName,
        className: hiringTeamSection.className,
        id: hiringTeamSection.id,
      }
    );

    // Find all contact cards
    // Based on DOM structure: <div class="display-flex align-items-center mt4">
    // But we need to be more specific - look for divs containing profile links and hirer-card classes
    const contactCardSelectors = [
      // New LinkedIn structure: div containing .hirer-card__hirer-information
      'div.display-flex.align-items-center.mt4:has(.hirer-card__hirer-information)',
      'div:has(.hirer-card__hirer-information)',
      // More generic: divs with display-flex that contain profile links
      'div.display-flex.align-items-center:has(a[href*="/in/"])',
      // Old selectors for backward compatibility
      ".jobs-hiring-team__member",
      ".hiring-team-member",
      ".hiringTeamMember",
      'li[class*="hiring-team"]',
      'li[class*="hiringTeam"]',
      '[data-test-id="hiring-team-member"]',
      '[data-test-id*="hiring-team"]',
    ];

    let contactCards: Element[] = [];
    
    // First try: Look for divs containing .hirer-card__hirer-information (new LinkedIn structure)
    const hirerInfoElements = Array.from(
      hiringTeamSection.querySelectorAll(".hirer-card__hirer-information")
    );
    
    if (hirerInfoElements.length > 0) {
      // Get parent divs (the contact card containers)
      contactCards = hirerInfoElements
        .map((el) => el.closest("div.display-flex.align-items-center") || el.parentElement)
        .filter((el): el is Element => el !== null && el !== undefined);
      
      extensionLoggerContent.debug(
        `[LinkedIn Scam Detector] Found ${contactCards.length} contact cards using .hirer-card__hirer-information`
      );
    }
    
    // Fallback: Try other selectors
    if (contactCards.length === 0) {
      for (const selector of contactCardSelectors) {
        // Skip :has() selectors as they may not be supported in all browsers
        if (selector.includes(":has(")) {
          // Manual check for :has() pattern
          const baseSelector = selector.split(":has(")[0];
          const hasSelector = selector.match(/:has\(([^)]+)\)/)?.[1];
          if (baseSelector && hasSelector) {
            const elements = Array.from(
              hiringTeamSection.querySelectorAll(baseSelector)
            );
            contactCards = elements.filter((el) => {
              try {
                return el.querySelector(hasSelector) !== null;
              } catch {
                return false;
              }
            });
            if (contactCards.length > 0) {
              extensionLoggerContent.debug(
                `[LinkedIn Scam Detector] Found ${contactCards.length} contact cards using selector: ${selector}`
              );
              break;
            }
          }
        } else {
          contactCards = Array.from(hiringTeamSection.querySelectorAll(selector));
          if (contactCards.length > 0) {
            extensionLoggerContent.debug(
              `[LinkedIn Scam Detector] Found ${contactCards.length} contact cards using selector: ${selector}`
            );
            break;
          }
        }
      }
    }

    if (contactCards.length === 0) {
      extensionLoggerContent.debug(
        "[LinkedIn Scam Detector] No contact cards found. Tried selectors:",
        contactCardSelectors,
        {
          sectionHTML: hiringTeamSection.innerHTML.substring(0, 500), // First 500 chars for debugging
        }
      );
    }

    for (const card of contactCards) {
      try {
        // Extract profile URL
        const profileLinkElement = card.querySelector('a[href*="/in/"]');
        const profileUrl = profileLinkElement?.getAttribute("href") || null;

        if (!profileUrl) continue;

        // Extract LinkedIn profile ID from URL like /in/ebrueksi
        const profileMatch = profileUrl.match(/\/in\/([^/?]+)/);
        if (!profileMatch?.[1]) continue;

        const linkedinProfileId = profileMatch[1];

        // Build full profile URL if relative
        const fullProfileUrl = profileUrl.startsWith("http")
          ? profileUrl
          : `https://www.linkedin.com${profileUrl}`;

        // Extract name
        // New LinkedIn structure: .jobs-poster__name > strong
        // Old structure: .hiring-team-member__name or .jobs-hiring-team__member-name
        const nameElement =
          card.querySelector(".jobs-poster__name strong") ||
          card.querySelector(".jobs-poster__name") ||
          card.querySelector(".hiring-team-member__name") ||
          card.querySelector(".jobs-hiring-team__member-name");
        const name = nameElement?.textContent?.trim() || null;

        if (!name) continue;

        // Extract profile image
        const profileImageElement = card.querySelector("img");
        const profileImageUrl =
          profileImageElement?.getAttribute("src") || null;

        // Extract verified status
        // New LinkedIn structure: .tvm__text--low-emphasis with SVG containing verified-small
        // Also check aria-label and class names
        const isVerified =
          card.querySelector('[aria-label*="verified"]') !== null ||
          card.querySelector('[data-test-icon="verified-small"]') !== null ||
          card.querySelector('.tvm__text--low-emphasis svg[data-test-icon="verified-small"]') !== null ||
          card.querySelector('[class*="verified"]') !== null;

        // Extract role/title
        // New LinkedIn structure: .text-body-small.t-black contains the title/role
        // Look within .hirer-card__hirer-information or .linked-area
        const hirerInfo = card.querySelector(".hirer-card__hirer-information");
        const linkedArea = hirerInfo?.querySelector(".linked-area");
        
        // Extract full title (e.g., "Senior Talent Acquisition and Employer Branding Specialist @Pegasus Airlines")
        const titleElement =
          linkedArea?.querySelector(".text-body-small.t-black") ||
          card.querySelector(".hiring-team-member__title") ||
          card.querySelector(".jobs-hiring-team__member-title");
        const title = titleElement?.textContent?.trim() || null;
        
        // Extract role (if separate from title, or extract from title)
        // For now, use title as role if no separate role field exists
        const roleElement =
          card.querySelector(".hiring-team-member__role") ||
          card.querySelector(".jobs-hiring-team__member-role");
        const role = roleElement?.textContent?.trim() || title || null;

        // Extract connection degree
        // New LinkedIn structure: .hirer-card__connection-degree
        const connectionElement =
          card.querySelector(".hirer-card__connection-degree") ||
          card.querySelector(".hiring-team-member__connection") ||
          card.querySelector(".jobs-hiring-team__member-connection");
        const connectionDegree = connectionElement?.textContent?.trim() || null;

        // Check if this is the job poster
        // New LinkedIn structure: .hirer-card__job-poster contains "Job poster"
        const jobPosterElement = card.querySelector(".hirer-card__job-poster");
        const cardText = card.textContent?.toLowerCase() || "";
        const isJobPoster =
          jobPosterElement?.textContent?.toLowerCase().includes("job poster") === true ||
          cardText.includes("job poster") ||
          cardText.includes("posted") ||
          card.querySelector('[data-test-id="job-poster"]') !== null;

        // Determine relationship type
        let relationshipType = "hiring_team_member";
        if (isJobPoster) {
          relationshipType = "job_poster";
        } else if (role?.toLowerCase().includes("manager")) {
          relationshipType = "hiring_manager";
        } else if (
          role?.toLowerCase().includes("recruiter") ||
          role?.toLowerCase().includes("talent")
        ) {
          relationshipType = "recruiter";
        }

        contacts.push({
          linkedinProfileId,
          name,
          profileUrl: fullProfileUrl,
          profileImageUrl: profileImageUrl || undefined,
          isVerified: isVerified || false,
          role: role || undefined,
          title: title || undefined,
          connectionDegree: connectionDegree || undefined,
          isJobPoster: isJobPoster || false,
          relationshipType,
        });
      } catch (error) {
        extensionLoggerContent.warn(
          "[LinkedIn Scam Detector] Failed to extract contact from hiring team:",
          error
        );
      }
    }
  } catch (error) {
    extensionLoggerContent.warn(
      "[LinkedIn Scam Detector] Failed to extract hiring team:",
      error
    );
  }

  return contacts;
}

/**
 * Extract job data from a full job posting page
 */
export function extractJobDataFromPage(): JobData | null {
  try {
    // Extract job title
    const titleElement = findElement(document, SELECTORS.jobTitle);
    const title = titleElement?.textContent?.trim() || "";

    if (!title) {
      return null;
    }

    // Extract company name
    const companyElement = findElement(document, SELECTORS.companyName);
    const company = companyElement?.textContent?.trim() || "";

    // Extract full job description as HTML
    const descriptionElement = findElement(document, SELECTORS.jobDescription);

    // Safely extract HTML - ensure element is HTMLElement and has innerHTML property
    let descriptionHtml = "";
    if (descriptionElement && descriptionElement instanceof HTMLElement) {
      try {
        descriptionHtml = descriptionElement.innerHTML?.trim() || "";
      } catch (error) {
        // Fallback to textContent if innerHTML access fails
        extensionLoggerContent.debug(
          "[LinkedIn Scam Detector] innerHTML access failed, using textContent:",
          error
        );
        descriptionHtml = descriptionElement.textContent?.trim() || "";
      }
    }

    // Convert HTML to Markdown with error handling
    let description = "";
    if (descriptionHtml) {
      try {
        description = convertHtmlToMarkdown(descriptionHtml);
      } catch (error) {
        extensionLoggerContent.error(
          "[LinkedIn Scam Detector] Failed to convert HTML to Markdown:",
          error
        );
        // Fallback to plain text if conversion fails
        description = descriptionHtml.replace(/<[^>]*>/g, "").trim();
      }
    }

    // Use current URL
    const url = window.location.href;

    // Extract LinkedIn job ID from URL
    const linkedinJobId = extractLinkedInJobId(url);

    // Extract salary if available
    const salaryElement = findElement(document, SELECTORS.salary);
    const salary = salaryElement?.textContent?.trim();

    // Extract location if available
    // New LinkedIn structure: First span in tertiary description container
    let location: string | undefined;
    const tertiaryContainer = document.querySelector(
      ".job-details-jobs-unified-top-card__tertiary-description-container"
    );
    if (tertiaryContainer) {
      // Get first span with location text (before the "·" separator)
      const spans = Array.from(tertiaryContainer.querySelectorAll("span.tvm__text--low-emphasis"));
      if (spans.length > 0) {
        const locationText = spans[0]?.textContent?.trim();
        // Make sure it's not a date or other metadata
        if (locationText && !locationText.match(/\d+\s+(day|days|week|weeks|month|months|hour|hours)\s+ago/i) && 
            !locationText.toLowerCase().includes("people clicked") &&
            !locationText.toLowerCase().includes("promoted") &&
            !locationText.toLowerCase().includes("responses")) {
          location = locationText;
        }
      }
    }
    // Fallback to old selector
    if (!location) {
      const locationElement = findElement(document, SELECTORS.location);
      location = locationElement?.textContent?.trim();
    }

    // Extract employment type
    const employmentType = extractEmploymentType(document);

    // Extract posted date
    const postedDate = extractPostedDate(document);

    // Extract company information
    const companyData = extractCompanyInfo(document);

    // Extract hiring team contacts
    const contacts = extractHiringTeam(document);

    // Extract additional metadata for rawData
    const rawData: Record<string, unknown> = {
      linkedinJobId,
    };

    // Extract additional metadata from tertiary description container (reuse variable)
    if (tertiaryContainer) {
      const spans = Array.from(tertiaryContainer.querySelectorAll("span.tvm__text--low-emphasis"));
      const metadata: string[] = [];
      for (const span of spans) {
        const text = span.textContent?.trim();
        if (text) {
          metadata.push(text);
        }
      }
      if (metadata.length > 0) {
        rawData.metadata = metadata;
      }
      
      // Extract specific metadata fields
      const fullText = tertiaryContainer.textContent || "";
      if (fullText.includes("people clicked apply")) {
        const match = fullText.match(/(\d+)\s+people\s+clicked\s+apply/i);
        if (match?.[1]) {
          rawData.applicantCount = parseInt(match[1], 10);
        }
      }
      if (fullText.toLowerCase().includes("promoted by hirer")) {
        rawData.isPromoted = true;
      }
      if (fullText.toLowerCase().includes("responses managed off linkedin")) {
        rawData.responsesManagedOffLinkedIn = true;
      }
    }

    // Extract work type (Hybrid, Remote, etc.) from fit-level-preferences
    const preferencesContainer = document.querySelector(
      ".job-details-fit-level-preferences"
    );
    if (preferencesContainer) {
      const buttons = Array.from(preferencesContainer.querySelectorAll("button"));
      const workTypes: string[] = [];
      for (const button of buttons) {
        const text = button.textContent?.trim();
        if (text && !text.match(/full[- ]?time|part[- ]?time|contract|temporary|internship/i)) {
          workTypes.push(text);
        }
      }
      if (workTypes.length > 0) {
        rawData.workTypes = workTypes;
      }
    }

    return {
      title,
      company,
      description,
      url,
      salary,
      location,
      employmentType,
      postedDate,
      linkedinJobId,
      companyData: companyData || undefined,
      contacts: contacts.length > 0 ? contacts : undefined,
      rawData,
    };
  } catch (error) {
    extensionLoggerContent.error(
      "[LinkedIn Scam Detector] Error extracting job data from page:",
      {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        url: window.location.href,
      }
    );
    return null;
  }
}

/**
 * Check if we're on a job search results page
 */
export function isJobSearchPage(): boolean {
  const pathname = window.location.pathname;
  const isSearchPage =
    pathname.includes("/jobs/search") ||
    pathname.includes("/jobs/collections") ||
    (pathname === "/jobs/search/" && window.location.search.length > 0);

  return isSearchPage;
}

/**
 * Check if we're on an individual job posting page
 * This includes:
 * - Direct job view pages: /jobs/view/123456
 * - Collections pages with currentJobId: /jobs/collections/recommended/?currentJobId=123456
 */
export function isJobPostingPage(): boolean {
  const pathname = window.location.pathname;
  const searchParams = new URLSearchParams(window.location.search);

  // Check for direct job view URL
  if (
    pathname.includes("/jobs/view/") ||
    !!pathname.match(/\/jobs\/view\/\d+/)
  ) {
    return true;
  }

  // Check for collections page with currentJobId query parameter
  if (
    pathname.includes("/jobs/collections/") &&
    searchParams.has("currentJobId")
  ) {
    return true;
  }

  return false;
}

/**
 * Generate a unique ID for a job based on its URL or title
 * Handles both direct job view URLs and collections pages with currentJobId
 */
export function generateJobId(jobData: { url: string; title: string }): string {
  // Extract job ID from URL - supports multiple formats:
  // 1. Direct view: /jobs/view/123456
  // 2. Collections: /jobs/collections/recommended/?currentJobId=123456
  const urlMatch = jobData.url.match(/\/jobs\/view\/(\d+)/);
  if (urlMatch?.[1]) {
    return `job-${urlMatch[1]}`;
  }

  // Check for currentJobId in query parameters (collections pages)
  try {
    const urlObj = new URL(jobData.url);
    const currentJobId = urlObj.searchParams.get("currentJobId");
    if (currentJobId) {
      return `job-${currentJobId}`;
    }
  } catch {
    // Invalid URL, fall through to hash generation
  }

  // Fallback: create hash from title + URL
  const hash = jobData.title + jobData.url;
  let hashValue = 0;
  for (let i = 0; i < hash.length; i++) {
    const char = hash.charCodeAt(i);
    hashValue = (hashValue << 5) - hashValue + char;
    hashValue = hashValue & hashValue; // Convert to 32-bit integer
  }
  return `job-${Math.abs(hashValue)}`;
}

/**
 * Extract work type from location text
 * e.g., "Istanbul, Turkey (Remote)" → "remote"
 */
function extractWorkType(locationText?: string | null): string | undefined {
  if (!locationText) return undefined;
  const lowerText = locationText.toLowerCase();
  if (lowerText.includes("remote")) return "remote";
  if (lowerText.includes("hybrid")) return "hybrid";
  if (lowerText.includes("on-site") || lowerText.includes("onsite"))
    return "on-site";
  return undefined;
}

/**
 * Extract job card data from a list item element (search/collection pages)
 */
export function extractJobCardFromElement(
  li: HTMLElement
): DiscoveredJobData | null {
  try {
    // Extract LinkedIn job ID from data attributes
    const jobId =
      li.dataset.occludableJobId ||
      li.dataset.jobId ||
      li.querySelector("[data-job-id]")?.getAttribute("data-job-id");

    if (!jobId) {
      return null;
    }

    // Extract job link
    const link = li.querySelector<HTMLAnchorElement>('a[href*="/jobs/view/"]');
    const url = link?.href || `https://www.linkedin.com/jobs/view/${jobId}`;

    // Extract title
    const titleElement = li.querySelector(
      ".job-card-list__title strong, .job-card-container__link strong"
    );
    const title = titleElement?.textContent?.trim();

    if (!title) {
      return null;
    }

    // Extract company
    const companyElement = li.querySelector(
      ".artdeco-entity-lockup__subtitle span, .job-card-container__company-name"
    );
    const company = companyElement?.textContent?.trim();

    if (!company) {
      return null;
    }

    // Extract location and work type
    const locationElement = li.querySelector(
      ".job-card-container__metadata-wrapper li"
    );
    const locationText = locationElement?.textContent?.trim();
    const workType = extractWorkType(locationText);

    // Extract employment type (may be in insights or metadata)
    const employmentTypeText = Array.from(
      li.querySelectorAll(".job-card-container__metadata-wrapper li")
    )
      .map((el) => el.textContent?.trim())
      .find((text) =>
        /full-time|part-time|contract|temporary|internship/i.test(text || "")
      );

    // Check for "Promoted" badge
    const isPromoted = !!Array.from(
      li.querySelectorAll(".job-card-container__footer-item")
    ).find((el) => el.textContent?.toLowerCase().includes("promoted"));

    // Check for "Easy Apply" badge
    const isEasyApply = !!li.querySelector(
      'svg[data-test-icon="linkedin-bug-color-small"]'
    );

    // Check for verified badge
    const hasVerified = !!li.querySelector('[aria-label*="Verified"]');

    // Extract insight text
    const insightElement = li.querySelector(
      ".job-card-container__job-insight-text"
    );
    const insight = insightElement?.textContent?.trim();

    // Extract company logo
    const logoImg = li.querySelector<HTMLImageElement>(
      ".job-card-list__logo img, .job-card-container__logo img"
    );
    const companyLogoUrl = logoImg?.src;

    // Extract posted date (may be in footer or insights)
    const postedDateText = Array.from(
      li.querySelectorAll(
        ".job-card-container__footer-item, .job-card-list__footer-item"
      )
    )
      .map((el) => el.textContent?.trim())
      .find((text) =>
        /\d+\s+(day|days|week|weeks|month|months)\s+ago/i.test(text || "")
      );

    // Determine discovery source from URL
    const pathname = window.location.pathname;
    let discoverySource = "search";
    if (pathname.includes("/jobs/collections")) {
      discoverySource = "collections";
    } else if (pathname.includes("/jobs/search")) {
      discoverySource = "search";
    }

    return {
      linkedinJobId: jobId,
      url,
      title,
      company,
      location: locationText,
      employmentType: employmentTypeText,
      workType,
      isPromoted,
      isEasyApply,
      hasVerified,
      insight,
      postedDate: postedDateText,
      companyLogoUrl,
      discoverySource,
      discoveryUrl: window.location.href,
    };
  } catch (error) {
    extensionLoggerContent.error(
      "[LinkedIn Scam Detector] Error extracting job card:",
      {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : typeof error,
        stack: error instanceof Error ? error.stack : undefined,
        url: window.location.href,
      }
    );
    return null;
  }
}

/**
 * Extract all job cards from search/collection page
 */
export function extractJobCardsFromList(
  container: HTMLElement | Document = document
): DiscoveredJobData[] {
  const jobs: DiscoveredJobData[] = [];

  // Find all job card list items
  const jobCards = container.querySelectorAll<HTMLElement>(
    "li[data-occludable-job-id], li[data-job-id], li.jobs-search-results__list-item"
  );

  for (const card of jobCards) {
    const jobData = extractJobCardFromElement(card);
    if (jobData) {
      jobs.push(jobData);
    }
  }

  return jobs;
}
