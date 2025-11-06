/**
 * Cookie Utilities
 * Parse and format cookies for Puppeteer injection
 */

/// <reference lib="dom" />

export interface LinkedInCookie {
  name: string;
  value: string;
  domain: string;
  path?: string;
  expires?: number; // Unix timestamp in seconds
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

/**
 * Parse Chrome DevTools Application tab cookie format
 * Supports copy-paste from Chrome DevTools > Application > Cookies table
 * Format: Tab-separated values or JSON array
 */
export function parseChromeDevToolsCookies(cookies: string): LinkedInCookie[] {
  const lines = cookies.trim().split('\n');
  const result: LinkedInCookie[] = [];

  // Try JSON format first (Chrome export)
  try {
    const json = JSON.parse(cookies);
    if (Array.isArray(json)) {
      return json.map(parseChromeCookieObject);
    }
  } catch {
    // Not JSON, continue with text parsing
  }

  // Try tab-separated format (copy-paste from table)
  // Expected format: Name, Value, Domain, Path, Expires, Size, HttpOnly, Secure, SameSite, Priority
  if (lines.length > 1) {
    // Skip header row if present
    const startIndex = lines[0]?.toLowerCase().includes('name') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i]?.trim();
      if (!line) {
        continue;
      }

      const parts = line.split('\t');
      if (parts.length < 3) {
        // Try comma-separated
        const commaParts = line.split(',');
        if (commaParts.length >= 3) {
          parseCookieRow(commaParts, result);
        }
      } else {
        parseCookieRow(parts, result);
      }
    }
  }

  return result;
}

/**
 * Parse Chrome cookie export JSON format
 */
export function parseChromeExportCookies(cookies: string): LinkedInCookie[] {
  try {
    const data = JSON.parse(cookies);
    if (Array.isArray(data)) {
      return data.map(parseChromeCookieObject);
    }
    // Handle single object
    if (data && typeof data === 'object') {
      return [parseChromeCookieObject(data)];
    }
    return [];
  } catch (error) {
    throw new Error(`Failed to parse Chrome export format: ${error}`);
  }
}

/**
 * Parse Netscape cookie file format
 */
export function parseNetscapeCookies(cookies: string): LinkedInCookie[] {
  const lines = cookies.split('\n');
  const result: LinkedInCookie[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Netscape format: domain, flag, path, secure, expiration, name, value
    const parts = trimmed.split('\t');
    if (parts.length >= 7) {
      const [domain, , path, secure, expiration, name, ...valueParts] = parts;
      const value = valueParts.join('\t');

      const expires =
        expiration && expiration !== '0' ? parseInt(expiration, 10) : undefined;
      if (!name || !domain) {
        continue;
      }
      result.push({
        name: name.trim(),
        value: value.trim(),
        domain: domain.trim(),
        path: path?.trim() || '/',
        expires,
        httpOnly: false,
        secure: secure === 'TRUE',
        sameSite: undefined,
      });
    }
  }

  return result;
}

/**
 * Parse a single cookie row from tab/comma-separated format
 */
function parseCookieRow(parts: string[], result: LinkedInCookie[]): void {
  if (parts.length < 3) return;

  const name = parts[0]?.trim();
  const value = parts[1]?.trim();
  const domain = parts[2]?.trim();

  if (!name || !value || !domain) {
    return;
  }

  // Parse expires (could be timestamp or date string)
  let expires: number | undefined;
  if (parts[4]) {
    const expiresStr = parts[4].trim();
    if (expiresStr && expiresStr !== 'Session') {
      const expiresDate = new Date(expiresStr);
      if (!isNaN(expiresDate.getTime())) {
        expires = Math.floor(expiresDate.getTime() / 1000);
      } else {
        // Try as timestamp
        const timestamp = parseInt(expiresStr, 10);
        if (!isNaN(timestamp)) {
          expires =
            timestamp > 1000000000000
              ? Math.floor(timestamp / 1000)
              : timestamp;
        }
      }
    }
  }

  // Parse boolean flags
  const httpOnly =
    parts[6]?.trim().toLowerCase() === 'true' || parts[6]?.trim() === '✓';
  const secure =
    parts[7]?.trim().toLowerCase() === 'true' || parts[7]?.trim() === '✓';
  const sameSite = parts[8]?.trim() || undefined;

  result.push({
    name,
    value,
    domain: normalizeDomain(domain),
    path: parts[3]?.trim() || '/',
    expires,
    httpOnly,
    secure: secure !== false, // Default to true for LinkedIn
    sameSite: sameSite as 'Strict' | 'Lax' | 'None' | undefined,
  });
}

/**
 * Parse Chrome cookie object from JSON export
 */
function parseChromeCookieObject(cookie: any): LinkedInCookie {
  const expires = cookie.expirationDate
    ? Math.floor(cookie.expirationDate)
    : undefined;

  return {
    name: cookie.name,
    value: cookie.value,
    domain: normalizeDomain(cookie.domain),
    path: cookie.path || '/',
    expires,
    httpOnly: cookie.httpOnly ?? false,
    secure: cookie.secure ?? true,
    sameSite: cookie.sameSite as 'Strict' | 'Lax' | 'None' | undefined,
  };
}

/**
 * Normalize domain (handle .linkedin.com vs www.linkedin.com)
 */
export function normalizeDomain(domain: string): string {
  const normalized = domain.trim();

  // Remove leading dot if present for consistency
  if (normalized.startsWith('.')) {
    return normalized;
  }

  // For linkedin.com domains, prefer .linkedin.com format
  if (normalized.includes('linkedin.com')) {
    // Handle .www.linkedin.com -> .linkedin.com
    if (
      normalized === '.www.linkedin.com' ||
      normalized === 'www.linkedin.com' ||
      normalized === 'linkedin.com'
    ) {
      return '.linkedin.com';
    }
    if (!normalized.startsWith('.')) {
      return `.${normalized}`;
    }
  }

  return normalized;
}

/**
 * Validate cookies (check for required cookies like li_at)
 */
export function validateCookies(cookies: LinkedInCookie[]): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (cookies.length === 0) {
    errors.push('No cookies provided');
    return { valid: false, errors };
  }

  // Check for li_at cookie (main authentication cookie)
  const hasLiAt = cookies.some((c) => c.name === 'li_at');
  if (!hasLiAt) {
    errors.push(
      'Missing required cookie: li_at (LinkedIn authentication token)'
    );
  }

  // Check for expired cookies
  const now = Math.floor(Date.now() / 1000);
  const expiredCookies = cookies.filter((c) => c.expires && c.expires < now);
  if (expiredCookies.length > 0) {
    errors.push(
      `Found ${expiredCookies.length} expired cookie(s): ${expiredCookies.map((c) => c.name).join(', ')}`
    );
  }

  // Validate domain
  const invalidDomains = cookies.filter(
    (c) => !c.domain.includes('linkedin.com')
  );
  if (invalidDomains.length > 0) {
    errors.push(
      `Found ${invalidDomains.length} cookie(s) with invalid domain: ${invalidDomains.map((c) => `${c.name} (${c.domain})`).join(', ')}`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format cookies for Puppeteer (ensure all required fields)
 */
export function formatCookiesForPuppeteer(
  cookies: LinkedInCookie[]
): LinkedInCookie[] {
  return cookies.map((cookie) => ({
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path || '/',
    expires: cookie.expires,
    httpOnly: cookie.httpOnly ?? false,
    secure: cookie.secure ?? true,
    sameSite: cookie.sameSite,
  }));
}
