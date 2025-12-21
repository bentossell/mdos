import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * Pending actions queue manager
 * Daemon proposes actions here, user approves by checking boxes
 */
export class Pending {
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
      this.write([]);
    }
  }

  /**
   * Read pending actions
   */
  read() {
    if (!existsSync(this.path)) return { queued: [], completed: [] };

    const content = readFileSync(this.path, 'utf8');
    const actions = this.parse(content);
    return actions;
  }

  /**
   * Parse pending.md format
   */
  parse(content) {
    const queued = [];
    const completed = [];
    
    const lines = content.split('\n');
    let inQueued = false;
    let inCompleted = false;

    for (const line of lines) {
      if (line.includes('## Queued')) {
        inQueued = true;
        inCompleted = false;
        continue;
      }
      if (line.includes('## Completed')) {
        inQueued = false;
        inCompleted = true;
        continue;
      }

      // Parse checkbox items
      const match = line.match(/^- \[([ x])\] (.+?)(?:<!--(.+?)-->)?$/);
      if (match) {
        const [, checked, text, metadata] = match;
        const action = {
          checked: checked === 'x',
          text: text.trim(),
          metadata: metadata ? this.parseMetadata(metadata.trim()) : {}
        };

        if (inQueued && !action.checked) {
          action.id = queued.length;
          queued.push(action);
        } else if (inCompleted || action.checked) {
          completed.push(action);
        }
      }
    }

    return { queued, completed };
  }

  /**
   * Parse metadata from HTML comment
   */
  parseMetadata(str) {
    const meta = {};
    const parts = str.split(/\s+/);
    
    for (const part of parts) {
      const [key, value] = part.split(':');
      if (key && value) {
        meta[key] = value;
      }
    }
    
    return meta;
  }

  /**
   * Write pending actions to file
   */
  write(actions) {
    const { queued = [], completed = [] } = actions;
    
    let content = '# Pending Actions\n\n';
    
    content += '## Queued\n';
    if (queued.length === 0) {
      content += '_No pending actions_\n';
    } else {
      for (const action of queued) {
        const meta = this.serializeMetadata(action.metadata);
        const metaStr = meta ? ` <!-- ${meta} -->` : '';
        content += `- [ ] ${action.text}${metaStr}\n`;
      }
    }
    
    content += '\n## Completed today\n';
    if (completed.length === 0) {
      content += '_Nothing completed yet_\n';
    } else {
      for (const action of completed) {
        content += `- [x] ${action.text}\n`;
      }
    }

    writeFileSync(this.path, content, 'utf8');
  }

  /**
   * Serialize metadata to HTML comment format
   */
  serializeMetadata(meta) {
    if (!meta || Object.keys(meta).length === 0) return '';
    return Object.entries(meta)
      .map(([k, v]) => `${k}:${v}`)
      .join(' ');
  }

  /**
   * Add action to queue
   */
  add(action) {
    const current = this.read();
    current.queued.push({
      text: action.text,
      metadata: action.metadata || {}
    });
    this.write(current);
  }

  /**
   * Approve action by ID
   */
  approve(id) {
    const current = this.read();
    if (id < 0 || id >= current.queued.length) {
      throw new Error(`Invalid action ID: ${id}`);
    }

    const action = current.queued[id];
    current.queued.splice(id, 1);
    current.completed.push(action);
    this.write(current);

    return action;
  }

  /**
   * Approve all queued actions
   */
  approveAll() {
    const current = this.read();
    const approved = [...current.queued];
    current.completed.push(...approved);
    current.queued = [];
    this.write(current);
    return approved;
  }

  /**
   * Reject action by ID
   */
  reject(id) {
    const current = this.read();
    if (id < 0 || id >= current.queued.length) {
      throw new Error(`Invalid action ID: ${id}`);
    }

    const action = current.queued[id];
    current.queued.splice(id, 1);
    this.write(current);
    return action;
  }

  /**
   * Clear all queued actions
   */
  rejectAll() {
    const current = this.read();
    current.queued = [];
    this.write(current);
  }

  /**
   * Get count of pending actions
   */
  count() {
    const current = this.read();
    return current.queued.length;
  }
}
