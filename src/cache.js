import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { mkdirSync } from 'fs';

/**
 * Cache manager for widget results
 */
export class Cache {
  constructor(statePath) {
    this.statePath = statePath;
    this.cacheDir = statePath ? dirname(statePath) : null;
    this.cachePath = this.cacheDir ? resolve(this.cacheDir, '.cache.json') : null;
  }

  /**
   * Load cache from disk
   */
  load() {
    if (!this.cachePath || !existsSync(this.cachePath)) {
      return {};
    }

    try {
      const content = readFileSync(this.cachePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error loading cache:', error.message);
      return {};
    }
  }

  /**
   * Save cache to disk
   */
  save(cache) {
    if (!this.cachePath) return;

    try {
      const dir = dirname(this.cachePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.cachePath, JSON.stringify(cache, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving cache:', error.message);
    }
  }

  /**
   * Get cached value if still valid
   * @param {string} key - Cache key
   * @param {number} ttl - Time to live in seconds
   * @returns {any|null} - Cached value or null if expired/missing
   */
  get(key, ttl) {
    const cache = this.load();
    const entry = cache[key];

    if (!entry) return null;

    const age = (Date.now() - entry.timestamp) / 1000;
    if (age > ttl) {
      return null; // Expired
    }

    return entry.value;
  }

  /**
   * Set cached value with timestamp
   */
  set(key, value) {
    const cache = this.load();
    cache[key] = {
      value,
      timestamp: Date.now()
    };
    this.save(cache);
  }

  /**
   * Invalidate specific cache key
   */
  invalidate(key) {
    const cache = this.load();
    delete cache[key];
    this.save(cache);
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll() {
    this.save({});
  }

  /**
   * Parse TTL string to seconds
   * Examples: "30s", "5m", "1h", "2d"
   */
  static parseTTL(ttlStr) {
    if (typeof ttlStr === 'number') return ttlStr;
    if (!ttlStr) return 0;

    const match = ttlStr.match(/^(\d+)([smhd])$/);
    if (!match) return 0;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    const multipliers = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400
    };

    return value * (multipliers[unit] || 0);
  }
}
