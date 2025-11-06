/**
 * Date utility functions
 */

/**
 * Parse posted date string to DateTime
 * Handles relative dates like "Posted 2 days ago", "Posted 1 week ago", etc.
 *
 * @param dateString - Date string to parse (e.g., "Posted 2 days ago")
 * @returns Parsed Date object or null if parsing fails
 */
export function parsePostedDate(dateString?: string): Date | null {
  if (!dateString) return null;

  // Try to parse relative dates like "Posted 2 days ago"
  const match = dateString.match(
    /(\d+)\s+(day|days|week|weeks|month|months)\s+ago/i
  );
  if (match) {
    const amount = parseInt(match[1] || "0", 10);
    const unit = match[2]?.toLowerCase() || "";

    const now = new Date();
    if (unit.startsWith("day")) {
      now.setDate(now.getDate() - amount);
    } else if (unit.startsWith("week")) {
      now.setDate(now.getDate() - amount * 7);
    } else if (unit.startsWith("month")) {
      now.setMonth(now.getMonth() - amount);
    }
    return now;
  }

  return null;
}

