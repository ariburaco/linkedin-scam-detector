import type { LocalRuleFlag } from "./types";

/**
 * Simplified grammar quality check without external dependencies.
 * Checks for common red flags in scam job postings:
 * - Excessive capitalization
 * - Excessive exclamation marks
 * - Common spelling errors
 * - Unprofessional language patterns
 */
export function grammarCheck(description: string): LocalRuleFlag[] {
  const flags: LocalRuleFlag[] = [];

  // Check for excessive capitalization (more than 10% of words)
  const words = description.split(/\s+/);
  const capitalizedWords = words.filter(
    (word) => word.length > 1 && word[0] === word[0]?.toUpperCase(),
  );
  const capitalizationRatio = capitalizedWords.length / words.length;

  if (capitalizationRatio > 0.15) {
    flags.push({
      type: "excessive_capitalization",
      confidence: "medium",
      message: `Excessive capitalization detected. Professional job postings use normal capitalization.`,
    });
  }

  // Check for excessive exclamation marks (more than 1 per 200 characters)
  const exclamationCount = (description.match(/!/g) || []).length;
  const exclamationRatio = exclamationCount / description.length;

  if (exclamationRatio > 0.005) {
    // More than 1 exclamation per 200 characters
    flags.push({
      type: "excessive_exclamation",
      confidence: "low",
      message: `Excessive exclamation marks detected. Legitimate job postings are professional and measured.`,
    });
  }

  // Check for common scam spelling patterns
  const scamSpellingPatterns = [
    /\bu\s+r\s+e\s+/gi, // "u r e" instead of "you are"
    /\bthru\b/gi, // "thru" instead of "through"
    /\bu\s+r\s+/gi, // "u r" instead of "you are"
    /\b2\s+b\s+/gi, // "2 b" instead of "to be"
  ];

  for (const pattern of scamSpellingPatterns) {
    if (pattern.test(description)) {
      flags.push({
        type: "unprofessional_language",
        confidence: "medium",
        message: `Unprofessional language patterns detected. Legitimate job postings use proper spelling and grammar.`,
      });
      break; // Only flag once
    }
  }

  // Check for excessive all-caps words (common in scams)
  const allCapsWords = words.filter(
    (word) => word.length > 2 && word === word.toUpperCase() && /[A-Z]/.test(word),
  );
  if (allCapsWords.length > 3) {
    flags.push({
      type: "excessive_all_caps",
      confidence: "medium",
      message: `Multiple words in all caps detected. Professional job postings avoid excessive capitalization.`,
    });
  }

  // Check for suspicious repetition patterns
  const suspiciousPatterns = [
    /(.)\1{4,}/g, // Repeated characters (e.g., "aaaaa")
    /(wow|amazing|incredible|unbelievable){2,}/gi, // Excessive superlatives
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(description)) {
      flags.push({
        type: "suspicious_language_pattern",
        confidence: "low",
        message: `Suspicious language patterns detected. Legitimate job postings are professional and concise.`,
      });
      break;
    }
  }

  return flags;
}

