import { Storage } from "@plasmohq/storage";

const storage = new Storage({ area: "local" });

const STATS_KEYS = {
  SCANNED_TODAY: "stats_scannedToday",
  THREATS_BLOCKED: "stats_threatsBlocked",
  LAST_RESET_DATE: "stats_lastResetDate",
} as const;

/**
 * Get today's date as YYYY-MM-DD string for comparison
 */
function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Reset daily stats if it's a new day
 */
async function ensureDailyReset(): Promise<void> {
  const lastResetDate = await storage.get<string>(STATS_KEYS.LAST_RESET_DATE);
  const today = getTodayDateString();

  if (lastResetDate !== today) {
    // Reset daily stats
    await storage.set(STATS_KEYS.SCANNED_TODAY, 0);
    await storage.set(STATS_KEYS.LAST_RESET_DATE, today);
  }
}

/**
 * Increment the number of jobs scanned today
 */
export async function incrementScannedToday(): Promise<void> {
  await ensureDailyReset();
  const current = (await storage.get<number>(STATS_KEYS.SCANNED_TODAY)) || 0;
  await storage.set(STATS_KEYS.SCANNED_TODAY, current + 1);
}

/**
 * Increment the number of threats blocked (jobs with risk level "danger")
 */
export async function incrementThreatsBlocked(): Promise<void> {
  const current = (await storage.get<number>(STATS_KEYS.THREATS_BLOCKED)) || 0;
  await storage.set(STATS_KEYS.THREATS_BLOCKED, current + 1);
}

/**
 * Get stats for the popup display
 */
export async function getStats(): Promise<{
  scannedToday: number;
  threatsBlocked: number;
  safetyScore: number;
}> {
  await ensureDailyReset();

  const scannedToday =
    (await storage.get<number>(STATS_KEYS.SCANNED_TODAY)) || 0;
  const threatsBlocked =
    (await storage.get<number>(STATS_KEYS.THREATS_BLOCKED)) || 0;

  // Calculate safety score (percentage of safe jobs)
  // This is a simplified calculation - in reality you'd track safe vs dangerous
  // For now, we'll use: 100 - (threatsBlocked / scannedToday * 100) if scannedToday > 0
  let safetyScore = 100;
  if (scannedToday > 0) {
    const threatPercentage = (threatsBlocked / scannedToday) * 100;
    safetyScore = Math.max(0, Math.round(100 - threatPercentage));
  }

  return {
    scannedToday,
    threatsBlocked,
    safetyScore,
  };
}

/**
 * Reset all stats (useful for testing or user reset action)
 */
export async function resetStats(): Promise<void> {
  await storage.set(STATS_KEYS.SCANNED_TODAY, 0);
  await storage.set(STATS_KEYS.THREATS_BLOCKED, 0);
  await storage.set(STATS_KEYS.LAST_RESET_DATE, getTodayDateString());
}

