# Privacy Policy for LinkedIn Scam Detector

**Last Updated:** November 2024

## Introduction

LinkedIn Scam Detector ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and protect your information when you use our Chrome extension.

## Data Collection and Usage

### What We Collect

1. **Job Posting Data (Temporary)**
   - When you browse LinkedIn job postings, our extension extracts the following information from the page:
     - Job title
     - Company name
     - Job description text
     - Job posting URL
     - Salary information (if available)
   - **This data is only processed locally in your browser and is never stored on our servers.**

2. **Hashed Job URLs (Anonymous)**
   - When you submit feedback about a scan result, we hash the job URL using SHA-256 to create an anonymous identifier
   - **We never store the original job URL or any personally identifiable information**
   - This hash is used solely to aggregate feedback about specific job postings

3. **Feedback Data (Anonymous)**
   - If you choose to report an issue with a scan, we collect:
     - The hashed job URL (SHA-256)
     - Feedback type (false positive, false negative, or other)
     - Optional details you provide
     - Timestamp of submission
   - **This data is completely anonymous and cannot be linked to you or your LinkedIn account**

4. **Local Storage (Your Device Only)**
   - Scan statistics (jobs scanned today, threats detected)
   - Extension settings (auto-scan enabled, notification preferences)
   - **All data is stored locally on your device using Chrome's storage API**
   - **We do not have access to this data**

### What We Do NOT Collect

- ❌ Your LinkedIn account information or credentials
- ❌ Your browsing history outside of LinkedIn job pages
- ❌ Personal information (name, email, phone number, etc.)
- ❌ Location data
- ❌ Device identifiers
- ❌ Any data that could identify you personally

## How We Use Your Data

### Job Analysis

- Job posting text is sent to Google's Gemini AI service for analysis
- **Google's API terms state that data sent to Gemini is ephemeral and not stored by Google**
- Analysis results are cached locally on your device for 24 hours to improve performance
- We never store job descriptions on our servers

### Feedback Collection

- Anonymous feedback helps us improve our scam detection algorithms
- Feedback is aggregated and analyzed to identify patterns and improve accuracy
- No personal information is associated with feedback submissions

### Local Statistics

- Statistics displayed in the extension popup (jobs scanned, threats blocked) are calculated and stored locally on your device
- These statistics reset daily and are never transmitted to our servers

## Data Storage and Security

### Local Storage

- All extension settings and statistics are stored locally using Chrome's Storage API
- Data is stored on your device only and never synced to our servers
- You can clear this data at any time by uninstalling the extension or clearing Chrome's extension storage

### Server Storage

- We only store anonymous feedback data (hashed URLs, feedback type, optional details, timestamps)
- This data is stored in a secure PostgreSQL database
- Data is encrypted in transit using HTTPS/TLS
- We use industry-standard security practices to protect stored data

### Data Retention

- **Scan Cache:** 24-hour TTL - automatically deleted after 24 hours
- **Feedback Data:** Retained indefinitely for analysis purposes (all data is anonymous)
- **Local Statistics:** Reset daily automatically

## Third-Party Services

### Google Gemini AI

- We use Google's Gemini 2.0 Flash API for AI-powered job analysis
- Job descriptions are sent to Google's servers for analysis
- According to Google's API terms, data sent to Gemini is ephemeral and not stored
- Google may process this data according to their Privacy Policy: https://policies.google.com/privacy

### Backend Infrastructure

- Our backend API is hosted on secure cloud infrastructure
- We use standard security practices including HTTPS encryption
- Database access is restricted and monitored

## Your Rights and Choices

### Control Your Data

- **Disable Scanning:** You can disable automatic scanning in the extension's options page
- **Clear Local Data:** Uninstall the extension to remove all locally stored data
- **No Account Required:** The extension works completely anonymously - no account or login required

### Access and Deletion

- Since we don't collect personally identifiable information, there's no account data to access or delete
- Feedback submissions are anonymous and cannot be linked to individual users
- If you have concerns about your data, please contact us at the email address below

## Children's Privacy

Our extension is not intended for users under the age of 13. We do not knowingly collect any information from children under 13.

## Changes to This Privacy Policy

We may update this Privacy Policy from time to time. We will notify users of any material changes by:
- Updating the "Last Updated" date at the top of this policy
- Posting a notice in the extension (for significant changes)

## Contact Us

If you have questions or concerns about this Privacy Policy or our data practices, please contact us at:

**Email:** [Your Contact Email]

**GitHub Issues:** https://github.com/[your-username]/linkedin-scam-detector/issues

## Compliance

This extension complies with:
- Chrome Web Store Developer Program Policies
- General Data Protection Regulation (GDPR) principles
- California Consumer Privacy Act (CCPA) requirements

---

**Note:** This extension is designed with privacy as a core principle. We believe that scam detection should not require compromising your privacy. All processing happens locally when possible, and when server-side processing is needed (for AI analysis), we ensure no personal data is stored or transmitted.

