/**
 * Prompt templates for scam detection analysis
 */

export interface PromptContext {
  jobText: string;
  jobTitle?: string;
  companyName?: string;
}

/**
 * Build the main prompt for Gemini analysis
 */
export function buildScamDetectionPrompt(context: PromptContext): string {
  const { jobText, jobTitle, companyName } = context;

  return `You are an expert job scam detection specialist with deep knowledge of LinkedIn job scams, recruitment fraud, and phishing tactics. Your task is to analyze the provided LinkedIn job posting and identify potential scam indicators.

**Job Information:**
${jobTitle ? `Title: ${jobTitle}` : "Title: Not specified"}
${companyName ? `Company: ${companyName}` : "Company: Not specified"}

**Job Description:**
${jobText}

**Analysis Guidelines:**

Analyze this job posting for the following red flags:

1. **Financial Red Flags:**
   - Requests for upfront payment (training fees, background check fees, equipment purchases)
   - Unusual payment methods mentioned (Zelle, gift cards, cryptocurrency, Western Union, MoneyGram)
   - Commission-only roles disguised as salaried positions
   - "Investment opportunities" or "start your own business" language

2. **Communication Red Flags:**
   - Personal email domains instead of corporate (@gmail.com, @yahoo.com, @outlook.com)
   - Requests to communicate via WhatsApp, Telegram, or other messaging apps
   - Immediate job offers without any interview process
   - Urgency language ("apply within 24 hours", "limited spots", "must act now")

3. **Compensation Red Flags:**
   - Salary 2x+ above market average for the role/experience level
   - Vague job description with unrealistic pay promises
   - Promises like "Earn $5,000/week working from home"
   - Entry-level positions offering $150K+ salaries

4. **Company Red Flags:**
   - Company name doesn't match email domain
   - Generic job descriptions that could apply to any company
   - Lack of specific company information or details

5. **Information Request Red Flags:**
   - Requests for sensitive information upfront (SSN, bank details, passport scans)
   - Asking for credit card information
   - Requesting personal documents before any interview

6. **Language & Grammar Red Flags:**
   - Poor grammar, excessive capitalization, or unprofessional language
   - Multiple spelling errors
   - Overly casual or inappropriate tone

7. **MLM/Pyramid Scheme Indicators:**
   - Multi-level marketing (MLM) language
   - "Recruit others" or "build your team" messaging
   - "Unlimited earning potential" with vague details

8. **Cryptocurrency/Investment Scams:**
   - Cryptocurrency investment mentions
   - "Work from home" with cryptocurrency tasks
   - Investment opportunity disguised as a job

**Output Requirements:**

For each red flag detected:
- **type**: A clear, descriptive category name (e.g., "personal_email", "upfront_payment", "unrealistic_salary")
- **confidence**: "high" (very likely a scam), "medium" (suspicious but not definitive), or "low" (minor concern)
- **message**: A user-friendly, clear explanation (1-2 sentences) that a job seeker can understand
- **reasoning**: Detailed explanation of WHY this is concerning, with context for job seekers

**Risk Score Calculation (0-100):**
- **0-40 (Safe)**: Normal job posting with no significant red flags
- **41-69 (Caution)**: Some concerns detected, proceed with caution and verify details
- **70-100 (Danger)**: Multiple high-confidence scam indicators, likely a scam - do NOT apply

**Summary:**
Provide a one-sentence summary that helps job seekers make an informed decision.

Respond with structured JSON matching the schema.`;
}

/**
 * Build a fallback prompt (simpler version for retries)
 */
export function buildFallbackPrompt(context: PromptContext): string {
  const { jobText, jobTitle, companyName } = context;

  return `Analyze this LinkedIn job posting for scam indicators:

Job: ${jobTitle || "Not specified"}
Company: ${companyName || "Not specified"}

Description:
${jobText}

Identify red flags related to:
- Financial requests (training fees, upfront payments)
- Personal email domains (gmail, yahoo)
- Unrealistic salaries
- Urgency language
- Poor grammar/unprofessional language
- MLM language
- Requests for sensitive information

Provide a risk score (0-100), risk level (safe/caution/danger), list of flags with confidence levels, and a summary.`;
}
