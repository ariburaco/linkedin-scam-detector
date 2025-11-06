/**
 * LinkedIn URL Parser
 * Extracts job IDs from various LinkedIn job URL formats
 */

/**
 * Extract LinkedIn job ID from URL
 * Supports multiple URL formats:
 * - /jobs/view/123456
 * - /jobs/view/job-title-slug-123456
 * - /jobs/collections/recommended/?currentJobId=123456
 * - /jobs/search/?currentJobId=123456
 */
export function extractLinkedInJobId(url: string): string | null {
  if (!url || typeof url !== "string") {
    return null;
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
    const urlObj = new URL(url);
    const currentJobId = urlObj.searchParams.get("currentJobId");
    if (currentJobId) {
      return currentJobId;
    }
  } catch {
    // Invalid URL format, continue to return null
  }

  return null;
}
