#!/usr/bin/env node

import { Daemon } from './daemon.js';
import { Context } from './context.js';
import { Pending } from './pending.js';
import { resolve } from 'path';
import { homedir } from 'os';

const mdosDir = resolve(homedir(), '.mdos');
const context = new Context(resolve(mdosDir, 'context.json'));
const pending = new Pending(resolve(mdosDir, 'pending.md'));

const args = process.argv.slice(2);
const command = args[0];
const subcommand = args[1];

import { mkdirSync, writeFileSync, existsSync } from 'fs';

async function handleInit() {
  console.log('Initializing ~/.mdos structure...\n');
  
  const dirs = [
    resolve(mdosDir, 'workspaces'),
    resolve(mdosDir, 'rules'),
    resolve(mdosDir, 'state'),
    resolve(mdosDir, 'cache'),
    resolve(mdosDir, 'logs')
  ];
  
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      console.log(`  ✓ Created ${dir}`);
    } else {
      console.log(`  - ${dir} already exists`);
    }
  }
  
  // Create context.json if doesn't exist
  const contextPath = resolve(mdosDir, 'context.json');
  if (!existsSync(contextPath)) {
    writeFileSync(contextPath, '', 'utf8');
    console.log(`  ✓ Created ${contextPath}`);
  }
  
  // Create pending.md if doesn't exist
  const pendingPath = resolve(mdosDir, 'pending.md');
  if (!existsSync(pendingPath)) {
    const pending = new Pending(pendingPath);
    pending.write({ queued: [], completed: [] });
    console.log(`  ✓ Created ${pendingPath}`);
  }
  
  // Create example rule files if rules directory is empty
  const rulesDir = resolve(mdosDir, 'rules');
  const ruleFiles = ['global.md', 'email.md', 'linear.md', 'calendar.md'];
  let createdRules = false;
  
  for (const file of ruleFiles) {
    const rulePath = resolve(rulesDir, file);
    if (!existsSync(rulePath)) {
      // Copy from templates (for now just note that they should exist)
      console.log(`  ! ${file} not found - copy from examples or create manually`);
      createdRules = true;
    }
  }
  
  console.log('\n✓ Initialization complete!');
  console.log('\nNext steps:');
  console.log('  1. Create rule files in ~/.mdos/rules/');
  console.log('  2. Create workspace files in ~/.mdos/workspaces/');
  console.log('  3. Run: mdos daemon start');
  console.log('  4. Open workspace: mdos ~/.mdos/workspaces/inbox.md');
}

async function main() {
  switch (command) {
    case 'init':
      await handleInit();
      break;
    
    case 'daemon':
      await handleDaemon(subcommand, args.slice(2));
      break;
    
    case 'pending':
      await handlePending(args.slice(1));
      break;
    
    case 'approve':
      await handleApprove(args.slice(1));
      break;
    
    case 'reject':
      await handleReject(args.slice(1));
      break;
    
    case 'log':
      await handleLog(args.slice(1));
      break;
    
    case 'search':
      await handleSearch(args.slice(1));
      break;
    
    default:
      console.log(`Unknown command: ${command}`);
      printHelp();
      break;
  }
}

async function handleDaemon(subcommand, args) {
  const daemon = new Daemon({ mdosDir });

  switch (subcommand) {
    case 'start':
      daemon.start();
      console.log('Daemon started. Press Ctrl+C to stop.');
      // Keep process alive
      process.on('SIGINT', () => {
        daemon.stop();
        process.exit(0);
      });
      break;
    
    case 'stop':
      // TODO: Implement PID file and proper stop
      console.log('Use Ctrl+C to stop daemon');
      break;
    
    case 'status':
      console.log('Status: Not implemented yet');
      // TODO: Check PID file
      break;
    
    case 'logs':
      console.log('Logs: Not implemented yet');
      // TODO: Tail logs
      break;
    
    case 'run-once':
      await daemon.runOnce();
      break;
    
    default:
      console.log(`Unknown daemon command: ${subcommand}`);
      break;
  }
}

async function handlePending(args) {
  const { queued, completed } = pending.read();
  
  console.log('\n# Pending Actions\n');
  
  console.log('## Queued\n');
  if (queued.length === 0) {
    console.log('  No pending actions\n');
  } else {
    queued.forEach((action, i) => {
      console.log(`  ${i}. [ ] ${action.text}`);
      if (action.metadata && Object.keys(action.metadata).length > 0) {
        console.log(`     ${JSON.stringify(action.metadata)}`);
      }
    });
    console.log();
  }
  
  console.log('## Completed today\n');
  if (completed.length === 0) {
    console.log('  Nothing completed yet\n');
  } else {
    completed.forEach(action => {
      console.log(`  [x] ${action.text}`);
    });
    console.log();
  }
}

async function handleApprove(args) {
  const idOrAll = args[0];
  
  if (idOrAll === '--all') {
    const approved = pending.approveAll();
    console.log(`Approved ${approved.length} actions`);
    
    // Execute approved actions
    const daemon = new Daemon({ mdosDir });
    for (const action of approved) {
      try {
        console.log(`Executing: ${action.text}`);
        await daemon.executeAction(action);
        console.log('  ✓ Success');
      } catch (error) {
        console.error('  ✗ Failed:', error.message);
      }
    }
  } else {
    const id = parseInt(idOrAll, 10);
    if (isNaN(id)) {
      console.error('Invalid action ID');
      return;
    }
    
    const action = pending.approve(id);
    console.log(`Approved: ${action.text}`);
    
    // Execute action
    const daemon = new Daemon({ mdosDir });
    try {
      console.log('Executing...');
      await daemon.executeAction(action);
      console.log('✓ Success');
    } catch (error) {
      console.error('✗ Failed:', error.message);
    }
  }
}

async function handleReject(args) {
  const idOrAll = args[0];
  
  if (idOrAll === '--all') {
    pending.rejectAll();
    console.log('Rejected all pending actions');
  } else {
    const id = parseInt(idOrAll, 10);
    if (isNaN(id)) {
      console.error('Invalid action ID');
      return;
    }
    
    const action = pending.reject(id);
    console.log(`Rejected: ${action.text}`);
  }
}

async function handleLog(args) {
  const filters = {};
  
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];
    filters[key] = value;
  }
  
  const entries = filters && Object.keys(filters).length > 0
    ? context.query(filters)
    : context.tail(50);
  
  console.log('\n# Context Log\n');
  
  if (entries.length === 0) {
    console.log('No entries found\n');
  } else {
    entries.forEach(entry => {
      console.log(`[${entry.ts}] ${entry.tool}.${entry.action} (by ${entry.by})`);
      if (entry.target) {
        console.log(`  target: ${entry.target}`);
      }
      if (entry.meta) {
        console.log(`  meta: ${JSON.stringify(entry.meta)}`);
      }
    });
    console.log();
  }
}

async function handleSearch(args) {
  const query = args.join(' ');
  const results = context.search(query);
  
  console.log(`\n# Search results for: "${query}"\n`);
  
  if (results.length === 0) {
    console.log('No results found\n');
  } else {
    results.forEach(entry => {
      console.log(`[${entry.ts}] ${entry.tool}.${entry.action}`);
      console.log(`  ${JSON.stringify(entry)}`);
    });
    console.log();
  }
}

function printHelp() {
  console.log(`
mdos - Agent-native operating system

Commands:
  daemon start             Start daemon agent
  daemon stop              Stop daemon agent
  daemon status            Show daemon status
  daemon logs              Show daemon logs
  daemon run-once          Run daemon once (for cron)
  
  pending                  Show pending actions
  approve <id>             Approve specific action
  approve --all            Approve all pending actions
  reject <id>              Reject specific action
  reject --all             Reject all pending actions
  
  log                      Show recent context
  log --tool <name>        Filter by tool
  log --by <actor>         Filter by actor (user/daemon/command)
  log --since <time>       Filter by time (1h, 30m, etc.)
  
  search <query>           Search context history

Examples:
  mdos daemon start
  mdos pending
  mdos approve 0
  mdos approve --all
  mdos log --tool gmail --since 1h
  mdos search "archive"
`);
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
