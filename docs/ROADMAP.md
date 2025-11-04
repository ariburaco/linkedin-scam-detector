# LinkedIn Scam Detector - Product Roadmap

**Version:** 1.0
**Last Updated:** 2025-01-04
**Status:** Draft

This roadmap follows a **validate-before-building** philosophy. Phase 2+ features are contingent on user demand signals from Phase 1.

---

## Phase 1: MVP (Weeks 1-2) - CORE LOOP ONLY

**Goal:** Ship minimum viable product that delivers core value

**Deadline:** 14 days from start

### Week 1: Core Detection + UI

**Days 1-2: Project Setup**

- [x] Set up Plasmo extension in monorepo
- [ ] Create tRPC router for scam detection
- [ ] Design Prisma schema (ScanCache, Feedback tables)
- [ ] Set up Vercel AI SDK with Gemini 2.0 Flash
- [ ] Configure environment variables

**Days 3-5: Hybrid Detection System**

- [ ] Implement local rules engine
  - [ ] Email domain check
  - [ ] Keyword pattern matching
  - [ ] Salary analysis
- [ ] Build Gemini API integration with structured output
- [ ] Create badge injection system on LinkedIn job postings
- [ ] Test hybrid flow: local → badge → Gemini → update

**Days 6-7: Risk Report UI**

- [ ] Design and build badge component (🟢🟡🔴)
- [ ] Build detailed risk report modal
- [ ] Implement feedback button
- [ ] Test on live LinkedIn pages
- [ ] Fix layout issues across LinkedIn's different page structures

---

### Week 2: Polish + Launch

**Days 8-10: Testing & Refinement**

- [ ] Test on 50+ real LinkedIn job postings
- [ ] Tune Gemini prompts for better accuracy
- [ ] Fix false positives (target <10%)
- [ ] Implement caching layer (local + database)
- [ ] Optimize performance (lazy loading, debouncing)

**Days 11-12: Extension Features**

- [ ] Build extension popup (basic stats: scans today, high-risk jobs avoided)
- [ ] Create simple options page (privacy settings, about, clear cache)
- [ ] Add first-time onboarding tooltip
- [ ] Implement error handling and fallback logic
- [ ] Write user-facing documentation

**Days 13-14: Launch Preparation**

- [ ] Create Chrome Web Store listing
  - [ ] Screenshots (5 images showing badge, report, settings)
  - [ ] Description (emphasize privacy-first, AI-powered, free)
  - [ ] Privacy policy page
- [ ] Test on Windows, Mac, Linux
- [ ] Beta test with 5-10 users (friends, Reddit volunteers)
- [ ] Submit to Chrome Web Store
- [ ] Prepare Product Hunt launch materials (demo video, images)

---

### MVP Feature Set (Ruthlessly Scoped)

**✅ Building:**

1. Badge display (Green/Yellow/Red indicator)
2. Local rules engine (instant red flags)
3. Gemini API integration (deep analysis)
4. Detailed risk report modal
5. Feedback collection button

**❌ NOT Building:**

- Community reporting system (validate demand first)
- Company verification (too complex for MVP)
- User accounts / authentication (not needed for core loop)
- Analytics dashboard (premature)
- Multi-language support (English only)

---

### Definition of Done (Phase 1)

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

## Phase 2: Validate Demand (Weeks 3-8)

**Goal:** Build ONLY features users explicitly request

**Trigger to proceed:** 500+ active users + clear demand signals from feedback

### Features Under Consideration (Validate First)

#### A. Community Reporting System

**Validation Signal:**

- IF >10% of users submit feedback via "Report Issue" button
- AND feedback contains requests like "I want to report scams" or "Can others see my reports?"

**THEN Build:**

- Full community reporting flow
- Aggregated scam warnings ("Reported by 3+ users")
- Report moderation system

**IF NOT validated:** Keep feedback-only system

---

#### B. Company Verification

**Validation Signal:**

- IF >30% of false positive feedback mentions "This company is legitimate"
- AND users complain about lack of company verification

**THEN Build:**

- Domain ownership verification
- LinkedIn company page age check
- Employee count analysis
- Company reputation scoring

**IF NOT validated:** Focus on improving prompt accuracy instead

---

#### C. Local ML Model (Offline Detection)

**Validation Signal:**

- IF Gemini API costs exceed $200/month
- OR users complain about slow scan times

**THEN Build:**

- Train lightweight TensorFlow.js model
- Deploy client-side for instant offline detection
- Fall back to Gemini for ambiguous cases

**IF NOT validated:** Stick with Gemini API (cost-effective at $0.0001/scan)

---

#### D. Scan History & Analytics

**Validation Signal:**

- IF users explicitly request "I want to see my past scans"
- AND >5% of users revisit the extension more than once per day

**THEN Build:**

- Personal scan history page
- Statistics dashboard (scams avoided, jobs scanned)
- Export CSV functionality

**IF NOT validated:** Keep extension stateless

---

### Phase 2 Timeline

**IF validated**, each feature takes approximately:

- Community reporting: 2 weeks
- Company verification: 1 week
- Local ML model: 3 weeks (includes training data collection)
- Scan history: 1 week

**Prioritize by:**

1. Highest user demand (feedback volume)
2. Reduces false positives
3. Increases retention (users come back)

---

## Phase 3: Growth & Expansion (Months 3-6)

**Goal:** Scale user base, add monetization features

**Trigger to proceed:** 5,000+ active users + $1K MRR

### Potential Features (Based on Validated Demand)

#### 1. Multi-Language Support

**Build IF:** International users request it (>20% non-English speakers)

- Spanish (Latin America market)
- French (France, Canada)
- German (Germany market)
- Hindi (India market)

**Effort:** 2 weeks (translations + prompt engineering per language)

---

#### 2. Firefox & Safari Extensions

**Build IF:** Users explicitly ask "Is this available on Firefox/Safari?"

- Firefox: 1 week (WebExtensions API)
- Safari: 2 weeks (Safari Web Extension)

**Risk:** Maintenance burden for multiple platforms

---

#### 3. Profile Analysis

**Build IF:** Scammers evolve to create convincing company pages

- Analyze recruiter LinkedIn profiles
- Check network connections
- Verify employment history

**Effort:** 3 weeks

**Scope creep warning:** This adds new surface area (profiles ≠ job postings)

---

#### 4. Team/Enterprise Tier

**Build IF:** Recruiting agencies or HR teams reach out

- Multi-user accounts
- Shared scam database
- Admin dashboard
- API access

**Pricing:** $299-999/month
**Effort:** 4 weeks

---

#### 5. Browser-Based Alternative (No Extension)

**Build IF:** LinkedIn starts blocking extensions OR users don't want to install

- Standalone web tool: Paste job description for analysis
- Same Gemini backend, different UX
- Slower workflow but no extension risk

**Effort:** 1 week

---

### Phase 3 Prioritization Framework

**For each feature, ask:**

1. Does this serve the core use case? (scam detection on LinkedIn)
2. Will users actually use this or just say they want it?
3. Can we fake it first to validate demand?

**Only build if all three answers are YES.**

---

## Long-Term Vision (Year 2+)

**IF** we achieve product-market fit (10K+ users, $10K+ MRR), consider:

- **AI-powered job matching:** Not just scam detection, but "good fit" scoring
- **Career safety suite:** Resume review, interview prep, salary negotiation
- **Platform expansion:** Indeed, Glassdoor, ZipRecruiter
- **Data licensing:** Sell anonymized scam trends to LinkedIn, researchers
- **White-label:** License technology to job boards

**BUT:** Don't plan these now. Focus on Phase 1 core loop.

---

## Red Flags to Avoid

### 🚫 Feature Creep

**Symptom:** "While we're building X, we should also add Y"
**Fix:** Finish X, ship it, validate demand for Y

**Example:**

- ❌ "We're building company verification, let's also add recruiter profile analysis"
- ✅ "Ship company verification, see if users ask for recruiter analysis"

---

### 🚫 Premature Optimization

**Symptom:** "We should cache in Redis for faster performance"
**Fix:** Is performance actually a problem users complain about?

**Example:**

- ❌ "Build custom ML model in Phase 1 for faster scans"
- ✅ "Use Gemini API, optimize only if users complain about speed"

---

### 🚫 Building for Imaginary Users

**Symptom:** "Users will want to share scam reports on social media"
**Fix:** Have real users explicitly asked for this?

**Example:**

- ❌ "Add Twitter/LinkedIn share buttons for scam reports"
- ✅ "Wait for users to request sharing features"

---

## Success Metrics by Phase

### Phase 1 (MVP) - Validation

**Primary:** 1,000 active users within 30 days
**Secondary:**

- 30%+ report click-through rate (users engage with detailed analysis)
- <10% false positive rate
- 50+ feedback submissions

**Learn:**

- Which scam patterns are most common?
- Do users trust AI analysis?
- What features do they request?

---

### Phase 2 (Demand Validation) - Product-Market Fit

**Primary:** 5,000 active users + $1K MRR
**Secondary:**

- 2-5% free-to-paid conversion rate
- <5% monthly churn
- Weekly active users >50% of total installs

**Learn:**

- Which Phase 2 features drive retention?
- What causes users to upgrade to Pro?
- Are false positives decreasing?

---

### Phase 3 (Growth) - Scale

**Primary:** 50,000 active users + $10K MRR
**Secondary:**

- 80%+ annual retention
- LTV > $100 per paid user
- Organic growth (word-of-mouth, no paid ads)

**Learn:**

- Can we scale without LinkedIn shutting us down?
- Is the business sustainable?
- What's the path to $100K ARR?

---

## Roadmap Cadence

### Ship Frequently

- **MVP:** Ship in 2 weeks (maximum)
- **Phase 2 features:** Ship individually as they're validated (1-2 week iterations)
- **Phase 3 features:** Ship quarterly (bundle improvements)

### Learn Continuously

- **Weekly:** Review feedback submissions, false positive reports
- **Monthly:** Analyze metrics (MAU, conversion, churn)
- **Quarterly:** User interviews (5-10 power users + 5-10 churned users)

---

## Flexibility Over Planning

This roadmap is **intentionally vague** for Phase 2+.

**Why?**

- We don't know what users will actually want until they use Phase 1
- Planning Phase 3 now is premature
- Better to ship fast, learn, adapt

**How to use this roadmap:**

1. **Phase 1:** Follow exactly (core loop is clear)
2. **Phase 2:** Review after MVP launch, prioritize based on real feedback
3. **Phase 3:** Rewrite entirely based on Phase 2 learnings

---

## Key Decisions

### Decision: No User Accounts in Phase 1

**Rationale:** Core loop works anonymously
**Validate:** Do users request "save my settings across devices"?
**IF YES in Phase 2:** Add optional auth (email or Google OAuth)

### Decision: English-Only in Phase 1

**Rationale:** 80% of LinkedIn users speak English
**Validate:** Do non-English speakers install and request translations?
**IF YES in Phase 2:** Add top 3 requested languages

### Decision: Chrome-Only in Phase 1

**Rationale:** 65% browser market share, fastest to build
**Validate:** Do Firefox/Safari users explicitly request it?
**IF YES in Phase 3:** Port to other browsers

### Decision: Feedback Button (Not Full Community Reporting)

**Rationale:** Validate demand before building complex system
**Validate:** Do >10% of users submit feedback?
**IF YES in Phase 2:** Build full community reporting with aggregated warnings

---

## Changelog

- **v1.0 (2025-01-04):** Initial roadmap - MVP only, Phase 2+ validation-gated
- **v1.1 (TBD):** Updated after MVP launch based on user feedback
- **v2.0 (TBD):** Phase 2 roadmap rewritten based on validated demand

---

**Document Version:** 1.0
**Last Updated:** 2025-01-04
**Owner:** Ali Burak Özden
**Status:** Draft - Ready for Execution
