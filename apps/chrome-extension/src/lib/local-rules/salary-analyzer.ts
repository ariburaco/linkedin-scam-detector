import type { LocalRuleFlag } from "./types";

export function salaryAnalyzer(
  salary: string,
  jobTitle: string
): LocalRuleFlag[] {
  const flags: LocalRuleFlag[] = [];

  // Extract salary numbers (handles ranges like "$50,000 - $80,000" or "$80K-$100K")
  const salaryPattern = /\$?([\d,]+)(?:K|k|,000)?/g;
  const matches = Array.from(salary.matchAll(salaryPattern));
  const amounts: number[] = [];

  for (const match of matches) {
    let amount = parseInt(match[1]?.replace(/,/g, "") || "0");
    // Convert K notation to actual number
    if (match[0]?.toLowerCase().includes("k")) {
      amount *= 1000;
    }
    if (amount > 0) {
      amounts.push(amount);
    }
  }

  if (amounts.length === 0) {
    // No numeric salary found, check for vague promises
    if (/guaranteed|up to|potential|unlimited/i.test(salary)) {
      flags.push({
        type: "vague_salary",
        confidence: "medium",
        message: `Salary uses vague language ("guaranteed", "up to", "potential"). Legitimate jobs specify clear ranges.`,
      });
    }
    return flags;
  }

  // Get minimum salary (first number in range or single number)
  const minSalary = Math.min(...amounts);
  const maxSalary = Math.max(...amounts);

  // Check if entry-level with unrealistic salary
  const isEntryLevel =
    /entry|junior|intern|associate|assistant|internship/i.test(jobTitle);

  if (isEntryLevel && minSalary > 150000) {
    flags.push({
      type: "unrealistic_salary",
      confidence: "high",
      message: `Salary ($${minSalary.toLocaleString()}+) is unusually high for an entry-level position.`,
    });
  }

  // Check for unrealistic high salaries (>$200K) for most positions
  if (
    minSalary > 200000 &&
    !/senior|executive|director|vp|vice president|ceo|cto|chief/i.test(jobTitle)
  ) {
    flags.push({
      type: "unrealistic_salary",
      confidence: "medium",
      message: `Salary ($${minSalary.toLocaleString()}+) seems unusually high for this position level.`,
    });
  }

  // Check for vague promises in combination with numbers
  if (/guaranteed|up to|potential|unlimited/i.test(salary)) {
    flags.push({
      type: "vague_salary",
      confidence: "medium",
      message: `Salary uses vague language combined with numbers. Legitimate jobs specify clear ranges.`,
    });
  }

  // Check for suspicious patterns like "$10K/month" (often used in scams)
  if (/month|weekly|per week|per month/i.test(salary) && minSalary >= 5000) {
    const monthlyAmount = minSalary;
    const yearlyEstimate = monthlyAmount * 12;
    if (yearlyEstimate > 200000 && isEntryLevel) {
      flags.push({
        type: "suspicious_salary_format",
        confidence: "medium",
        message: `Monthly salary format with high amount ($${monthlyAmount.toLocaleString()}/month ≈ $${yearlyEstimate.toLocaleString()}/year) is often used in scams.`,
      });
    }
  }

  return flags;
}
