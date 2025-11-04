# LinkedIn Scam Detector - Monetization Strategy

**Version:** 1.0
**Last Updated:** 2025-01-04
**Status:** Draft

---

## Revenue Model: Freemium

### Free Tier (Acquisition)

**Features:**

- 10 job scans per day
- Basic risk indicator (🟢 Safe / 🟡 Caution / 🔴 Danger)
- Simple risk report with 2-3 red flags
- Access to feedback system

**Purpose:**

- Build user base
- Validate product-market fit
- Generate word-of-mouth growth
- Collect feedback for improvements

---

### Pro Tier ($7.99/month or $79/year)

**Features:**

- ✅ **Unlimited scans** (no daily limit)
- ✅ **Detailed risk analysis** (5+ red flags with reasoning)
- ✅ **AI-powered explanations** (why each flag matters)
- ✅ **Scan history** (review past analyses)
- ✅ **Priority support** (email support within 24 hours)
- ✅ **Early access to new features** (Phase 2/3 features first)

**Why $7.99/month?**

- Market research: Similar security extensions charge $4.99-$9.99/month
- Comparable to: Grammarly ($12/mo), password managers ($3-10/mo)
- Job seeker willingness to pay: High (prevents $2,000 average loss)
- Annual discount: $79/year (saves $16.88, 17% discount)

---

### Team Tier ($29.99/month) - Phase 3

**Features:**

- Everything in Pro
- Up to 10 user accounts
- Shared scan history
- Team analytics dashboard
- Custom warning thresholds
- Admin controls

**Target Audience:**

- Recruiting agencies
- HR teams
- Career coaches
- University career centers

---

## Cost Analysis (Gemini 2.0 Flash)

### API Costs

**Gemini 2.0 Flash Pricing:**

- Input: $0.00001875 per 1K tokens
- Output: $0.000075 per 1K tokens

**Per-Scan Cost Breakdown:**

| Component             | Tokens | Cost          |
| --------------------- | ------ | ------------- |
| Job description input | ~2,000 | $0.0000375    |
| Structured output     | ~500   | $0.0000375    |
| **Total per scan**    | ~2,500 | **$0.000075** |

**Rounded estimate:** ~**$0.0001 per scan**

**Monthly costs at scale:**

| Users   | Scans/User/Month | Total Scans | Monthly Cost |
| ------- | ---------------- | ----------- | ------------ |
| 1,000   | 50               | 50,000      | **$5**       |
| 10,000  | 50               | 500,000     | **$50**      |
| 100,000 | 50               | 5,000,000   | **$500**     |

**30x cheaper than Claude:** Claude costs ~$0.003/scan ($150 for 50K scans vs. Gemini's $5)

---

### Infrastructure Costs

| Service                  | Cost           | Notes                         |
| ------------------------ | -------------- | ----------------------------- |
| Vercel (Next.js hosting) | $20/month      | Hobby plan sufficient for MVP |
| PostgreSQL (Supabase)    | $25/month      | Pro plan (8GB database)       |
| Vercel AI SDK            | $0             | Open source, no fees          |
| Domain + SSL             | $15/year       | Namecheap                     |
| **Total Infrastructure** | **~$50/month** |                               |

---

### Unit Economics

**Free Tier User:**

- Cost: 10 scans/day × 30 days = 300 scans/month
- API cost: 300 × $0.0001 = **$0.03/month**
- Infrastructure (allocated): **$0.005/month**
- **Total cost per free user:** **~$0.035/month**

**Pro Tier User:**

- Revenue: **$7.99/month**
- Cost: 100 scans/month × $0.0001 = **$0.01/month** (API)
- Infrastructure (allocated): **$0.01/month**
- Payment processing (Stripe 2.9% + $0.30): **$0.53/month**
- **Total cost per pro user:** **~$0.54/month**
- **Net profit per pro user:** **$7.45/month (93% margin)**

---

## Revenue Projections

### Year 1 Conservative Scenario

**Assumptions:**

- Launch Month 1: 500 users
- Growth: 30% MoM for 6 months, then 15% MoM
- Conversion rate: 2% (free to paid)

| Month | Total Users | Paid Users | MRR  | Costs | Net Profit |
| ----- | ----------- | ---------- | ---- | ----- | ---------- |
| 1     | 500         | 10         | $80  | $70   | $10        |
| 3     | 845         | 17         | $136 | $85   | $51        |
| 6     | 1,967       | 39         | $312 | $120  | $192       |
| 12    | 4,456       | 89         | $711 | $200  | $511       |

**Year 1 Total Revenue:** ~$3,000
**Year 1 Total Profit:** ~$2,000

---

### Year 1 Optimistic Scenario

**Assumptions:**

- Viral launch (Product Hunt featured)
- 50% MoM growth for 3 months, then 25%
- Conversion rate: 3.5%

| Month | Total Users | Paid Users | MRR     | Costs  | Net Profit |
| ----- | ----------- | ---------- | ------- | ------ | ---------- |
| 1     | 1,000       | 35         | $280    | $90    | $190       |
| 3     | 3,375       | 118        | $943    | $165   | $778       |
| 6     | 10,547      | 369        | $2,948  | $475   | $2,473     |
| 12    | 46,274      | 1,620      | $12,938 | $1,750 | $11,188    |

**Year 1 Total Revenue:** ~$60,000
**Year 1 Total Profit:** ~$50,000

---

### Break-Even Analysis

**Fixed Costs:**

- Infrastructure: $50/month = **$600/year**
- Domain/misc: **$100/year**
- **Total annual fixed:** **$700**

**Break-even (Pro users needed):**

- $700 ÷ $7.45 net profit per user ÷ 12 months = **~8 Pro users**

**Conclusion:** Break-even at <100 total users (with 2% conversion)

---

## Conversion Strategy

### Free-to-Paid Triggers

**1. Hit Daily Limit**

- Modal: "You've used 10/10 scans today"
- CTA: "Upgrade to Pro for unlimited scans ($7.99/mo)"
- Show time until limit resets

**2. Value Demonstration**

- After 5 scans, show stats: "You've avoided 2 high-risk jobs. Upgrade for detailed analysis."
- Social proof: "Join 1,000+ job seekers protected by Pro"

**3. Feature Teasers**

- Free users see "🔒 Unlock detailed reasoning (Pro)" in reports
- Click shows upgrade modal with preview of Pro features

**4. Email Drip Campaign** (Phase 2)

- Day 3: Tips on spotting scams
- Day 7: Case study of a caught scam
- Day 14: Special offer (20% off first month)

---

### Pricing Psychology

**Why $7.99 works:**

- **Anchor:** Compare to losing $2,000 to a scam → $8/month is 0.4% of potential loss
- **Reference:** Less than Netflix ($15.49), Spotify ($10.99), or one lunch ($12)
- **Framing:** "Less than $0.27 per day to protect your career"
- **Urgency:** "Launch special: $79/year (save $17)"

**A/B Test Pricing:**

- Control: $7.99/month
- Variant A: $4.99/month (higher volume, lower margin)
- Variant B: $9.99/month (premium positioning)
- Measure: Total revenue, not just conversions

---

## Payment Processing

### Stripe Integration

**Fees:**

- 2.9% + $0.30 per transaction
- On $7.99 charge: $0.53 fee (6.6% effective rate)

**Subscription Management:**

- Automatic recurring billing
- Pro-rated upgrades
- Easy cancellation (reduce churn risk)
- Invoice/receipt emailing

**Supported Methods:**

- Credit/debit cards
- Apple Pay / Google Pay
- Link (Stripe's one-click checkout)

---

## Churn Management

### Target Metrics

- **Monthly churn:** <5% (industry standard: 3-7%)
- **Annual retention:** >80%
- **LTV:** $7.99 × 20 months (avg lifespan) = **$159.80**

### Churn Reduction Tactics

**1. Value Reminders**

- Monthly email: "You scanned 47 jobs, avoided 3 scams this month"
- In-app badge: "Protected since [date]"

**2. Win-Back Campaigns**

- Cancel survey: "Why are you leaving?" (address issues)
- Pause subscription option (3 months) instead of canceling
- Discount offer: "Come back for 50% off (3 months)"

**3. Continuous Improvement**

- Use feedback data to improve accuracy
- Ship new features regularly (keep users engaged)
- Respond to support tickets within 24 hours

---

## Long-Term Revenue Streams (Phase 3+)

### 1. B2B/Enterprise

**Target:** Recruiting agencies, HR teams, career centers

- **Pricing:** $299-$999/month (10-50 users)
- **Features:** API access, white-label, custom integrations
- **Potential:** 1-2 enterprise clients = $500-1K MRR

### 2. Affiliate Partnerships

**Partner with:**

- Job boards (Indeed, Glassdoor) → Commission for flagged scam listings
- Background check services → Referral fee for user sign-ups
- Career coaching platforms → Revenue share

**Potential:** $500-2K/month passive income

### 3. Data Licensing (Anonymized)

**Sell insights to:**

- LinkedIn (improve their detection)
- Research institutions
- Cybersecurity companies

**Constraints:** Must be fully anonymized, GDPR-compliant
**Potential:** $5K-20K one-time or annual licensing

### 4. Sponsored "Verified Safe" Badges

**For legitimate companies:**

- Pay $99/month to display "Verified by Scam Detector" badge
- Must pass rigorous company verification
- Risk: Could undermine trust if seen as pay-to-win
- **Phase 4+** only after strong reputation established

---

## Financial Summary

### MVP (Months 1-3)

**Goal:** Validate monetization, achieve break-even

- **Target:** 100 users, 3 Pro subscribers
- **MRR:** $24
- **Costs:** $70/month
- **Status:** Not profitable (expected), validating conversion rate

### Growth Phase (Months 4-12)

**Goal:** Scale to $1K MRR

- **Target:** 5,000 users, 100 Pro subscribers
- **MRR:** $800
- **Costs:** $250/month
- **Net profit:** $550/month ($6,600/year)

### Mature Phase (Year 2+)

**Goal:** Scale to $10K+ MRR

- **Target:** 50,000 users, 1,000 Pro subscribers
- **MRR:** $8,000
- **Costs:** $1,000/month
- **Net profit:** $7,000/month ($84K/year)
- **Add:** B2B tier, affiliates (+$2K MRR)
- **Total:** $10K MRR, $100K+ annual run rate

---

## Key Assumptions

1. **2-5% conversion rate** (free to paid) - Industry standard for freemium
2. **<5% monthly churn** - Achievable with strong value prop
3. **50 scans/user/month average** - Based on active job search patterns
4. **Gemini API remains $0.0001/scan** - Pricing stable, may decrease over time
5. **No competitor undercuts pricing** - $7.99 is defensible for quality
6. **LinkedIn doesn't ban extension** - Primary risk to all revenue

---

## Recommendation

**Launch with freemium immediately:**

- ✅ Low cost to support free users ($0.03/month)
- ✅ High margins on Pro tier (93%)
- ✅ Fast break-even (<100 users)
- ✅ Multiple expansion paths (B2B, affiliates, data)

**Pricing validation plan:**

- Month 1-2: Free for all (build user base)
- Month 3: Introduce 10 scans/day limit, launch Pro tier
- Month 4-6: A/B test $4.99 vs $7.99 vs $9.99
- Month 7+: Optimize based on data

---

**Document Version:** 1.0
**Last Updated:** 2025-01-04
**Owner:** Ali Burak Özden
**Status:** Draft - Ready for Review
