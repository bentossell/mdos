#!/usr/bin/env bun

import { resolve } from 'path';
import { existsSync } from 'fs';
import { startServer } from './renderer.js';
import { execSync } from 'child_process';

const args = process.argv.slice(2);

// Check if it's an agent command
const agentCommands = ['daemon', 'pending', 'approve', 'reject', 'log', 'search', 'init'];
if (agentCommands.includes(args[0])) {
  // Delegate to daemon-cli
  try {
    execSync(`node ${resolve(import.meta.dirname, 'daemon-cli.js')} ${args.join(' ')}`, {
      stdio: 'inherit'
    });
    process.exit(0);
  } catch (error) {
    process.exit(error.status || 1);
  }
}

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Markdown OS - Agent-native operating system

Usage:
  mdos <file.md> [options]           Serve workspace as web UI
  mdos dev <file.md> [options]       Dev mode with hot reload
  mdos init                          Initialize ~/.mdos structure
  
  mdos daemon start                  Start background agent
  mdos daemon stop                   Stop background agent
  mdos daemon status                 Show daemon status
  mdos daemon run-once               Run daemon once (for cron)
  
  mdos pending                       Show pending actions
  mdos approve <id>                  Approve specific action
  mdos approve --all                 Approve all pending actions
  mdos reject <id>                   Reject specific action
  
  mdos log                           Show recent context
  mdos log --tool <name>             Filter by tool
  mdos log --by <actor>              Filter by actor
  mdos log --since <time>            Filter by time
  mdos search <query>                Search context history

Options:
  --port <number>      Port for web server (default: 3000)
  --config <file>      Config file (default: config.json)
  --help, -h           Show this help

Examples:
  mdos dashboard.md
  mdos dev email.md --config work-config.json
  mdos daemon start
  mdos pending
  mdos approve --all
  mdos log --tool gmail --since 1h

The markdown file should have frontmatter with:
  tools:       Mapping of tool names to CLI paths
  state:       Path to state JSON file (relative to markdown file)
  refresh:     Auto-refresh interval in seconds (optional)
  scripts:     External JavaScript files (optional)
  cache:       Widget cache TTLs (optional, e.g., inbox: 30s)

Action syntax in markdown:
  [Text](#action-name)      - Clickable action link
  [#action-name]: !command  - Action definition
  [widget-name]: !command   - Widget data fetch

Markdown enhancements:
  - [ ] Task               - Checkbox (incomplete)
  - [x] Task               - Checkbox (complete)
  - [!] Task               - Important task
  [[page-name]]            - Wiki link to ?page=page-name
  (2h ago)                 - Inline metadata (auto-styled)

State is available in templates as {{ state.key }}
`);
  process.exit(0);
}

// Check for dev command
let devMode = false;
let mdPath = args[0];

if (args[0] === 'dev') {
  devMode = true;
  mdPath = args[1];
  if (!mdPath) {
    console.error('Error: No markdown file specified for dev mode');
    console.error('Usage: mdos dev <file.md>');
    process.exit(1);
  }
}

// Parse options
const portArg = args.indexOf('--port');
const port = portArg !== -1 ? parseInt(args[portArg + 1], 10) : 3000;

const configArg = args.indexOf('--config');
const config = configArg !== -1 ? args[configArg + 1] : 'config.json';

if (!existsSync(mdPath)) {
  console.error(`Error: File not found: ${mdPath}`);
  process.exit(1);
}

// Start the server
startServer(resolve(mdPath), port, { dev: devMode, config }).catch(error => {
  console.error('Error starting server:', error);
  process.exit(1);
});
