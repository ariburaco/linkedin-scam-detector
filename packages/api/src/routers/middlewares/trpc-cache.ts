import { createHash } from "crypto";

import { env } from "@acme/shared/env";
import { createCacheMiddleware } from "trpc-redis-cache";

import { extractLinkedInJobId } from "../../utils/linkedin-url-parser";

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
    const input = rawInput as {
      jobUrl: string;
      linkedinJobId?: string;
    };

    // Priority 1: Use linkedinJobId from payload if present
    if (input.linkedinJobId) {
      return `${path}:${input.linkedinJobId}`;
    }

    // Priority 2: Extract job ID from URL using comprehensive parser
    if (input.jobUrl) {
      const extractedJobId = extractLinkedInJobId(input.jobUrl);
      if (extractedJobId) {
        return `${path}:${extractedJobId}`;
      }
    }

    // Don't cache if job ID cannot be extracted (null cache key would cause collisions)
    // Return a timestamp-based unique key that ensures no caching (each request is unique)
    // This effectively disables caching for requests without job IDs
    const timestamp = Date.now();
    const urlHash = createHash("sha256")
      .update(`${input.jobUrl || ""}:${timestamp}`)
      .digest("hex")
      .substring(0, 16);
    return `${path}:no-job-id:${timestamp}:${urlHash}`;
  },
});
