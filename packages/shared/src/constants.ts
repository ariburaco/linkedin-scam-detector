export const DEFAULT_PLANS = [
  {
    name: "Free",
    tier: "FREE",
    creditsPerPeriod: 600, // 60 seconds per month
    periodInDays: 30,
    price: 0,
  },
  {
    name: "Pro",
    tier: "PRO",
    creditsPerPeriod: 3600, // 1 hour per month
    periodInDays: 30,
    price: 9.99,
  },
  {
    name: "Enterprise",
    tier: "ENTERPRISE",
    creditsPerPeriod: 18000, // 5 hours per month
    periodInDays: 30,
    price: 29.99,
  },
];
