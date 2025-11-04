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
