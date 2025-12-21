import { existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * Context manager - append-only action log
 * Shared memory between user and agents
 */
export class Context {
  constructor(path) {
    this.path = path;
    this.ensureFile();
  }

  ensureFile() {
    const dir = dirname(this.path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    if (!existsSync(this.path)) {
      writeFileSync(this.path, '', 'utf8');
    }
  }

  /**
   * Log an action to context
   * @param {Object} entry - Action entry
   * @param {string} entry.tool - Which CLI tool
   * @param {string} entry.action - What happened (archive, view, create, etc.)
   * @param {string} entry.target - Resource ID
   * @param {string} entry.by - Who did it: user, daemon, command
   * @param {Object} entry.meta - Optional additional context
   */
  log(entry) {
    const record = {
      ts: new Date().toISOString(),
      tool: entry.tool,
      action: entry.action,
      target: entry.target || null,
      by: entry.by,
      meta: entry.meta || null
    };

    appendFileSync(this.path, JSON.stringify(record) + '\n', 'utf8');
    return record;
  }

  /**
   * Read all context entries
   */
  readAll() {
    if (!existsSync(this.path)) return [];
    
    const content = readFileSync(this.path, 'utf8');
    if (!content.trim()) return [];
    
    return content
      .trim()
      .split('\n')
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          console.error('Failed to parse context line:', line);
          return null;
        }
      })
      .filter(Boolean);
  }

  /**
   * Query context with filters
   * @param {Object} filters
   * @param {string} filters.tool - Filter by tool name
   * @param {string} filters.by - Filter by actor (user, daemon, command)
   * @param {string} filters.since - Filter by time (ISO string or duration like "1h")
   * @param {string} filters.action - Filter by action type
   */
  query(filters = {}) {
    let entries = this.readAll();

    if (filters.tool) {
      entries = entries.filter(e => e.tool === filters.tool);
    }

    if (filters.by) {
      entries = entries.filter(e => e.by === filters.by);
    }

    if (filters.action) {
      entries = entries.filter(e => e.action === filters.action);
    }

    if (filters.since) {
      const cutoff = this.parseTimestamp(filters.since);
      entries = entries.filter(e => new Date(e.ts) >= cutoff);
    }

    return entries;
  }

  /**
   * Parse timestamp or duration string
   */
  parseTimestamp(str) {
    // If it's an ISO timestamp, parse directly
    if (str.includes('T') || str.includes('-')) {
      return new Date(str);
    }

    // Parse duration like "1h", "30m", "2d"
    const match = str.match(/^(\d+)([smhd])$/);
    if (!match) return new Date(0);

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const now = Date.now();

    const multipliers = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000
    };

    return new Date(now - value * (multipliers[unit] || 0));
  }

  /**
   * Search context for text
   */
  search(query) {
    return this.readAll().filter(entry => {
      const str = JSON.stringify(entry).toLowerCase();
      return str.includes(query.toLowerCase());
    });
  }

  /**
   * Get recent entries (last N)
   */
  tail(n = 50) {
    const entries = this.readAll();
    return entries.slice(-n);
  }
}
