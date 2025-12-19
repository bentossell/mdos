# Markdown OS

Declarative UIs from markdown with CLI tools. Your markdown file is both the UI and the capability manifest.

## Quick Start

```bash
npm install
node src/cli.js examples/dashboard.md
```

Open http://localhost:3000

## How It Works

### 1. Frontmatter declares tools and config

```yaml
---
tools:
  email: /usr/local/bin/email-cli
  tasks: ~/.local/bin/tasks-cli
  
state: ./state.json
refresh: 30  # auto-refresh in seconds

scripts:
  - ./scripts/interactions.js  # External JavaScript files
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

These execute on page load and populate template variables.

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

Benefits:
- Markdown stays readable
- JavaScript is reusable
- Easier to maintain and test
- Can be minified/bundled separately

## Styling with Tailwind CSS

The UI uses Tailwind CSS (via CDN). All standard markdown renders beautifully out of the box:

- **Headings** - Sized appropriately with good spacing
- **Code blocks** - Syntax highlighted with gray background
- **Tables** - Bordered and styled
- **Action links** - Blue buttons with hover effects
- **Lists** - Properly spaced and indented

The default theme is clean and modern. Everything is responsive.

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

### State

Loaded from JSON file specified in frontmatter:

```yaml
state: ./state.json
```

Access in templates: `{{ state.key }}`

Actions automatically update `last_action` and `last_action_time`.

### Tool Substitution

Use `[toolname]` in commands to reference declared tools:

```markdown
[#check]: ![email] inbox
```

This runs the `email` tool from your tools declaration.

### External Scripts

Reference JavaScript files in frontmatter:

```yaml
scripts:
  - ./scripts/interactions.js
  - ./scripts/keyboard-shortcuts.js
```

Scripts are loaded at the end of the page. They have access to all rendered content and can call action endpoints via fetch.

## Example Dashboard

See `examples/dashboard.md` for a working example with mock CLI tools.

See `examples/email-clean.md` for an example with external scripts.

## CLI Usage

```bash
mdos <file.md> [options]

Options:
  --port <number>    Port for web server (default: 3000)
  --help, -h         Show help
```

## Features

- ✅ Frontmatter for tool/config declaration
- ✅ Template variables with Liquid syntax
- ✅ Widget data fetches (execute commands on load)
- ✅ Clickable actions (execute commands on click)
- ✅ State persistence (JSON file)
- ✅ Auto-refresh (configurable interval)
- ✅ File watching (changes reload on next request)
- ✅ Clean UI with Tailwind CSS
- ✅ Status notifications with animations
- ✅ External scripts via frontmatter
- ✅ Static file serving (scripts, styles, images)

## Architecture

### Separation of Concerns

**Markdown (`.md`)** - Structure and data
- Frontmatter declares capabilities (tools, scripts, state)
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

## Next Steps

- [ ] Cache TTL in frontmatter
- [ ] CSS file support via frontmatter
- [ ] CLI tool for creating new dashboards
- [ ] Input prompts for dynamic actions (e.g., task title)
- [ ] Agent integration (autopilot mode)
- [ ] Multiple dashboard pages (wiki links)
- [ ] Authentication/secrets management
- [ ] WebSocket for live updates
- [ ] Terminal UI mode (alternative to web)

## Philosophy

**CLI tools are the primitive.** Any program that can be invoked from the command line can be integrated. This makes the system maximally composable and language-agnostic.

**Markdown is the interface.** Both for humans (readable, editable) and agents (parseable, executable). The UI and capability manifest are one and the same.

**State is explicit.** No hidden magic - state lives in a JSON file you can read and modify directly.

**Separation of concerns.** Markdown for structure, JavaScript for interactions, CLI for logic. Each layer is independent and testable.

**Unix philosophy.** Small, focused tools that do one thing well, composed together through a declarative interface.

**Design with Tailwind.** Modern, responsive UI out of the box. Extensible with custom themes.
