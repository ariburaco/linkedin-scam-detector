import type { LocalRuleFlag } from "./types";

const PERSONAL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "aol.com",
  "icloud.com",
  "protonmail.com",
];

const RECRUITING_DOMAINS = [
  "indeed.com",
  "linkedin.com",
  "glassdoor.com",
  "ziprecruiter.com",
];

export function emailCheck(description: string): LocalRuleFlag[] {
  const flags: LocalRuleFlag[] = [];

  // Extract emails using regex
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = description.match(emailRegex) || [];

  for (const email of emails) {
    const domain = email.split("@")[1]?.toLowerCase();
    if (!domain) continue;

    // Skip known recruiting domains
    if (RECRUITING_DOMAINS.includes(domain)) {
      continue;
    }

    // Flag personal domains
    if (PERSONAL_DOMAINS.includes(domain)) {
      flags.push({
        type: "personal_email",
        confidence: "high",
        message: `Contact email uses personal domain (${domain}). Legitimate recruiters typically use company emails.`,
      });
    }
  }

  return flags;
}
