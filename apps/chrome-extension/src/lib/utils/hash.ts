/**
 * Hash a string using SHA-256 (Web Crypto API)
 * 
 * Used for hashing job URLs and other sensitive data to ensure privacy.
 * Works in both browser and Chrome extension background worker contexts.
 * 
 * @param text - The string to hash
 * @returns Promise resolving to a hexadecimal SHA-256 hash string
 * 
 * @example
 * ```ts
 * const hash = await hashString("https://linkedin.com/jobs/view/123");
 * // Returns: "a1b2c3d4e5f6..." (64 character hex string)
 * ```
 */
export async function hashString(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

