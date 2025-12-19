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

## Example Dashboard

See `examples/dashboard.md` for a working example with mock CLI tools.

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
- ✅ Clean UI with status notifications

## Next Steps

- [ ] CLI tool for creating new dashboards
- [ ] Input prompts for dynamic actions (e.g., task title)
- [ ] Agent integration (autopilot mode)
- [ ] Multiple dashboard pages
- [ ] Authentication/secrets management
- [ ] WebSocket for live updates
- [ ] Terminal UI mode (alternative to web)

## Philosophy

**CLI tools are the primitive.** Any program that can be invoked from the command line can be integrated. This makes the system maximally composable and language-agnostic.

**Markdown is the interface.** Both for humans (readable, editable) and agents (parseable, executable). The UI and capability manifest are one and the same.

**State is explicit.** No hidden magic - state lives in a JSON file you can read and modify directly.

**Unix philosophy.** Small, focused tools that do one thing well, composed together through a declarative interface.
