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

Be thorough and extract all available information. If information is not available, leave the field null or empty array.
Focus on extracting concrete, structured data that would be useful for job search filters and matching algorithms.
`;
}
