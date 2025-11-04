import { createHash } from "crypto";

import { env } from "@acme/shared/env";
import { createCacheMiddleware } from "trpc-redis-cache";

// Use a global cache for app search results with custom key function
export const globalCacheMiddleware: any = createCacheMiddleware({
  ttl: undefined, // Permanent cache
  useUpstash: false,
  globalCache: true, // Use global cache that's shared among all users
  userSpecific: false, // Don't include user ID in cache key
  debug: true,

  redisUrl: env.REDIS_URL,
});

export const scanJobCacheMiddleware: any = createCacheMiddleware({
  ttl: undefined, // Permanent cache
  useUpstash: false,
  globalCache: true, // Use global cache that's shared among all users
  userSpecific: false, // Don't include user ID in cache key
  debug: true,

  redisUrl: env.REDIS_URL,
  getCacheKey(path, rawInput) {
    const jobUrl = (rawInput as { jobUrl: string }).jobUrl;
    if (jobUrl) {
      const currentJobId = parseCurrentJobId(jobUrl);
      return `${path}:${currentJobId}`;
    }
    return `${path}:${jobUrl}`;
  },
});

function parseCurrentJobId(url: string): string | null {
  // https://www.linkedin.com/jobs/collections/recommended/?currentJobId=4331180022&start=24
  // https://www.linkedin.com/jobs/search/?currentJobId=4299578137&distance=25&geoId=101950005&keywords=yaz%C4%B1l%C4%B1m&origin=JOB_COLLECTION_PAGE_KEYWORD_HISTORY&refresh=true

  try {
    const urlObj = new URL(url);
    const currentJobId = urlObj.searchParams.get("currentJobId");
    console.log("🚀 ~ parseCurrentJobId ~ currentJobId:", currentJobId);
    return currentJobId ?? null;
  } catch (error) {
    return null;
  }
}
