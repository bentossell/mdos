import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { spawn } from 'child_process';
import { Context } from './context.js';
import { Pending } from './pending.js';
import { executeCommand } from './executor.js';

/**
 * Daemon agent - uses droid exec to classify emails based on rules
 */
export class Daemon {
  constructor(config = {}) {
    this.mdosDir = config.mdosDir || resolve(homedir(), '.mdos');
    this.context = new Context(resolve(this.mdosDir, 'context.json'));
    this.pending = new Pending(resolve(this.mdosDir, 'pending.md'));
    this.config = config;
    this.running = false;
    this.interval = null;
    this.model = config.model || 'claude-haiku-4-5-20251001';
    this.rulesPath = resolve(this.mdosDir, 'rules/email.md');
    this.gmailCli = config.gmailCli || resolve(homedir(), 'repos/mdos/cli-tools/gmail-cli');
  }

  /**
   * Get rules content
   */
  getRules() {
    if (!existsSync(this.rulesPath)) {
      return null;
    }
    return readFileSync(this.rulesPath, 'utf8');
  }

  /**
   * Fetch emails using gmail-cli
   */
  async fetchEmails() {
    return new Promise((resolve) => {
      const env = { ...process.env, GMAIL_ACCOUNT: this.config.account || process.env.GMAIL_ACCOUNT };
      const proc = spawn(this.gmailCli, ['inbox', '10'], { env, shell: true });
      
      let stdout = '';
      proc.stdout.on('data', d => stdout += d);
      proc.stderr.on('data', d => console.error(d.toString()));
      
      proc.on('close', () => {
        resolve(stdout.trim());
      });
    });
  }

  /**
   * Ask droid exec to classify emails based on rules
   */
  async classifyEmails(emails, rules) {
    const prompt = `You are an email classifier. Based on the rules below, analyze each email and output a JSON array of actions to take.

RULES:
${rules}

EMAILS:
${emails}

For each email that matches a rule, output an action. Format your response as a JSON array only, no other text:
[
  {"action": "archive", "email": "sender - subject", "rule": "rule name", "approval": "auto|queue"},
  {"action": "label", "label": "labelname", "email": "sender - subject", "rule": "rule name", "approval": "queue"}
]

If no emails match any rules, output: []

Important:
- Only output the JSON array, nothing else
- "approval" should match what the rule specifies (auto or queue)
- For archive rules with a label like ## Name 'labelname', include both archive action and the label`;

    return new Promise((resolve, reject) => {
      const args = ['exec', '-m', this.model, prompt];
      const droid = spawn('droid', args);
      
      let stdout = '';
      let stderr = '';
      
      droid.stdout.on('data', d => stdout += d);
      droid.stderr.on('data', d => stderr += d);
      
      droid.on('close', (code) => {
        if (code === 0) {
          try {
            // Extract JSON from response
            const jsonMatch = stdout.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
              resolve(JSON.parse(jsonMatch[0]));
            } else {
              resolve([]);
            }
          } catch (e) {
            console.error('Failed to parse response:', stdout);
            resolve([]);
          }
        } else {
          console.error('droid exec failed:', stderr);
          resolve([]);
        }
      });
    });
  }

  /**
   * Single evaluation pass
   */
  async tick() {
    console.log(`[${new Date().toISOString()}] Daemon tick`);

    try {
      const rules = this.getRules();
      if (!rules) {
        console.log('No rules file found');
        return;
      }

      const emails = await this.fetchEmails();
      if (!emails) {
        console.log('No emails fetched');
        return;
      }

      console.log('Classifying emails with droid exec...');
      const actions = await this.classifyEmails(emails, rules);
      
      if (actions.length === 0) {
        console.log('No actions proposed');
        return;
      }

      console.log(`Proposed ${actions.length} actions`);

      for (const action of actions) {
        if (action.approval === 'auto') {
          // Auto-execute
          console.log(`Auto: ${action.action} - ${action.email}`);
          this.context.log({
            tool: 'gmail',
            action: action.action,
            target: action.email,
            by: 'daemon',
            meta: { rule: action.rule, label: action.label }
          });
        } else {
          // Add to pending queue
          const text = action.label 
            ? `Label "${action.email}" as "${action.label}"`
            : `${action.action.charAt(0).toUpperCase() + action.action.slice(1)} - ${action.email}`;
          
          this.pending.add({
            text,
            metadata: {
              action: action.action,
              label: action.label,
              rule: action.rule,
              approval: action.approval
            }
          });
        }
      }

    } catch (error) {
      console.error('Daemon tick error:', error);
    }
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
    const pollInterval = options.pollInterval || 60000;

    console.log('Daemon starting...');
    console.log(`Poll interval: ${pollInterval}ms`);
    console.log(`Rules: ${this.rulesPath}`);

    this.tick();
    this.interval = setInterval(() => this.tick(), pollInterval);
  }

  /**
   * Stop daemon
   */
  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log('Daemon stopped');
  }

  /**
   * Run once (for testing/cron)
   */
  async runOnce() {
    console.log('Running daemon once...');
    await this.tick();
    console.log('Done');
  }
}
