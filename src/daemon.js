import { resolve, dirname } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { Context } from './context.js';
import { Pending } from './pending.js';
import { RuleParser, RuleEvaluator } from './rules.js';
import { executeCommand } from './executor.js';
import { parseMarkdown } from './parser.js';

/**
 * Daemon agent - runs continuously in background
 * Proactive agent that follows rules
 */
export class Daemon {
  constructor(config = {}) {
    this.mdosDir = config.mdosDir || resolve(homedir(), '.mdos');
    this.context = new Context(resolve(this.mdosDir, 'context.json'));
    this.pending = new Pending(resolve(this.mdosDir, 'pending.md'));
    this.ruleParser = new RuleParser();
    this.evaluator = new RuleEvaluator();
    this.config = config;
    this.running = false;
    this.interval = null;
    
    // Load rules
    this.rules = [];
    this.loadRules();
  }

  /**
   * Load all rule files from ~/.mdos/rules/
   */
  loadRules() {
    const rulesDir = resolve(this.mdosDir, 'rules');
    if (!existsSync(rulesDir)) {
      console.log('No rules directory found');
      return;
    }

    // For now, load specific rule files
    // Later can scan directory
    const ruleFiles = ['global.md', 'email.md', 'linear.md', 'calendar.md'];
    
    this.rules = [];
    for (const file of ruleFiles) {
      const path = resolve(rulesDir, file);
      if (existsSync(path)) {
        try {
          const parsed = this.ruleParser.parse(path);
          this.rules.push(...parsed.map(r => ({ ...r, source: file })));
        } catch (error) {
          console.error(`Error parsing ${file}:`, error.message);
        }
      }
    }

    // Sort by priority (higher first)
    this.rules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    console.log(`Loaded ${this.rules.length} rules`);
  }

  /**
   * Start daemon loop
   */
  start(options = {}) {
    if (this.running) {
      console.log('Daemon already running');
      return;
    }

    this.running = true;
    const pollInterval = options.pollInterval || 60000; // Default 60s

    console.log('Daemon starting...');
    console.log(`Poll interval: ${pollInterval}ms`);
    console.log(`Loaded ${this.rules.length} rules`);

    // Run immediately
    this.tick();

    // Then run on interval
    this.interval = setInterval(() => this.tick(), pollInterval);
  }

  /**
   * Stop daemon
   */
  stop() {
    if (!this.running) {
      console.log('Daemon not running');
      return;
    }

    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    console.log('Daemon stopped');
  }

  /**
   * Single evaluation pass
   */
  async tick() {
    console.log(`[${new Date().toISOString()}] Daemon tick`);

    try {
      // Reload rules (hot reload)
      this.loadRules();

      // Get current state from cache/context
      const state = await this.getCurrentState();

      // Evaluate rules against state
      const proposals = this.evaluateRules(state);

      // Add proposals to pending queue
      for (const proposal of proposals) {
        this.pending.add(proposal);
      }

      if (proposals.length > 0) {
        console.log(`Proposed ${proposals.length} actions`);
      }

      // Check pending queue for approved actions
      await this.executeApproved();

    } catch (error) {
      console.error('Daemon tick error:', error);
    }
  }

  /**
   * Get current state from all sources
   */
  async getCurrentState() {
    const state = {
      context: this.context.tail(100),
      workspaces: {}
    };

    // Load workspace states
    const workspacesDir = resolve(this.mdosDir, 'workspaces');
    if (existsSync(workspacesDir)) {
      // For now, just track that workspaces exist
      // Later can load and parse them
    }

    return state;
  }

  /**
   * Evaluate all rules against current state
   */
  evaluateRules(state) {
    const proposals = [];

    for (const rule of this.rules) {
      // For each rule, check if it matches current state
      // This is simplified - real implementation would query actual data
      
      // For now, focus on email rules as per Phase 1
      if (rule.name.toLowerCase().includes('archive')) {
        // Check context for recent emails
        const recentEmails = state.context.filter(e => 
          e.tool === 'gmail' && e.action === 'fetch'
        );

        if (recentEmails.length > 0) {
          // Simplified: propose archiving newsletters
          proposals.push({
            text: `Archive newsletters based on rule: ${rule.name}`,
            metadata: {
              action: rule.action,
              rule: rule.source,
              approval: rule.approval
            }
          });
        }
      }
    }

    return proposals;
  }

  /**
   * Execute approved actions from pending queue
   */
  async executeApproved() {
    const { queued } = this.pending.read();
    
    for (let i = 0; i < queued.length; i++) {
      const action = queued[i];
      
      // Check if action is approved (this would be done externally via mdos approve)
      // For now, we just log that actions are waiting
    }
  }

  /**
   * Execute a specific action
   */
  async executeAction(action) {
    const { metadata } = action;
    
    try {
      // Parse action into CLI command
      const command = this.parseAction(metadata.action);
      
      // Execute command
      const result = await executeCommand(command.cmd, command.tools || {});
      
      // Log to context
      this.context.log({
        tool: command.tool,
        action: command.action,
        target: command.target,
        by: 'daemon',
        meta: { success: result.success }
      });

      return result;
    } catch (error) {
      console.error('Failed to execute action:', error);
      throw error;
    }
  }

  /**
   * Parse action string into executable command
   */
  parseAction(actionStr) {
    // Examples:
    // "archive" -> gmail archive
    // "flag" -> gmail flag
    // "create-task" -> linear create
    
    const parts = actionStr.split('-');
    const verb = parts[0];
    
    return {
      tool: 'gmail', // Default for now
      action: verb,
      cmd: `gmail ${actionStr}`,
      tools: {}
    };
  }

  /**
   * Run daemon once (for cron)
   */
  async runOnce() {
    console.log('Running daemon once...');
    await this.tick();
    console.log('Done');
  }
}
