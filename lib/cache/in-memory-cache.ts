/**
 * In-Memory L1 Cache for QA Cache
 * 
 * Provides sub-millisecond cache lookups with LRU eviction and TTL support.
 * This is a module-level singleton that persists across requests in the same server instance.
 */

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

type LRUCacheOptions = {
  maxEntries?: number;
  defaultTTL?: number; // in milliseconds
};

const DEFAULT_MAX_ENTRIES = 1000;
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Simple LRU Cache with TTL support
 */
export class InMemoryCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxEntries: number;
  private defaultTTL: number;

  constructor(options: LRUCacheOptions = {}) {
    this.cache = new Map();
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.defaultTTL = options.defaultTTL ?? DEFAULT_TTL;
  }

  /**
   * Generate a cache key from multiple components
   */
  static key(...parts: string[]): string {
    return parts.join(":");
  }

  /**
   * Get a value from the cache
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T, ttl?: number): void {
    // Evict oldest entries if at capacity
    while (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    const expiresAt = Date.now() + (ttl ?? this.defaultTTL);
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a specific key
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxEntries: number; defaultTTL: number } {
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      defaultTTL: this.defaultTTL,
    };
  }

  /**
   * Clean up expired entries (can be called periodically)
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// Singleton instance for QA cache
let qaCacheInstance: InMemoryCache<{
  answer: string;
  citations: unknown;
  sessionId: string | null;
}> | null;

export function getQACache(): InMemoryCache<{
  answer: string;
  citations: unknown;
  sessionId: string | null;
}> {
  if (!qaCacheInstance) {
    qaCacheInstance = new InMemoryCache({
      maxEntries: 1000,
      defaultTTL: 5 * 60 * 1000, // 5 minutes
    });
  }
  return qaCacheInstance;
}

/**
 * Generate a cache key for QA lookups
 */
export function getQACacheKey(
  userId: string,
  documentId: string,
  normalizedQuestion: string,
): string {
  return InMemoryCache.key("qa", userId, documentId, normalizedQuestion);
}
