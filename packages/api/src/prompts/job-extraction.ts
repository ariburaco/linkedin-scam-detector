/**
 * Build prompt for extracting structured job data from job description
 */
export function buildJobExtractionPrompt(context: {
  jobText: string;
  jobTitle?: string;
  companyName?: string;
}): string {
  const { jobText, jobTitle, companyName } = context;

  return `You are an expert job data extraction specialist. Extract structured information from the following LinkedIn job posting.

${jobTitle ? `Job Title: ${jobTitle}` : ""}
${companyName ? `Company: ${companyName}` : ""}

Job Description:
${jobText}

Please extract the following information:

1. **Requirements**: List all requirements mentioned (skills, experience levels, education, certifications, languages, etc.)
   - For each requirement, indicate if it's required or preferred
   - Include the level/amount if specified (e.g., "3+ years", "Expert level")

2. **Responsibilities**: List all job responsibilities and duties mentioned
   - Extract as concise bullet points

3. **Benefits**: List all benefits, perks, and compensation details mentioned
   - Include health insurance, retirement plans, PTO, remote work options, bonuses, etc.

4. **Qualifications**: List all qualifications needed (education, certifications, licenses, etc.)
   - Mark each as required or preferred

5. **Skills**: Extract all technical and soft skills mentioned
   - Categorize skills as: technical, soft, language, tool, framework, or other
   - Mark if skills are required or preferred
   - Include experience level if mentioned

6. **Salary Information**: Extract structured salary data
   - If salary range is mentioned, extract min and max amounts
   - Extract currency (USD, EUR, GBP, etc.)
   - Extract period (hourly, monthly, yearly)
   - If no salary info, leave null

7. **Experience Level**: Determine the required experience level
   - Options: entry, mid, senior, executive
   - Base on years of experience mentioned or job title level

8. **Education Level**: Extract the minimum education requirement
   - Options: high-school, associate, bachelor, master, phd, none
   - If not specified, infer from requirements if possible

9. **Work Type**: Determine if the job is remote, hybrid, or on-site
   - Look for mentions of "remote", "work from home", "hybrid", "on-site", "office-based"

10. **Work Schedule**: Extract the work schedule type
    - Options: full-time, part-time, contract, temporary, internship

11. **Agency Detection**: Determine if this job posting is from a recruitment agency or staffing firm
    - Set to true if the posting indicates it's from a recruitment agency, staffing firm, or third-party recruiter
    - Look for indicators such as:
      - "on behalf of" (e.g., "We are hiring on behalf of...")
      - "recruiting for" (e.g., "We are recruiting for our client...")
      - "hiring on behalf of"
      - "our client" (when referring to the actual employer)
      - "representing" (e.g., "We are representing a leading company...")
      - Mentions of recruitment agencies, staffing firms, or third-party recruiters
      - Language suggesting the poster is not the direct employer
    - Set to false if the posting is clearly from the company directly
    - Leave undefined if it's unclear or cannot be determined

12. **Urgency Score (0-100)**: Calculate urgency based on hiring timeline and deadlines
    - **90-100**: Explicit deadline within 24-48 hours, "hiring immediately", "urgent", "start ASAP"
    - **70-89**: Deadline within 1 week, "limited positions", "act fast", "apply soon"
    - **50-69**: Active recruiting, standard timeline mentioned, "hiring now"
    - **30-49**: "Until filled", no specific timeline, ongoing recruitment
    - **0-29**: Older postings, no urgency indicators, passive recruitment
    - Consider posting age, explicit deadlines, urgency language, and position availability

13. **Quality Score (0-10)**: Assess job posting quality and completeness
    - **9-10**: Complete information (salary, requirements, benefits, company details), professional writing, detailed descriptions
    - **7-8**: Most information present, good writing quality, clear structure
    - **5-6**: Some information missing, acceptable quality, basic details provided
    - **3-4**: Vague descriptions, missing key details (salary, requirements unclear), poor structure
    - **0-2**: Poor quality, minimal information, unprofessional writing, very vague
    - Consider: information completeness, writing quality, transparency, detail level

14. **Competitiveness Score (0-10)**: Estimate competition level for this position
    - **8-10**: Senior/executive level, rare skill combinations, "rockstar/ninja" language, highly specialized requirements
    - **5-7**: Mid-level position, moderate skill requirements, some specialization needed
    - **2-4**: Entry-level, common skills, standard requirements, high-volume hiring
    - **0-1**: Very basic requirements, minimal qualifications, mass hiring
    - Consider: years of experience required, skill rarity, seniority level, hiring language

15. **Scam Indicators**: Extract any red flags that might indicate a scam (complements existing scam detection)
    - Return as an array of indicator strings if detected, empty array if none
    - Examples: "payment_request", "mlm_language", "vague_description", "guaranteed_income", "poor_grammar", "fake_urgency", "personal_email", "cryptocurrency_mention", "upfront_fee", "unrealistic_salary"
    - Only include clear indicators, not ambiguous cases

16. **Start Date**: Extract job start date if mentioned
    - Look for phrases like: "Start immediately", "Start date: Jan 15, 2024", "Starting in March", "Available to start on..."
    - Return as ISO 8601 date string (YYYY-MM-DD format) if a specific date is mentioned
    - Return null if not mentioned or unclear

17. **Application Deadline**: Extract application deadline if mentioned
    - Look for phrases like: "Apply by Dec 31", "Deadline: Jan 15, 2024", "Applications close on...", "Must apply before..."
    - Return as ISO 8601 date string (YYYY-MM-DD format) if a specific date is mentioned
    - Return null if not mentioned or unclear

Be thorough and extract all available information. If information is not available, leave the field null or empty array.
Focus on extracting concrete, structured data that would be useful for job search filters and matching algorithms.
`;
}
