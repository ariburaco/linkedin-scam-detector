# LinkedIn Scam Detector - Technical Specification

## Document Overview

**Version:** 1.0
**Last Updated:** 2025-01-04
**Status:** Draft

This document provides the technical architecture and implementation details for the LinkedIn Scam Detector MVP. It covers the Chrome extension structure, hybrid detection system, API integration, and database design.

---

## Technology Stack

### Frontend (Chrome Extension)

- **Framework:** Plasmo (v0.88+)
- **Language:** TypeScript 5.3+
- **UI Library:** React 19
- **Styling:** Tailwind CSS
- **Build Tool:** Plasmo CLI (built on Parcel)

### Backend (API)

- **Framework:** Next.js 16 (App Router)
- **API Layer:** tRPC v11
- **Authentication:** Better-Auth
- **Database ORM:** Prisma 6.1
- **Database:** PostgreSQL 16
- **Hosting:** Vercel

### AI Integration

- **SDK:** Vercel AI SDK v4.1+
- **Model:** Gemini 2.0 Flash (`gemini-2.0-flash-exp`)
- **Provider:** Google AI (via Vercel AI SDK)
- **Features:** Structured output, streaming support, error handling

### Development Tools

- **Package Manager:** Bun 1.2.23
- **Monorepo:** Turborepo
- **Linting:** ESLint + Prettier
- **Version Control:** Git

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       LinkedIn Job Page                          │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Content Script (linkedin-scanner.tsx)                     │ │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │ │
│  │  │ DOM Monitor │→│ Local Rules   │→│ Badge Display  │  │ │
│  │  │             │  │ Engine        │  │ (🟢🟡🔴)       │  │ │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │ │
│  │         ↓                                     ↑            │ │
│  │  ┌──────────────────────────────────────────┐│            │ │
│  │  │ Extract Job Data                          ││            │ │
│  │  └──────────────────────────────────────────┘│            │ │
│  │         ↓                                     │            │ │
│  │  ┌──────────────────────────────────────────┐│            │ │
│  │  │ Send to Background Worker                 ││            │ │
│  │  └──────────────────────────────────────────┘│            │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│               Background Service Worker                          │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Message Handler (scan-job.ts)                            │ │
│  │  ┌─────────────────┐     ┌─────────────────────────────┐ │ │
│  │  │ Check Cache     │────→│ tRPC Client                  │ │ │
│  │  │ (Local Storage) │     │ (Call Backend API)           │ │ │
│  │  └─────────────────┘     └─────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Backend API (Next.js + tRPC)                │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  scamDetectorRouter                                       │ │
│  │  ┌──────────────────────────────────────────────────────┐│ │
│  │  │  scanJob() mutation                                   ││ │
│  │  │  1. Check ScanCache (Prisma)                          ││ │
│  │  │  2. Call Gemini via Vercel AI SDK                     ││ │
│  │  │  3. Parse structured response                         ││ │
│  │  │  4. Cache result                                      ││ │
│  │  │  5. Return risk analysis                              ││ │
│  │  └──────────────────────────────────────────────────────┘│ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Gemini 2.0 Flash API                           │
│             (via Vercel AI SDK)                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Input: Job posting text + scam detection prompt         │ │
│  │  Output: Structured JSON (risk_score, flags[], reasoning)│ │
│  │  Cost: ~$0.0001 per scan                                  │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                            ↓
                      (Response flows back up)
```

---

## Chrome Extension Architecture

### Directory Structure

```
apps/chrome-extension/
├── src/
│   ├── contents/
│   │   └── linkedin-scanner.tsx         # Main content script
│   ├── background/
│   │   ├── index.ts                     # Service worker entry
│   │   └── messages/
│   │       ├── scan-job.ts              # Job scanning handler
│   │       └── submit-feedback.ts       # Feedback handler
│   ├── components/
│   │   ├── badge/
│   │   │   ├── ScamBadge.tsx            # Badge component
│   │   │   └── BadgeIcon.tsx            # Icon variants
│   │   ├── report/
│   │   │   ├── RiskReport.tsx           # Detailed report modal
│   │   │   ├── RedFlag.tsx              # Individual flag display
│   │   │   └── FeedbackButton.tsx       # Feedback submission
│   │   └── ui/
│   │       ├── Modal.tsx                # Reusable modal
│   │       └── Loading.tsx              # Loading states
│   ├── lib/
│   │   ├── local-rules/
│   │   │   ├── index.ts                 # Rules engine entry
│   │   │   ├── email-check.ts           # Email domain validation
│   │   │   ├── keyword-matcher.ts       # Keyword detection
│   │   │   ├── salary-analyzer.ts       # Salary analysis
│   │   │   └── types.ts                 # Rule types
│   │   ├── linkedin-dom/
│   │   │   ├── selectors.ts             # LinkedIn DOM selectors
│   │   │   ├── job-extractor.ts         # Extract job data
│   │   │   └── badge-injector.ts        # Inject badge into DOM
│   │   └── utils/
│   │       ├── hash.ts                  # URL hashing
│   │       └── cache.ts                 # Local cache management
│   ├── trpc/
│   │   ├── client.ts                    # tRPC client setup
│   │   └── react.tsx                    # React Query integration
│   ├── popup.tsx                        # Extension popup
│   ├── options/
│   │   └── index.tsx                    # Options page
│   └── assets/
│       ├── icon-*.png                   # Extension icons
│       └── fonts/                       # Custom fonts
├── package.json
└── plasmo.config.ts                     # Plasmo configuration
```

### Content Script (`linkedin-scanner.tsx`)

**Purpose:** Monitors LinkedIn job pages, runs local detection, displays badges.

**Implementation:**

```typescript
import { useState, useEffect } from "react"
import type { PlasmoCSConfig } from "plasmo"
import { sendToBackground } from "@plasmohq/messaging"
import { LocalRulesEngine } from "~lib/local-rules"
import { ScamBadge } from "~components/badge/ScamBadge"
import { extractJobData, injectBadge } from "~lib/linkedin-dom"

export const config: PlasmoCSConfig = {
  matches: ["https://www.linkedin.com/jobs/*"],
  run_at: "document_end",
  world: "MAIN"
}

export default function LinkedInScanner() {
  const [jobData, setJobData] = useState(null)
  const [riskLevel, setRiskLevel] = useState<"safe" | "caution" | "danger">("safe")
  const [showReport, setShowReport] = useState(false)

  useEffect(() => {
    // 1. Extract job data from DOM
    const data = extractJobData()
    if (!data) return

    setJobData(data)

    // 2. Run local rules engine (instant)
    const localRules = new LocalRulesEngine()
    const localResult = localRules.analyze(data)

    // 3. Display initial badge based on local rules
    setRiskLevel(localResult.riskLevel)

    // 4. Call Gemini API for deep analysis (background)
    analyzeWithGemini(data).then(geminiResult => {
      // 5. Update badge if Gemini finds higher risk
      if (geminiResult.riskScore > localResult.riskScore) {
        setRiskLevel(geminiResult.riskLevel)
      }
    })
  }, [])

  const analyzeWithGemini = async (data) => {
    const response = await sendToBackground({
      name: "scan-job",
      body: {
        jobText: data.description,
        jobUrl: data.url,
        companyName: data.company
      }
    })
    return response
  }

  return (
    <div className="scam-detector-badge">
      <ScamBadge
        riskLevel={riskLevel}
        onClick={() => setShowReport(true)}
      />
      {showReport && (
        <RiskReport
          jobData={jobData}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  )
}
```

**Key Features:**

- Runs at `document_end` to ensure DOM is ready
- Monitors for job posting elements using MutationObserver
- Injects badge dynamically without breaking LinkedIn's layout
- Uses CSS-in-JS (via Tailwind) to avoid style conflicts

---

### Background Service Worker (`scan-job.ts`)

**Purpose:** Handles API calls to backend, manages caching.

**Implementation:**

```typescript
import type { PlasmoMessaging } from "@plasmohq/messaging";
import { hashJobUrl } from "~lib/utils/hash";
import { getCachedScan, setCachedScan } from "~lib/utils/cache";
import { trpc } from "~trpc/client";

const handler: PlasmoMessaging.MessageHandler = async (req, res) => {
  const { jobText, jobUrl, companyName } = req.body;

  try {
    // 1. Generate URL hash for caching
    const jobHash = hashJobUrl(jobUrl);

    // 2. Check local cache first
    const cached = await getCachedScan(jobHash);
    if (cached && !cached.isExpired) {
      res.send({ success: true, data: cached.result });
      return;
    }

    // 3. Call backend API (tRPC)
    const result = await trpc.scamDetector.scanJob.mutate({
      jobText,
      jobUrl,
      companyName,
    });

    // 4. Cache result locally (24 hour TTL)
    await setCachedScan(jobHash, result, 24 * 60 * 60 * 1000);

    // 5. Return result
    res.send({ success: true, data: result });
  } catch (error) {
    console.error("[scan-job] Error:", error);
    res.send({
      success: false,
      error: error.message || "Failed to scan job posting",
    });
  }
};

export default handler;
```

**Caching Strategy:**

- **Local Cache (Chrome Storage):** 24-hour TTL per job URL hash
- **Backend Cache (Prisma):** 7-day TTL in ScanCache table
- **Cache Invalidation:** Manual clear via options page

---

## Local Rules Engine

### Purpose

Instant detection of obvious scam patterns without API calls. Runs in <100ms.

### Implementation

#### `lib/local-rules/index.ts`

```typescript
import { emailCheck } from "./email-check";
import { keywordMatcher } from "./keyword-matcher";
import { salaryAnalyzer } from "./salary-analyzer";

export interface JobData {
  description: string;
  title: string;
  company: string;
  salary?: string;
}

export interface LocalRulesResult {
  riskScore: number; // 0-100
  riskLevel: "safe" | "caution" | "danger";
  flags: Array<{
    type: string;
    confidence: "low" | "medium" | "high";
    message: string;
  }>;
}

export class LocalRulesEngine {
  analyze(jobData: JobData): LocalRulesResult {
    const flags = [];
    let riskScore = 0;

    // 1. Email domain check
    const emailFlags = emailCheck(jobData.description);
    flags.push(...emailFlags);
    riskScore += emailFlags.length * 25;

    // 2. Keyword pattern matching
    const keywordFlags = keywordMatcher(jobData.description);
    flags.push(...keywordFlags);
    riskScore += keywordFlags.length * 15;

    // 3. Salary analysis
    if (jobData.salary) {
      const salaryFlags = salaryAnalyzer(jobData.salary, jobData.title);
      flags.push(...salaryFlags);
      riskScore += salaryFlags.length * 20;
    }

    // Cap at 100
    riskScore = Math.min(riskScore, 100);

    // Determine risk level
    let riskLevel: "safe" | "caution" | "danger" = "safe";
    if (riskScore >= 70) riskLevel = "danger";
    else if (riskScore >= 40) riskLevel = "caution";

    return { riskScore, riskLevel, flags };
  }
}
```

#### `lib/local-rules/email-check.ts`

```typescript
const PERSONAL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "aol.com",
  "icloud.com",
  "protonmail.com",
];

const RECRUITING_DOMAINS = [
  "indeed.com",
  "linkedin.com",
  "glassdoor.com",
  "ziprecruiter.com",
];

export function emailCheck(description: string) {
  const flags = [];

  // Extract emails using regex
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = description.match(emailRegex) || [];

  for (const email of emails) {
    const domain = email.split("@")[1].toLowerCase();

    if (PERSONAL_DOMAINS.includes(domain)) {
      flags.push({
        type: "personal_email",
        confidence: "high",
        message: `Contact email uses personal domain (${domain}). Legitimate recruiters typically use company emails.`,
      });
    }
  }

  return flags;
}
```

#### `lib/local-rules/keyword-matcher.ts`

```typescript
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
  ],
  medium_risk: [
    "work from home guaranteed",
    "no experience required",
    "earn $10,000/month",
    "apply within 24 hours",
    "limited positions",
    "be your own boss",
    "unlimited earning potential",
    "must act now",
  ],
};

export function keywordMatcher(description: string) {
  const flags = [];
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

  // Check medium-risk keywords
  const mediumMatches = SCAM_KEYWORDS.medium_risk.filter((kw) =>
    lowerDesc.includes(kw.toLowerCase()),
  );

  if (mediumMatches.length >= 2) {
    flags.push({
      type: "urgency_language",
      confidence: "medium",
      message: `Multiple urgency/pressure tactics detected. Legitimate jobs don't rush candidates.`,
    });
  }

  return flags;
}
```

#### `lib/local-rules/salary-analyzer.ts`

```typescript
export function salaryAnalyzer(salary: string, jobTitle: string) {
  const flags = [];

  // Extract salary numbers
  const salaryMatch = salary.match(/\$?([\d,]+)/);
  if (!salaryMatch) return flags;

  const salaryAmount = parseInt(salaryMatch[1].replace(/,/g, ""));

  // Check if entry-level with unrealistic salary
  const isEntryLevel = /entry|junior|intern|associate|assistant/i.test(
    jobTitle,
  );

  if (isEntryLevel && salaryAmount > 150000) {
    flags.push({
      type: "unrealistic_salary",
      confidence: "high",
      message: `Salary ($${salaryAmount.toLocaleString()}) is unusually high for an entry-level position.`,
    });
  }

  // Check for vague promises
  if (/guaranteed|up to|potential/i.test(salary)) {
    flags.push({
      type: "vague_salary",
      confidence: "medium",
      message: `Salary uses vague language ("guaranteed", "up to", "potential"). Legitimate jobs specify clear ranges.`,
    });
  }

  return flags;
}
```

---

## Backend API Architecture

### tRPC Router (`packages/api/src/routers/scam-detector.ts`)

```typescript
import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { prisma } from "@repo/db";
import { createHash } from "crypto";

export const scamDetectorRouter = router({
  // Main scanning endpoint
  scanJob: publicProcedure
    .input(
      z.object({
        jobText: z.string().min(10),
        jobUrl: z.string().url(),
        companyName: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { jobText, jobUrl, companyName } = input;

      // 1. Generate URL hash
      const jobUrlHash = createHash("sha256").update(jobUrl).digest("hex");

      // 2. Check database cache (7-day TTL)
      const cached = await prisma.scanCache.findUnique({
        where: { jobUrlHash },
      });

      if (cached && cached.expiresAt > new Date()) {
        return {
          riskScore: cached.riskScore,
          flags: cached.flags as any[],
          source: "cache",
        };
      }

      // 3. Call Gemini 2.0 Flash via Vercel AI SDK
      const result = await generateObject({
        model: google("gemini-2.0-flash-exp"),
        schema: z.object({
          riskScore: z.number().min(0).max(100),
          riskLevel: z.enum(["safe", "caution", "danger"]),
          flags: z.array(
            z.object({
              type: z.string(),
              confidence: z.enum(["low", "medium", "high"]),
              message: z.string(),
              reasoning: z.string(),
            }),
          ),
          summary: z.string(),
        }),
        prompt: `You are a job scam detection expert. Analyze this LinkedIn job posting and identify potential scam indicators.

Job Title: ${companyName || "Unknown"}
Job Description:
${jobText}

Look for these red flags:
1. Financial requests (training fees, background checks, equipment purchases)
2. Personal email domains instead of corporate (gmail, yahoo, etc.)
3. Unrealistic compensation or vague salary promises
4. Urgency language ("apply within 24 hours", "limited spots")
5. Poor grammar or excessive capitalization
6. Requests for sensitive information upfront (SSN, bank details)
7. Multi-level marketing (MLM) language
8. Cryptocurrency or "investment opportunity" mentions

For each flag found:
- Assign confidence level (low/medium/high)
- Provide clear explanation for job seekers
- Explain WHY it's concerning

Calculate overall risk score (0-100):
- 0-40: Safe (normal job posting)
- 41-69: Caution (some concerns, proceed carefully)
- 70-100: Danger (likely scam, do not apply)

Respond with structured JSON.`,
      });

      // 4. Cache result in database
      await prisma.scanCache.create({
        data: {
          jobUrlHash,
          riskScore: result.object.riskScore,
          flags: result.object.flags as any,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      // 5. Return result
      return {
        ...result.object,
        source: "gemini",
      };
    }),

  // Feedback submission
  submitFeedback: publicProcedure
    .input(
      z.object({
        jobUrlHash: z.string(),
        feedbackType: z.enum(["false_positive", "false_negative", "other"]),
        details: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await prisma.feedback.create({
        data: {
          jobUrlHash: input.jobUrlHash,
          feedbackType: input.feedbackType,
          details: input.details,
        },
      });

      return { success: true };
    }),
});
```

### Gemini Integration (Vercel AI SDK)

**Why Vercel AI SDK?**

- Unified interface for multiple LLM providers
- Built-in error handling and retries
- Streaming support (future feature)
- Type-safe with Zod schemas
- Cost tracking and logging

**Configuration:**

```typescript
// packages/api/src/lib/ai.ts
import { google } from "@ai-sdk/google";

export const geminiModel = google("gemini-2.0-flash-exp", {
  apiKey: process.env.GOOGLE_AI_API_KEY,

  // Optional: Configure advanced settings
  safetySettings: [
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  ],

  // Optional: Adjust parameters
  temperature: 0.3, // Lower = more consistent
  topP: 0.9,
  topK: 40,
});
```

**Structured Output:**

```typescript
import { generateObject } from "ai";
import { z } from "zod";

const scamAnalysisSchema = z.object({
  riskScore: z.number().min(0).max(100).describe("Overall risk score"),
  riskLevel: z.enum(["safe", "caution", "danger"]),
  flags: z.array(
    z.object({
      type: z
        .string()
        .describe("Flag category (e.g., 'personal_email', 'upfront_payment')"),
      confidence: z.enum(["low", "medium", "high"]),
      message: z.string().describe("User-friendly explanation"),
      reasoning: z.string().describe("Why this is a red flag"),
    }),
  ),
  summary: z.string().describe("One-sentence summary of the analysis"),
});

const result = await generateObject({
  model: geminiModel,
  schema: scamAnalysisSchema,
  prompt: "...", // See above for full prompt
});
```

**Error Handling:**

```typescript
try {
  const result = await generateObject({ ... })
} catch (error) {
  if (error.name === "AI_APICallError") {
    // API call failed (network, rate limit, etc.)
    console.error("Gemini API error:", error.message)
    // Fall back to local rules only
    return fallbackAnalysis(jobText)
  } else if (error.name === "AI_InvalidResponseError") {
    // Response didn't match schema
    console.error("Invalid Gemini response:", error.message)
    // Retry with simplified prompt
    return retryWithSimplifiedPrompt(jobText)
  } else {
    throw error
  }
}
```

---

## Database Schema

### Prisma Schema (`packages/db/prisma/schema/scam-detector.prisma`)

```prisma
// packages/db/prisma/schema/scam-detector.prisma

model Feedback {
  id           String   @id @default(cuid())
  jobUrlHash   String   @db.VarChar(64)
  feedbackType String   @db.VarChar(50)
  details      String?  @db.Text
  submittedAt  DateTime @default(now())

  @@index([jobUrlHash])
  @@index([feedbackType])
  @@map("scam_detector_feedback")
}

model ScanCache {
  id          String   @id @default(cuid())
  jobUrlHash  String   @unique @db.VarChar(64)
  riskScore   Int
  flags       Json
  scannedAt   DateTime @default(now())
  expiresAt   DateTime

  @@index([jobUrlHash, expiresAt])
  @@map("scam_detector_scan_cache")
}
```

**Indexes:**

- `jobUrlHash` on both tables for fast lookups
- `feedbackType` for analyzing feedback distribution
- `expiresAt` for efficient cache cleanup queries

**Data Retention:**

- **ScanCache:** 7-day TTL, automatically cleaned up via cron job
- **Feedback:** Indefinite retention for analysis (anonymized)

---

## Security & Privacy

### Data Flow

1. **Job posting data** extracted from LinkedIn DOM
2. **Job URL** hashed (SHA-256) before storage
3. **Job description** sent to Gemini API (ephemeral, not stored by Google)
4. **Scan result** cached in database (7 days)
5. **User feedback** stored with job hash only (no user IDs)

### Privacy Guarantees

- NO LinkedIn user IDs collected
- NO browsing history tracked
- NO personal information stored
- Job content sent to Gemini is ephemeral per API terms
- Extension settings stored locally only (Chrome Storage API)

### Content Security Policy (CSP)

```json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

### Permissions (manifest.json)

```json
{
  "permissions": [
    "storage", // Local cache
    "activeTab" // Content script injection
  ],
  "host_permissions": ["https://www.linkedin.com/*"]
}
```

**Why these permissions are needed:**

- `storage`: Cache scan results locally to avoid redundant API calls
- `activeTab`: Inject content script into LinkedIn job pages
- `linkedin.com`: Read job posting content for analysis

---

## Performance Optimization

### Caching Strategy

**Three-tier caching:**

1. **Extension Local Cache (Chrome Storage)**
   - TTL: 24 hours
   - Size: ~1MB max (Chrome limit: 10MB)
   - Fastest: <10ms lookup

2. **Backend Database Cache (Prisma)**
   - TTL: 7 days
   - Size: Unlimited
   - Fast: ~50-100ms lookup

3. **API Call (Gemini)**
   - Only on cache miss
   - Slowest: 1-2 seconds
   - Cost: $0.0001 per call

### Lazy Loading

- Badges injected only for visible job cards (viewport detection)
- Gemini API called in background after local rules display
- Debounced DOM monitoring (300ms) to avoid excessive re-renders

### Bundle Size

**Target:** <500KB total extension size

- Code splitting via Plasmo
- Tree-shaking unused React components
- Tailwind CSS purge for minimal CSS bundle
- Lazy load report modal (only when clicked)

---

## Error Handling

### Extension Errors

```typescript
try {
  const result = await analyzeJob(jobData);
} catch (error) {
  if (error.code === "NETWORK_ERROR") {
    // Show offline badge
    setRiskLevel("unknown");
    setErrorMessage("Offline - using local rules only");
  } else if (error.code === "API_RATE_LIMIT") {
    // Show rate limit message
    setErrorMessage("Rate limit reached. Try again in 1 minute.");
  } else {
    // Generic error
    console.error("Scan error:", error);
    setErrorMessage("Failed to scan. Please refresh and try again.");
  }
}
```

### API Errors

```typescript
export const scamDetectorRouter = router({
  scanJob: publicProcedure
    .input(...)
    .mutation(async ({ input }) => {
      try {
        // ... normal flow
      } catch (error) {
        console.error("[scanJob] Error:", error)

        // Return fallback result instead of throwing
        return {
          riskScore: 50,
          riskLevel: "caution",
          flags: [{
            type: "analysis_error",
            confidence: "low",
            message: "Unable to complete full analysis. Proceed with caution.",
            reasoning: "Temporary service disruption."
          }],
          summary: "Analysis incomplete - use your judgment.",
          source: "fallback"
        }
      }
    }),
})
```

---

## Testing Strategy

### Unit Tests

- **Local Rules Engine:** Test each rule with known scam/legitimate examples
- **Job Data Extraction:** Test with various LinkedIn DOM structures
- **Caching Logic:** Test TTL, eviction, and invalidation

### Integration Tests

- **tRPC API:** Test full request/response flow
- **Gemini Integration:** Mock API responses, test error handling
- **Database:** Test cache storage and retrieval

### Manual Testing

- **Real LinkedIn Jobs:** Test on 50+ actual job postings
- **False Positive Rate:** Target <10%
- **False Negative Rate:** Target <20%
- **Performance:** Verify badge appears within 2 seconds

---

## Deployment

### Chrome Extension

1. Build production bundle: `bun run build`
2. Test in Chrome: Load unpacked extension from `build/chrome-mv3-prod`
3. Create ZIP: `bun run package`
4. Submit to Chrome Web Store
5. Wait for review (~3-7 days)

### Backend API

1. Push to GitHub
2. Vercel auto-deploys from `main` branch
3. Environment variables configured in Vercel dashboard
4. Database migrations run automatically via Prisma

### Environment Variables

```bash
# Backend (.env)
DATABASE_URL=postgresql://...
GOOGLE_AI_API_KEY=...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=https://...
CORS_ORIGIN=chrome-extension://...

# Extension (.env)
PLASMO_PUBLIC_API_URL=https://your-api.vercel.app
```

---

## Future Technical Improvements (Phase 2+)

### Planned Enhancements

1. **Streaming Responses:** Use Vercel AI SDK's `streamObject()` for real-time analysis display
2. **Offline Mode:** Bundle lightweight ML model (TensorFlow.js) for offline detection
3. **Community Database:** Shared scam hash database with privacy-preserving queries
4. **Company Verification:** Domain whois lookup, LinkedIn company page scraping
5. **Browser Extension APIs:** Firefox and Safari support via WebExtensions Polyfill

### Performance Monitoring

- Sentry for error tracking
- Vercel Analytics for API performance
- Custom metrics: scan latency, cache hit rate, false positive rate

---

## Appendix: Key Technical Decisions

### Why Gemini 2.0 Flash?

- **30x cheaper** than Claude ($0.0001 vs $0.003 per scan)
- **Faster** (<1s response time)
- **Structured output** natively supported
- **1M token context** (overkill for job descriptions, but future-proof)

### Why Vercel AI SDK?

- **Provider-agnostic:** Easy to switch between Gemini, Claude, OpenAI
- **Type-safe:** Zod schemas ensure consistent responses
- **Built-in features:** Streaming, error handling, retries
- **Cost tracking:** Automatic token usage logging

### Why Plasmo?

- **Already used in monorepo** (consistent with existing Chrome extension)
- **HMR for fast development**
- **React support** (same UI library as web app)
- **Simplified messaging** (cleaner than raw Chrome APIs)

### Why tRPC?

- **Type-safe** end-to-end (no API contract drift)
- **Already integrated** in monorepo
- **Easy to extend** (add routers without breaking existing code)

---

**Document Version:** 1.0
**Last Updated:** 2025-01-04
**Owner:** Ali Burak Özden
**Status:** Ready for Review
