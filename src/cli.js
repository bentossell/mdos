#!/usr/bin/env node

import { resolve } from 'path';
import { existsSync } from 'fs';
import { startServer } from './renderer.js';

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Markdown OS - Declarative UIs from markdown with CLI tools

Usage:
  mdos <file.md> [options]

Options:
  --port <number>    Port for web server (default: 3000)
  --help, -h         Show this help

Example:
  mdos dashboard.md
  mdos dashboard.md --port 8080

The markdown file should have frontmatter with:
  tools:       Mapping of tool names to CLI paths
  state:       Path to state JSON file (relative to markdown file)
  refresh:     Auto-refresh interval in seconds (optional)

Action syntax in markdown:
  [Text](#action-name)      - Clickable action link
  [#action-name]: !command  - Action definition
  [widget-name]: !command   - Widget data fetch

State is available in templates as {{ state.key }}
`);
  process.exit(0);
}

const mdPath = args[0];
const portArg = args.indexOf('--port');
const port = portArg !== -1 ? parseInt(args[portArg + 1], 10) : 3000;

if (!existsSync(mdPath)) {
  console.error(`Error: File not found: ${mdPath}`);
  process.exit(1);
}

// Start the server
startServer(resolve(mdPath), port).catch(error => {
  console.error('Error starting server:', error);
  process.exit(1);
});
