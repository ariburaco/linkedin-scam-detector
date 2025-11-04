# LinkedIn Scam Detector - MVP Product Requirements Document

## One-Line Pitch

A Chrome extension that protects job seekers from LinkedIn scams by instantly analyzing job postings and flagging suspicious patterns using AI detection.

---

## Executive Summary

LinkedIn job scams cost victims **$501 million in 2024**, with a **300% increase in reports since 2020**. Despite LinkedIn detecting 86M fake profiles in H1 2024, scams continue to proliferate, with **60% of job listings showing fake characteristics**. The average victim loses **$2,000** and experiences significant emotional trauma.

**Market Gap**: No dominant competitor exists. The only direct competitor ("LinkedIn Scam Detector" extension) is an early-stage product with minimal traction.

**Our Solution**: A privacy-first Chrome extension that provides instant, AI-powered scam detection directly on LinkedIn job pages, protecting users before they engage with fraudulent opportunities.

---

## Problem Statement

**Job seekers on LinkedIn cannot reliably distinguish legitimate job postings from sophisticated scams.**

### Specific Pain Points:

1. **Too Good to Be True Offers**: Salaries 2-3x market rate with no interview process
2. **Emotional Manipulation**: Scammers build hope over weeks before requesting money
3. **Sophisticated Deception**: Fake recruiters use real company names, professional emails, and official-looking documents
4. **Financial Requests**: Training fees, background checks, equipment costs via untraceable methods
5. **Identity Theft Risk**: Requests for SSN, bank details, passport scans
6. **Platform Inaction**: Despite reports, scams persist for months

**Quote from Cybersecurity Professional:**
> "If somebody in cybersecurity is having this issue, I can only imagine what people who are not as clued in are dealing with."

---

## Target Users

### Primary Persona: Active Job Seeker

**Demographics:**
- Age: 22-35 years old
- Status: Recent graduate, career switcher, or remote work seeker
- LinkedIn usage: Daily, actively applying to 5-10 jobs per week
- Tech savvy: Comfortable installing Chrome extensions

**Current Pain Points:**
- Spends hours reviewing job postings, unsure which are legitimate
- Has encountered at least one suspicious posting in the past month
- Fears missing opportunities while also being cautious of scams
- No reliable way to verify job posting authenticity

**Success Criteria:**
- Can confidently apply to jobs without fear of scams
- Saves 2-3 hours per week previously spent researching companies
- Never falls victim to financial or identity theft scams

### Secondary Personas:

**Recent Graduate (High Risk)**
- Less experience identifying scams
- Desperate for first job opportunity
- More likely to ignore red flags

**Remote Work Seeker (High Target)**
- Often targeted by "work from home" scams
- Cryptocurrency and task-based scam exposure

**Career Switcher**
- Unfamiliar with new industry norms
- May not recognize unrealistic offers

---

## Core User Loop

**User visits LinkedIn job posting → Extension automatically scans content → Risk indicator appears inline → User clicks for detailed analysis → User makes informed decision**

### Step-by-Step Flow:

1. User browses LinkedIn job search results or opens a job posting
2. Extension content script activates automatically
3. **Visual indicator** (badge) appears on job card: 🟢 Safe / 🟡 Caution / 🔴 Danger
4. User clicks badge to see **detailed risk report**
5. Report shows:
   - Overall risk score (0-100)
   - Specific red flags detected
   - AI reasoning
   - "Report issue with this scan" button (feedback for validation)
6. User decides whether to apply or avoid

---

## MVP Feature Set

### Feature 1: Instant Scam Detection Badge

**What it does:**
- Injects visual risk indicator on every LinkedIn job posting
- Three-tier system: Safe (green), Caution (yellow), Danger (red)
- Appears immediately when job page loads

**Acceptance Criteria:**
- Badge visible within 500ms of page load
- Badge positioned consistently across all job posting layouts
- Badge style matches LinkedIn's design language (non-intrusive)
- Clicking badge opens detailed report

**Technical Implementation:**
- Content script monitors DOM for job posting elements
- Extracts job description, company name, salary, requirements
- Runs local rules engine for instant evaluation
- Displays badge with appropriate color/icon

---

### Feature 2: AI-Powered Risk Analysis

**What it does:**
- Sends job posting content to Gemini 2.0 Flash (via Vercel AI SDK) for deep analysis
- Returns structured risk assessment with reasoning
- Identifies specific red flags and patterns

**Acceptance Criteria:**
- Analysis completes within 2 seconds
- Provides 3-5 specific red flags (if detected)
- Explains WHY each flag is concerning
- Confidence score for each flag (Low/Medium/High)

**Red Flags Detected:**

**Financial Red Flags:**
- Requests for upfront payment (training, background check, equipment)
- Unusual payment methods mentioned (Zelle, gift cards, cryptocurrency)
- Commission-only roles disguised as salaried positions
- "Investment opportunities" or "start your own business" language

**Communication Red Flags:**
- Personal email domains (Gmail, Yahoo) instead of corporate
- Requests to communicate via WhatsApp/Telegram
- Immediate job offers without interview
- Urgency language ("respond within 24 hours or lose opportunity")

**Compensation Red Flags:**
- Salary 2x+ above market average for role/experience
- Vague job description with unrealistic pay
- "Earn $5,000/week working from home"

**Company Red Flags:**
- Company name doesn't match email domain
- Recently created LinkedIn company page (<3 months old)
- Few employees or connections listed
- Generic job descriptions copied across multiple "companies"

**Technical Implementation:**
- Extract job posting text (title, description, requirements, salary)
- Send to Gemini 2.0 Flash via Vercel AI SDK with specialized prompt
- Use structured output mode for consistent JSON response (risk_score, flags[], reasoning)
- Cache results to avoid re-analyzing same posting

---

### Feature 3: Local Rules Engine (Instant Detection)

**What it does:**
- Runs client-side analysis before LLM call
- Detects obvious red flags instantly (no API latency)
- Powers the immediate badge display

**Rules Implemented:**

1. **Email Domain Check**
   - Extract email addresses from job description
   - Flag if @gmail, @yahoo, @outlook (personal domains)
   - Safe if matches company domain or known recruiting domains

2. **Keyword Pattern Matching**
   - High-risk keywords: "wire transfer," "cryptocurrency," "training fee," "background check fee," "starter kit"
   - Urgency keywords: "immediate start," "apply within 24 hours," "limited spots"
   - MLM keywords: "unlimited earning potential," "be your own boss," "recruit others"

3. **Salary Analysis**
   - Extract salary range if present
   - Flag if minimum salary >$150K for entry-level positions
   - Flag vague promises like "$10K/month guaranteed"

4. **Grammar Quality Score**
   - Count spelling errors
   - Detect excessive capitalization or exclamation marks
   - Flag if professional threshold not met

**Acceptance Criteria:**
- Executes in <100ms
- No API calls required
- Catches 60%+ of obvious scams instantly
- Falls back to LLM for ambiguous cases

**Technical Implementation:**
- Pure JavaScript rules engine
- Regex patterns for keyword detection
- LanguageTool.js for basic grammar checking
- Results cached in extension storage

---

### Feature 4: Detailed Risk Report

**What it does:**
- Expandable panel showing full analysis
- User-friendly explanations of each red flag
- Educational content about why flags matter

**Report Structure:**

```
🔴 High Risk Detected (Score: 87/100)

⚠️ Red Flags:
1. Personal Email Domain (High Confidence)
   - Contact email uses @gmail.com instead of company domain
   - Legitimate recruiters use corporate emails

2. Upfront Payment Request (High Confidence)
   - Job description mentions "training materials fee"
   - Real employers never charge employees for training

3. Unrealistic Salary (Medium Confidence)
   - Offers $8,000/month for entry-level remote position
   - Market rate for this role: $3,000-$4,500/month

4. Urgency Language (Medium Confidence)
   - "Apply within 48 hours" creates false time pressure
   - Legitimate hiring processes don't rush candidates

💡 Recommendation:
Do NOT apply. Multiple high-confidence scam indicators detected.
Report this posting to LinkedIn directly.

[Report Issue with Scan] [Close]
```

**Acceptance Criteria:**
- Report opens in modal or side panel
- Each red flag has icon, title, confidence level, and explanation
- Clear recommendation at bottom (Apply / Proceed with Caution / Do NOT Apply)
- Accessible via keyboard navigation
- Mobile-responsive if viewing LinkedIn on mobile browser

---

### Feature 5: Feedback Collection (Validation for Phase 2)

**What it does:**
- Simple feedback button to validate demand for community features
- Collects user feedback on scan accuracy
- Helps identify false positives and improve detection

**User Flow:**
1. User clicks "Report Issue with this Scan" button in risk report
2. Simple modal appears: "Help us improve"
   - [ ] False positive (this job is legitimate)
   - [ ] False negative (this job is suspicious but marked safe)
   - [ ] Other issue: [text field]
3. User submits feedback anonymously
4. Data used to validate demand for full community reporting in Phase 2

**Acceptance Criteria:**
- Feedback submission takes <5 seconds
- No user identifiers stored
- Only job URL hash and feedback type stored
- Simple UI, non-intrusive

**Technical Implementation:**
- Backend API endpoint: `POST /api/feedback`
- Store: `job_url_hash`, `feedback_type`, `timestamp`
- NO community warnings in Phase 1 (validate demand first)

---

## Explicitly NOT Building in MVP

**These features are out of scope for the initial 3-week build:**

❌ **User Accounts / Authentication**
- No login required for MVP
- All features work anonymously
- Extension settings stored locally

❌ **Detailed Analytics Dashboard**
- No graphs of scam trends over time
- No personal history of scanned jobs
- Focus on immediate detection only

❌ **Company Verification Database**
- No cross-referencing with business registries
- No domain ownership verification
- Too complex for MVP, defer to Phase 2

❌ **Community Reporting System**
- Full community scam reporting deferred to Phase 2
- Must validate demand via feedback collection first

❌ **Profile Analysis**
- No analysis of recruiter LinkedIn profiles
- No network connection verification
- Scope limited to job postings only

❌ **Browser Extension for Firefox/Safari**
- Chrome extension only for MVP
- Other browsers in Phase 3 if validated

❌ **Mobile App**
- Extension works on desktop Chrome only
- Mobile users must use desktop browser

❌ **Advanced ML Model Training**
- MVP uses LLM API, not custom trained model
- Local model training deferred to Phase 2

❌ **Internationalization**
- English language only for MVP
- Additional languages considered in Phase 3 based on user demand

---

## Success Metrics

### Primary Metric: **User Adoption**

**Target:** 1,000 active users within 30 days of launch

**Measurement:**
- Active user = scanned at least 1 job posting in past 7 days
- Track via extension telemetry (privacy-respecting)
- Anonymous UUID per installation

---

### Secondary Metrics:

**Engagement:**
- **Scans per user per week:** Target 5+ (indicates active job searching)
- **Report click-through rate:** Target 30% (users viewing detailed analysis)
- **Feedback submissions:** Target 50+ in first month (validates Phase 2 demand)

**Detection Effectiveness:**
- **Red flags detected:** Track distribution (how many high/medium/low risk)
- **False positive rate:** Target <10% (users can mark "False positive")
- **Feedback engagement:** % of users who provide feedback on scans

**Conversion (for monetization):**
- **Free tier usage:** Track how many users hit 10 scans/day limit
- **Upgrade interest:** "Upgrade to Pro" button clicks
- **Email signups:** For launch announcements (optional feature)

---

### How We Measure Success After 30 Days:

✅ **Success = 1,000+ active users + 30%+ report CTR + <10% false positives**

📊 **Learning = Distribution of scam types detected (informs Phase 2 priorities)**

❌ **Failure = <200 active users OR >30% false positive rate**
- If this happens: User interviews to understand why (bad UX? Not valuable? Technical issues?)

---

## Technical Architecture (High-Level)

### Chrome Extension (Plasmo Framework)

**Why Plasmo:**
- Already used in existing monorepo (`apps/chrome-extension`)
- Built-in HMR and TypeScript support
- Simplified content script injection
- React component support for UI

**Components:**

1. **Content Script** (`src/contents/linkedin-scanner.tsx`)
   - Injects into `linkedin.com/jobs/*`
   - Monitors DOM for job posting elements
   - Displays badge and report UI

2. **Background Service Worker** (`src/background/messages/scan-job.ts`)
   - Handles API calls to Gemini via Vercel AI SDK
   - Manages local rules engine
   - Stores scan cache and feedback data

3. **Popup** (`src/popup.tsx`)
   - Extension icon click shows summary stats
   - Quick settings: toggle auto-scan, adjust sensitivity
   - Link to options page

4. **Options Page** (`src/options/index.tsx`)
   - Privacy settings
   - Usage statistics
   - About / Help / Report Bug

### Backend API (tRPC in Existing Monorepo)

**Location:** `packages/api/src/routers/scam-detector.ts`

**Endpoints:**

```typescript
export const scamDetectorRouter = router({
  // Scan a job posting
  scanJob: publicProcedure
    .input(z.object({
      jobText: z.string(),
      jobUrl: z.string(),
      companyName: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Call Gemini 2.0 Flash via Vercel AI SDK
      // Run local rules
      // Return risk analysis
    }),

  // Submit feedback
  submitFeedback: publicProcedure
    .input(z.object({
      jobUrlHash: z.string(),
      feedbackType: z.enum(['false_positive', 'false_negative', 'other']),
      details: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Store feedback in database
      // Rate limiting check
    }),
});
```

### Database Schema (Prisma)

**Location:** `packages/db/prisma/schema/scam-detector.prisma`

```prisma
model Feedback {
  id           String   @id @default(cuid())
  jobUrlHash   String   @db.VarChar(64)
  feedbackType String   @db.VarChar(50)
  details      String?  @db.Text
  submittedAt  DateTime @default(now())

  @@index([jobUrlHash])
  @@index([feedbackType])
}

model ScanCache {
  id          String   @id @default(cuid())
  jobUrlHash  String   @unique @db.VarChar(64)
  riskScore   Int
  flags       Json
  scannedAt   DateTime @default(now())
  expiresAt   DateTime

  @@index([jobUrlHash, expiresAt])
}
```

### External Services

**Gemini 2.0 Flash (via Vercel AI SDK)**
- Model: `gemini-2.0-flash-exp` (fastest, most cost-effective)
- Vercel AI SDK provides unified interface and streaming support
- Structured output mode for consistent JSON responses
- Rate limiting: Managed by Vercel AI SDK
- Cost: ~$0.0001 per job scan (30x cheaper than alternatives)

**Storage:**
- Chrome Extension Storage API (local settings)
- PostgreSQL via Prisma (feedback, scan cache)
- No user data stored (privacy-first)

---

## User Experience Flow

### First-Time User

1. **Install Extension:**
   - User finds extension on Chrome Web Store
   - Clicks "Add to Chrome"
   - Permission prompt: "Read and change data on linkedin.com"
   - User clicks "Add Extension"

2. **Onboarding (Optional Modal):**
   - "Welcome! LinkedIn Scam Detector is now protecting you."
   - "Here's how it works: [3-step visual]"
   - "Your privacy matters: We never store your LinkedIn activity"
   - [Skip] [Get Started]

3. **First Scan:**
   - User visits LinkedIn job search
   - Badge automatically appears on first job posting
   - Tooltip: "Click to see why this job is safe/risky"
   - User clicks → sees detailed report
   - "👍 Helpful" / "👎 False Positive" feedback buttons

### Returning User (Core Loop)

1. User visits `linkedin.com/jobs/search`
2. Extension scans visible job cards in viewport (lazy loading)
3. Badges appear on each job card within 1 second
4. User sees at a glance: 5 safe, 2 caution, 1 danger
5. User clicks danger badge → detailed report opens
6. User reads flags, decides not to apply
7. User clicks "Report Scam" to help community
8. Extension shows confirmation: "Thanks for reporting! You're helping protect 1,000+ other job seekers."

### Power User (Encountering Limit on Free Tier)

1. User scans 11th job in a day
2. Modal appears: "You've reached your daily limit (10 scans)"
3. Options:
   - "Upgrade to Pro - Unlimited scans ($7.99/mo)" [Primary button]
   - "Wait until tomorrow" [Secondary button]
4. User clicks Upgrade → redirects to payment page
5. After payment, extension unlocks Pro features immediately

---

## Privacy & Security

### Data We Collect (Minimal)

**Anonymous Usage Telemetry:**
- Number of scans performed
- Risk score distribution
- Feature usage (clicks on reports, submissions)
- Extension version
- NO user identifiers, NO LinkedIn data, NO browsing history

**Community Reports:**
- Job URL hash (SHA-256, irreversible)
- Report type (category only)
- Timestamp
- NO reporter identity, NO IP addresses

### Data We NEVER Collect

❌ LinkedIn user ID or profile data
❌ Job applications submitted
❌ Messages or communications
❌ Search queries or browsing patterns
❌ Personal information from job seekers

### Security Measures

- All API calls over HTTPS
- Job content sent to Gemini API is ephemeral (not stored by Google per API terms)
- Extension settings stored locally only
- No third-party analytics (Google Analytics, etc.)
- Open-source codebase (transparency)

### GDPR Compliance

- Privacy Policy clearly explains all data collection
- User consent obtained on first run
- Right to delete: Contact form to request data deletion
- Data portability: Users can export their settings
- EU users identified and given explicit consent option

---

## 2-Week Build Timeline (Ruthlessly Scoped)

### Week 1: Core Detection + UI

**Days 1-2: Project Setup**
- Set up Plasmo extension in monorepo
- Create tRPC router for scam detection
- Design Prisma schema (ScanCache, Feedback tables only)
- Set up Vercel AI SDK with Gemini 2.0 Flash

**Days 3-5: Hybrid Detection System**
- Implement local rules engine (email, keywords, salary patterns)
- Build Gemini API integration with structured output
- Create badge injection system on LinkedIn job postings
- Test hybrid flow: local → badge → Gemini → update

**Day 6-7: Risk Report UI**
- Design and build badge component (green/yellow/red)
- Build detailed risk report modal
- Implement feedback button
- Test on live LinkedIn pages

---

### Week 2: Polish + Launch

**Days 8-10: Testing & Refinement**
- Test on 50+ real LinkedIn job postings
- Tune prompts for better accuracy
- Fix false positives
- Implement caching layer
- Optimize performance (lazy loading, debouncing)

**Days 11-12: Extension Features**
- Build extension popup (basic stats)
- Create simple options page (privacy settings, about)
- Add first-time onboarding tooltip
- Implement error handling and fallback logic

**Days 13-14: Launch Preparation**
- Chrome Web Store listing (screenshots, description, privacy policy)
- Test on Windows, Mac, Linux
- Beta test with 5-10 users
- Submit to Chrome Web Store
- Prepare Product Hunt launch materials

---

## Launch Checklist

### Pre-Launch (Day 14)

- [ ] Extension tested on 50+ LinkedIn job postings
- [ ] False positive rate <10% (tested with known legitimate jobs)
- [ ] True positive rate >80% (tested with known scams from online reports)
- [ ] API costs calculated (budget: $5-10 for first 1000 users with Gemini)
- [ ] Privacy Policy published
- [ ] Chrome Web Store listing approved
- [ ] Social media assets created (screenshots, demo video)

### Launch Day

- [ ] Submit to Product Hunt
- [ ] Post on Reddit (r/jobs, r/recruitinghell, r/cscareerquestions)
- [ ] Share on LinkedIn (ironic but effective)
- [ ] Post on relevant job search forums
- [ ] Email 10 beta testers for testimonials
- [ ] Monitor error logs and user feedback

### Week 1 Post-Launch

- [ ] Respond to all Chrome Web Store reviews
- [ ] Fix critical bugs within 24 hours
- [ ] Publish update if needed
- [ ] Track metrics: installations, active users, scans performed
- [ ] Collect user feedback (in-app feedback form)

---

## Definition of Done

**The MVP is ready to launch when:**

✅ A user can install the extension and see badges on LinkedIn job postings within 2 seconds
✅ Clicking a badge shows a detailed risk report with 3+ specific red flags (if applicable)
✅ The hybrid detection system (local rules + Gemini) works seamlessly
✅ Users can submit feedback on scan accuracy
✅ Privacy Policy is published and compliant with Chrome Web Store requirements
✅ False positive rate is <10% based on 50-job test set
✅ Extension works on Chrome 120+ (latest stable)
✅ Chrome Web Store listing is approved and live

---

## Open Questions & Decisions Needed

### Before Development Starts:

1. **Gemini API Budget:** ~$0.0001/scan (Estimated $5-10 for first 100K scans)
   - **Decision:** Gemini 2.0 Flash is 30x cheaper than alternatives - cost not a concern for MVP

2. **Freemium Launch:** Launch with paywall from day 1, or free for first month?
   - **Decision:** Free for first 30 days to build user base, then introduce 10 scans/day limit

3. **Chrome Web Store Category:** List under "Productivity" or "Developer Tools"?
   - **Decision:** Productivity > Tools (aligns with job search workflow)

4. **Beta Testing:** Recruit beta testers from Reddit or LinkedIn?
   - **Decision:** Both - post on r/jobs and LinkedIn with "help us test" angle

5. **Open Source:** Launch as open-source from day 1 for transparency?
   - **Decision:** Yes - builds trust, aligns with privacy-first messaging

---

## Appendix: Key Assumptions

1. **LinkedIn won't immediately ban the extension** (read-only, no automation)
2. **Users are willing to install a Chrome extension** for job search safety
3. **Gemini 2.0 Flash is reliable and fast enough** (<2 second response time)
4. **Job seekers will trust AI analysis** over manual verification
5. **Feedback collection will validate demand** for community features in Phase 2
6. **$7.99/month is acceptable pricing** for security product
7. **Chrome Web Store approval takes <7 days** (factor into timeline)

---

## Version History

- **v1.0** (2025-01-04): Initial PRD for MVP
- **v1.1** (2025-01-04): Revised to use Vercel AI SDK + Gemini 2.0 Flash, removed Ekşi Sözlük integration, simplified to 2-week timeline, community reporting moved to Phase 2 validation
- **v1.2** (TBD): Updated after user feedback from beta testing
- **v2.0** (TBD): Phase 2 features based on validated user demand

---

**Document Owner:** Ali Burak Özden
**Last Updated:** 2025-01-04
**Status:** Draft - Ready for Technical Review
