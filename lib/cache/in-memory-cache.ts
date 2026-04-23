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
  sessionId?: string | null,
): string {
  const parts = ["qa", userId, documentId, normalizedQuestion];
  if (sessionId) {
    parts.push(`s:${sessionId}`);
  }
  return parts.join(":");
}

// ==================== Document Chunk Cache ====================

type ChunkCacheEntry = {
  chunkIndex: number;
  content: string;
  embedding: number[];
};

// Singleton for document chunks cache
let chunkCacheInstance: InMemoryCache<ChunkCacheEntry[]> | null;

const CHUNK_CACHE_MAX_ENTRIES = 100;
const CHUNK_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export function getChunkCache(): InMemoryCache<ChunkCacheEntry[]> {
  if (!chunkCacheInstance) {
    chunkCacheInstance = new InMemoryCache<ChunkCacheEntry[]>({
      maxEntries: CHUNK_CACHE_MAX_ENTRIES,
      defaultTTL: CHUNK_CACHE_TTL,
    });
  }
  return chunkCacheInstance;
}

export function getCachedChunks(documentId: string): ChunkCacheEntry[] | null {
  return getChunkCache().get(`chunks:${documentId}`);
}

export function setCachedChunks(documentId: string, chunks: ChunkCacheEntry[]): void {
  getChunkCache().set(`chunks:${documentId}`, chunks, CHUNK_CACHE_TTL);
}

export function invalidateChunkCache(documentId: string): boolean {
  return getChunkCache().delete(`chunks:${documentId}`);
}

// ==================== Image Cache ====================

type ImageCacheEntry = {
  description: string;
  isRelated: boolean;
  analyzedAt: number;
};

const IMAGE_CACHE_MAX_ENTRIES = 50;
const IMAGE_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

let imageCacheInstance: InMemoryCache<ImageCacheEntry> | null;

export function getImageCache(): InMemoryCache<ImageCacheEntry> {
  if (!imageCacheInstance) {
    imageCacheInstance = new InMemoryCache<ImageCacheEntry>({
      maxEntries: IMAGE_CACHE_MAX_ENTRIES,
      defaultTTL: IMAGE_CACHE_TTL,
    });
  }
  return imageCacheInstance;
}

/**
 * Generate a hash for image URL to use as cache key
 */
export function getImageCacheKey(imageUrl: string): string {
  // Use URL origin + pathname as key (ignore query params)
  try {
    const url = new URL(imageUrl);
    return `img:${url.origin}${url.pathname}`;
  } catch {
    // If URL parsing fails, use the full URL
    return `img:${imageUrl}`;
  }
}

export function getCachedImageAnalysis(imageUrl: string): ImageCacheEntry | null {
  return getImageCache().get(getImageCacheKey(imageUrl));
}

export function setCachedImageAnalysis(
  imageUrl: string,
  description: string,
  isRelated: boolean,
): void {
  getImageCache().set(getImageCacheKey(imageUrl), {
    description,
    isRelated,
    analyzedAt: Date.now(),
  });
}
