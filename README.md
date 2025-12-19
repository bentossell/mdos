# Markdown OS

Declarative UIs from markdown with CLI tools. Your markdown file is both the UI and the capability manifest.

## Quick Start

```bash
npm install
node src/cli.js examples/dashboard.md

# Dev mode with hot reload
node src/cli.js dev examples/dashboard.md
```

Open http://localhost:3000

## Features

### Core
- ✅ Frontmatter for tool/config declaration
- ✅ Template variables with Liquid syntax
- ✅ Widget data fetches (execute commands on load)
- ✅ Clickable actions (execute commands on click)
- ✅ State persistence (JSON file)
- ✅ External scripts via frontmatter
- ✅ Static file serving (scripts, styles, images)

### Performance
- ✅ **Cache TTL** - Avoid repeated CLI calls with configurable cache
- ✅ **Lazy widget loading** - Conditional rendering (only load what's used)
- ✅ **Preload on hover** - Prefetch next page when hovering links

### Developer Experience
- ✅ **Hot reload** - Auto-refresh browser in dev mode
- ✅ **Better error messages** - See which CLI command failed and why
- ✅ **Dev mode** - `mdos dev file.md` with verbose logging and WebSocket reload

### Markdown Enhancements
- ✅ **Auto-style lists** - Detect patterns and render as cards/checkboxes
- ✅ **Checkboxes** - `- [ ]` incomplete, `- [x]` complete, `- [!]` important
- ✅ **Inline metadata** - `(2h ago)` auto-styled as muted text
- ✅ **Wiki links** - `[[page-name]]` or `[[page|Display]]` for multi-page

### Multi-Account
- ✅ **Config file support** - Switch between accounts/configs
- ✅ **Multiple profiles** - `--config work.json` or `--config personal.json`

## How It Works

### 1. Frontmatter declares tools and config

```yaml
---
tools:
  email: /usr/local/bin/email-cli
  tasks: ~/.local/bin/tasks-cli
  
state: ./state.json

scripts:
  - ./scripts/interactions.js

cache:
  inbox: 30s        # Cache for 30 seconds
  tasks: 1m         # Cache for 1 minute
  metrics: 5m       # Cache for 5 minutes
---
```

### 2. Markdown body is the UI

```markdown
# My Dashboard

You have **{{ email_count }}** unread emails

{{ inbox_list }}

[Mark All Read](#mark-all-read)
```

### 3. Widget definitions fetch data

```markdown
[email_count]: !email count
[inbox_list]: !email inbox
```

These execute on page load and populate template variables. Results are cached based on frontmatter `cache` TTLs.

### 4. Action definitions run on click

```markdown
[#mark-all-read]: !email mark-all-read
```

Click a link like `[Text](#mark-all-read)` to execute the command.

### 5. State persists between actions

State is stored in JSON and available as `{{ state.key }}` in templates.

### 6. External scripts for interactions

Keep JavaScript separate from markdown for cleaner separation:

**Markdown file:**
```yaml
---
scripts:
  - ./scripts/email-interactions.js
---

<div id="inbox">{{ inbox }}</div>
```

**JavaScript file:**
```javascript
// scripts/email-interactions.js
function archiveEmail(id) {
  fetch('/action', {
    method: 'POST',
    body: JSON.stringify({ action: 'archive-' + id })
  });
}
```

## Performance: Caching

Add `cache` to frontmatter to avoid repeated CLI calls:

```yaml
cache:
  inbox: 30s      # Seconds
  tasks: 5m       # Minutes
  metrics: 1h     # Hours
  reports: 1d     # Days
```

Cached results are stored in `.cache.json` next to your state file. Cache is invalidated on write actions.

## Markdown Enhancements

### Checkboxes

```markdown
- [ ] Incomplete task
- [x] Completed task
- [!] Important/urgent task
```

Auto-styled with colors and icons.

### Lists with Actions

```markdown
- Email from Sarah (2h ago) [Archive](#archive-1) [Reply](#reply-1)
```

Renders as a card with inline metadata and action buttons.

### Wiki Links

```markdown
[[inbox]]                  -> Links to ?page=inbox
[[settings|My Settings]]   -> Links to ?page=settings with custom text
```

## Multi-Account Support

Create multiple config files:

**work-config.json:**
```json
{
  "accounts": [
    { "email": "you@work.com", "label": "Work" }
  ],
  "defaults": { "limit": 20 }
}
```

**personal-config.json:**
```json
{
  "accounts": [
    { "email": "you@gmail.com", "label": "Personal" }
  ],
  "defaults": { "limit": 10 }
}
```

Use with:
```bash
mdos email.md --config work-config.json
mdos email.md --config personal-config.json
```

## CLI Usage

```bash
mdos <file.md> [options]
mdos dev <file.md> [options]    # Dev mode with hot reload

Options:
  --port <number>      Port for web server (default: 3000)
  --config <file>      Config file (default: config.json)
  --help, -h           Show help

Examples:
  mdos dashboard.md
  mdos dashboard.md --port 8080
  mdos dev email.md --config work-config.json
```

## Dev Mode

Enable hot reload and better error messages:

```bash
mdos dev dashboard.md
```

Changes to markdown file automatically reload the browser via WebSocket. No page refresh needed.

## Syntax Reference

### Tool Declarations

Frontmatter maps tool names to CLI paths:

```yaml
tools:
  email: /path/to/email-cli
  github: gh
```

### Widget Data Fetches

Execute on page load, results available as template variables:

```markdown
[widget_name]: !command args
```

Use in templates: `{{ widget_name }}`

### Actions

Execute when user clicks a link:

```markdown
[#action-name]: !command args
```

Link to it: `[Click Me](#action-name)`

Pattern matching with wildcards:

```markdown
[#archive-*]: !gmail archive $1
```

Links like `[Archive](#archive-ABC123)` will execute `gmail archive ABC123`.

### State

Loaded from JSON file specified in frontmatter:

```yaml
state: ./state.json
```

Access in templates: `{{ state.key }}`

Actions automatically update `last_action` and `last_action_time`.

### External Scripts

Reference JavaScript files in frontmatter:

```yaml
scripts:
  - ./scripts/interactions.js
  - ./scripts/keyboard-shortcuts.js
```

Scripts are loaded at the end of the page. They have access to all rendered content and can call action endpoints via fetch.

### Cache Configuration

Set TTLs for widget results:

```yaml
cache:
  widget1: 30s    # 30 seconds
  widget2: 5m     # 5 minutes
  widget3: 1h     # 1 hour
  widget4: 2d     # 2 days
```

## Example Dashboards

- `examples/dashboard.md` - Basic dashboard with mock CLI tools
- `examples/dashboard-cached.md` - Dashboard with caching enabled
- `examples/email-clean.md` - Email app with external scripts
- `examples/enhanced.md` - Showcase of markdown enhancements

## Architecture

### Separation of Concerns

**Markdown (`.md`)** - Structure and data
- Frontmatter declares capabilities (tools, scripts, state, cache)
- Body defines layout and content
- Widget/action definitions map to CLI commands

**JavaScript (`.js`)** - Interactions and enhancements
- Event handlers (click, keyboard, etc.)
- AJAX calls to action endpoints
- UI updates and animations
- Progressive enhancement only

**CLI Tools** - Business logic and data
- Fetch data from APIs, databases, filesystems
- Execute actions (send email, create issue, etc.)
- Any language, any platform
- Composable via Unix pipes

This keeps each layer focused and testable.

### Caching Strategy

1. Widget results are cached with configurable TTLs
2. Cache is stored in `.cache.json` next to state file
3. Cache is checked before executing CLI commands
4. Write actions invalidate all cache
5. Expired cache entries are ignored

This dramatically improves load times for data that doesn't change frequently.

## Philosophy

**CLI tools are the primitive.** Any program that can be invoked from the command line can be integrated. This makes the system maximally composable and language-agnostic.

**Markdown is the interface.** Both for humans (readable, editable) and agents (parseable, executable). The UI and capability manifest are one and the same.

**State is explicit.** No hidden magic - state lives in a JSON file you can read and modify directly.

**Separation of concerns.** Markdown for structure, JavaScript for interactions, CLI for logic. Each layer is independent and testable.

**Cache aggressively.** Avoid redundant work. Most data doesn't need real-time updates.

**Unix philosophy.** Small, focused tools that do one thing well, composed together through a declarative interface.

**Design with Tailwind.** Modern, responsive UI out of the box. Extensible with custom themes.
