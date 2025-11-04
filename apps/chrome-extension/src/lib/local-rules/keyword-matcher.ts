import type { LocalRuleFlag } from "./types";

const SCAM_KEYWORDS = {
  high_risk: [
    "wire transfer",
    "western union",
    "moneygram",
    "training fee",
    "background check fee",
    "starter kit purchase",
    "cashier's check",
    "cryptocurrency investment",
    "bitcoin",
    "paypal friends",
    "venmo",
    "zelle",
    "gift card",
    "money order",
  ],
  medium_risk: [
    "work from home guaranteed",
    "no experience required",
    "earn $10,000/month",
    "earn $5,000/week",
    "apply within 24 hours",
    "limited positions",
    "be your own boss",
    "unlimited earning potential",
    "must act now",
    "urgent hiring",
    "immediate start",
    "quick money",
    "easy money",
    "get rich quick",
  ],
  mlm_keywords: [
    "recruit others",
    "build your team",
    "pyramid scheme",
    "multi-level marketing",
    "mlm",
    "network marketing",
    "downline",
    "upline",
  ],
};

export function keywordMatcher(description: string): LocalRuleFlag[] {
  const flags: LocalRuleFlag[] = [];
  const lowerDesc = description.toLowerCase();

  // Check high-risk keywords
  for (const keyword of SCAM_KEYWORDS.high_risk) {
    if (lowerDesc.includes(keyword.toLowerCase())) {
      flags.push({
        type: "scam_keyword",
        confidence: "high",
        message: `Contains suspicious phrase: "${keyword}". This is a common scam tactic.`,
      });
    }
  }

  // Check MLM keywords
  const mlmMatches = SCAM_KEYWORDS.mlm_keywords.filter((kw) =>
    lowerDesc.includes(kw.toLowerCase())
  );

  if (mlmMatches.length > 0) {
    flags.push({
      type: "mlm_language",
      confidence: "high",
      message: `Contains multi-level marketing (MLM) language. This is often associated with scams.`,
    });
  }

  // Check medium-risk keywords (need multiple matches)
  const mediumMatches = SCAM_KEYWORDS.medium_risk.filter((kw) =>
    lowerDesc.includes(kw.toLowerCase())
  );

  if (mediumMatches.length >= 2) {
    flags.push({
      type: "urgency_language",
      confidence: "medium",
      message: `Multiple urgency/pressure tactics detected. Legitimate jobs don't rush candidates.`,
    });
  } else if (mediumMatches.length === 1) {
    // Single medium-risk keyword is less concerning
    flags.push({
      type: "suspicious_language",
      confidence: "low",
      message: `Contains potentially suspicious language: "${mediumMatches[0]}". Proceed with caution.`,
    });
  }

  return flags;
}
