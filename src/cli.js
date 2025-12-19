#!/usr/bin/env bun

import { resolve } from 'path';
import { existsSync } from 'fs';
import { startServer } from './renderer.js';

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Markdown OS - Declarative UIs from markdown with CLI tools

Usage:
  mdos <file.md> [options]
  mdos dev <file.md> [options]    Dev mode with hot reload

Options:
  --port <number>      Port for web server (default: 3000)
  --config <file>      Config file (default: config.json)
  --help, -h           Show this help

Examples:
  mdos dashboard.md
  mdos dashboard.md --port 8080
  mdos dev email.md --config work-config.json
  mdos dashboard.md --config personal-config.json

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
