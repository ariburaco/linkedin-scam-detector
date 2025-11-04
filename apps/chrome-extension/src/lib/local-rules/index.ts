import { emailCheck } from "./email-check";
import { grammarCheck } from "./grammar-check";
import { keywordMatcher } from "./keyword-matcher";
import { salaryAnalyzer } from "./salary-analyzer";
import type { JobData, LocalRulesResult } from "./types";

/**
 * Local Rules Engine for instant scam detection.
 * Runs client-side analysis without API calls.
 * Target execution time: <100ms
 */
export class LocalRulesEngine {
  /**
   * Analyze job posting data and return risk assessment
   */
  analyze(jobData: JobData): LocalRulesResult {
    const flags: LocalRulesResult["flags"] = [];
    let riskScore = 0;

    // 1. Email domain check (high confidence, high impact)
    const emailFlags = emailCheck(jobData.description);
    flags.push(...emailFlags);
    riskScore += emailFlags.length * 25;

    // 2. Keyword pattern matching (medium-high confidence, medium impact)
    const keywordFlags = keywordMatcher(jobData.description);
    flags.push(...keywordFlags);
    // High confidence keywords add more points
    const highConfidenceKeywords = keywordFlags.filter(
      (f) => f.confidence === "high"
    ).length;
    const mediumConfidenceKeywords = keywordFlags.filter(
      (f) => f.confidence === "medium"
    ).length;
    riskScore += highConfidenceKeywords * 20 + mediumConfidenceKeywords * 10;

    // 3. Salary analysis (medium-high confidence, medium impact)
    if (jobData.salary) {
      const salaryFlags = salaryAnalyzer(jobData.salary, jobData.title);
      flags.push(...salaryFlags);
      const highConfidenceSalary = salaryFlags.filter(
        (f) => f.confidence === "high"
      ).length;
      const mediumConfidenceSalary = salaryFlags.filter(
        (f) => f.confidence === "medium"
      ).length;
      riskScore += highConfidenceSalary * 20 + mediumConfidenceSalary * 10;
    }

    // 4. Grammar quality check (low-medium confidence, low impact)
    const grammarFlags = grammarCheck(jobData.description);
    flags.push(...grammarFlags);
    const mediumConfidenceGrammar = grammarFlags.filter(
      (f) => f.confidence === "medium"
    ).length;
    riskScore += mediumConfidenceGrammar * 5;

    // Cap at 100
    riskScore = Math.min(riskScore, 100);

    // Determine risk level
    let riskLevel: "safe" | "caution" | "danger" = "safe";
    if (riskScore >= 70) {
      riskLevel = "danger";
    } else if (riskScore >= 40) {
      riskLevel = "caution";
    }

    return { riskScore, riskLevel, flags };
  }
}

// Export convenience function
export function analyzeJobPosting(jobData: JobData): LocalRulesResult {
  const engine = new LocalRulesEngine();
  return engine.analyze(jobData);
}

// Export individual rule functions for testing
export { emailCheck, keywordMatcher, salaryAnalyzer, grammarCheck };
export type { JobData, LocalRulesResult, LocalRuleFlag } from "./types";
