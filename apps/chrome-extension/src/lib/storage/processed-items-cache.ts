/**
 * Generic Processed Items Cache
 * Tracks processed items by ID with timestamps for deduplication
 */

import { Storage } from "@plasmohq/storage";

interface ProcessedItemsMap {
  [key: string]: number; // key -> timestamp
}

export class ProcessedItemsCache<T extends string | number> {
  private storage: Storage;
  private storageKey: string;
  private defaultTTL: number; // in milliseconds
  private cache: Map<T, number> | null = null;
  private cacheLoaded = false;

  constructor(
    cacheName: string,
    defaultTTL: number = 30 * 24 * 60 * 60 * 1000 // 30 days default
  ) {
    this.storage = new Storage({ area: "local" });
    this.storageKey = `processed_items_${cacheName}`;
    this.defaultTTL = defaultTTL;
  }

  /**
   * Load cache from storage (lazy loading)
   */
  private async loadCache(): Promise<void> {
    if (this.cacheLoaded) {
      return;
    }

    try {
      const stored = await this.storage.get<ProcessedItemsMap>(this.storageKey);
      this.cache = new Map<T, number>();

      if (stored) {
        const now = Date.now();
        // Filter out expired entries during load
        for (const [key, timestamp] of Object.entries(stored)) {
          const age = now - timestamp;
          if (age < this.defaultTTL) {
            this.cache.set(key as T, timestamp);
          }
        }

        // If we filtered out expired entries, save the cleaned cache
        if (Object.keys(stored).length !== this.cache.size) {
          await this.saveCache();
        }
      }

      this.cacheLoaded = true;
    } catch (error) {
      console.error(`[ProcessedItemsCache] Failed to load cache:`, error);
      // Fail open - create empty cache
      this.cache = new Map<T, number>();
      this.cacheLoaded = true;
    }
  }

  /**
   * Save cache to storage
   */
  private async saveCache(): Promise<void> {
    if (!this.cache) {
      return;
    }

    try {
      const data: ProcessedItemsMap = {};
      for (const [key, timestamp] of this.cache.entries()) {
        data[String(key)] = timestamp;
      }
      await this.storage.set(this.storageKey, data);
    } catch (error) {
      console.error(`[ProcessedItemsCache] Failed to save cache:`, error);
      // Don't throw - fail gracefully
    }
  }

  /**
   * Check if an item was processed
   */
  async isProcessed(key: T): Promise<boolean> {
    await this.loadCache();
    if (!this.cache) {
      return false;
    }

    const timestamp = this.cache.get(key);
    if (!timestamp) {
      return false;
    }

    // Check if entry is still valid (not expired)
    const age = Date.now() - timestamp;
    if (age >= this.defaultTTL) {
      // Entry expired, remove it
      this.cache.delete(key);
      await this.saveCache();
      return false;
    }

    return true;
  }

  /**
   * Mark items as processed
   */
  async markProcessed(keys: T[]): Promise<void> {
    await this.loadCache();
    if (!this.cache) {
      this.cache = new Map<T, number>();
    }

    const now = Date.now();
    for (const key of keys) {
      this.cache.set(key, now);
    }

    await this.saveCache();
  }

  /**
   * Batch mark items as processed (alias for markProcessed)
   */
  async markProcessedBatch(keys: T[]): Promise<void> {
    return this.markProcessed(keys);
  }

  /**
   * Filter out processed items from an array
   */
  async filterProcessed(items: T[]): Promise<T[]> {
    await this.loadCache();
    if (!this.cache || this.cache.size === 0) {
      return items;
    }

    const now = Date.now();
    const unprocessed: T[] = [];
    const expiredKeys: T[] = [];

    for (const item of items) {
      const timestamp = this.cache.get(item);
      if (!timestamp) {
        unprocessed.push(item);
      } else {
        const age = now - timestamp;
        if (age >= this.defaultTTL) {
          // Entry expired
          expiredKeys.push(item);
          unprocessed.push(item);
        }
        // If not expired, skip it (already processed)
      }
    }

    // Remove expired entries
    if (expiredKeys.length > 0) {
      for (const key of expiredKeys) {
        this.cache.delete(key);
      }
      await this.saveCache();
    }

    return unprocessed;
  }

  /**
   * Clear all entries
   */
  async clear(): Promise<void> {
    try {
      this.cache = new Map<T, number>();
      this.cacheLoaded = true;
      await this.storage.remove(this.storageKey);
    } catch (error) {
      console.error(`[ProcessedItemsCache] Failed to clear cache:`, error);
      throw error;
    }
  }

  /**
   * Cleanup old entries (remove entries older than maxAge)
   * Returns number of entries removed
   */
  async cleanup(maxAge?: number): Promise<number> {
    await this.loadCache();
    if (!this.cache || this.cache.size === 0) {
      return 0;
    }

    const ageThreshold = maxAge ?? this.defaultTTL;
    const now = Date.now();
    const keysToRemove: T[] = [];

    for (const [key, timestamp] of this.cache.entries()) {
      const age = now - timestamp;
      if (age >= ageThreshold) {
        keysToRemove.push(key);
      }
    }

    if (keysToRemove.length > 0) {
      for (const key of keysToRemove) {
        this.cache.delete(key);
      }
      await this.saveCache();
    }

    return keysToRemove.length;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    total: number;
    expired: number;
    valid: number;
  }> {
    await this.loadCache();
    if (!this.cache) {
      return { total: 0, expired: 0, valid: 0 };
    }

    const now = Date.now();
    let expired = 0;
    let valid = 0;

    for (const timestamp of this.cache.values()) {
      const age = now - timestamp;
      if (age >= this.defaultTTL) {
        expired++;
      } else {
        valid++;
      }
    }

    return {
      total: this.cache.size,
      expired,
      valid,
    };
  }
}
