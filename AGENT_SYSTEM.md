# Agent System Documentation

## Overview

mdos includes a built-in agent system that can autonomously manage your digital life. The agent reads your markdown files, follows rules you define, and takes actions on your behalf.

## Architecture

```
~/.mdos/
├── workspaces/           # UI views (what you see)
│   ├── inbox.md
│   ├── tasks.md
│   └── calendar.md
├── rules/                # Agent policies (what agent does)
│   ├── global.md
│   ├── email.md
│   ├── linear.md
│   └── calendar.md
├── context.json          # Append-only action log
├── pending.md            # Agent-proposed actions queue
└── config.yaml           # Global settings
```

## Core Components

### 1. Context (context.json)

Append-only log of all actions across all tools. Shared memory between you and your agents.

**Format:**
```json
{"ts": "2024-12-20T09:14:00Z", "tool": "gmail", "action": "archive", "target": "msg_123", "by": "daemon"}
{"ts": "2024-12-20T09:15:00Z", "tool": "linear", "action": "view", "target": "issue_456", "by": "user"}
```

**Fields:**
- `ts` - ISO timestamp
- `tool` - Which CLI tool (gmail, linear, gh, etc.)
- `action` - What happened (archive, view, create, delete, etc.)
- `target` - Resource ID
- `by` - Who did it: `user`, `daemon`, `command`
- `meta` - Optional additional context

### 2. Pending Queue (pending.md)

Approval queue where daemon proposes actions and you review them.

**Format:**
```markdown
# Pending Actions

## Queued
- [ ] Archive 12 newsletters <!-- action:archive ids:msg_1,msg_2 rule:email.md:auto-archive -->
- [ ] Flag email from sarah@sequoia.com as urgent <!-- action:flag id:msg_45 rule:email.md:flag-urgent -->

## Completed today
- [x] Archived 8 newsletters (9:00am)
- [x] Refreshed inbox cache (9:15am)
```

### 3. Rule Files

Policies that define agent behavior. Human-readable, machine-parseable.

**Format:**
```markdown
# Email Rules

## Auto-archive newsletters
Conditions:
- sender contains "newsletter"
- subject contains "unsubscribe"
Action: archive
Approval: auto
Priority: 10
```

**Supported condition types:**
- `contains` - Text matching
- `domain in [list]` - Domain matching with wildcards
- `in [list]` - List membership
- `compare` - Numeric/date comparison (>, <, =, etc.)
- `or` - Multiple conditions (any match)

### 4. Workspace Files

The UI layer - what you see and interact with.

**Format:**
```yaml
---
tools:
  gmail: gmail-cli
rules: [global.md, email.md]
state: ./state/inbox.json
cache:
  inbox: 30s
---

# Inbox
{{ inbox }}

[inbox]: !gmail inbox
```

Workspaces declare which rules apply to them.

## Usage

### Initialize

```bash
mdos init
```

Creates `~/.mdos` structure with all necessary directories.

### Start Daemon

```bash
mdos daemon start
```

Runs in background, evaluating rules and proposing actions.

### View Pending Actions

```bash
mdos pending
```

Shows queued actions waiting for approval.

### Approve Actions

```bash
mdos approve 0        # Approve specific action by ID
mdos approve --all    # Approve all queued actions
```

### Reject Actions

```bash
mdos reject 0         # Reject specific action
mdos reject --all     # Clear queue
```

### View Context Log

```bash
mdos log                          # Show recent actions
mdos log --tool gmail             # Filter by tool
mdos log --by daemon              # Filter by actor
mdos log --since 1h               # Filter by time
```

### Search History

```bash
mdos search "archive"             # Search for keyword
```

### Run Once (for cron)

```bash
mdos daemon run-once
```

Runs single evaluation pass, useful for cron jobs.

## Rule Writing Guide

### Basic Structure

```markdown
# Rule File Name

## Rule Name
Conditions:
- field operator value
- another condition
Action: what-to-do
Approval: auto|queue
Priority: 10
```

### Condition Examples

```markdown
# Text matching
- sender contains "newsletter"
- subject contains "urgent" or "asap"

# Domain matching
- sender domain in [marketing.*, promo.*]

# List membership
- sender in [sarah@factory.ai, ben@example.com]

# Comparisons
- age > 24h
- priority = high
- unread_count < 10

# Complex (or)
- subject contains "urgent" or "asap" or "critical"
```

### Action Types

Actions are tool-specific commands:
- `archive` - Archive items
- `flag` - Flag/star items
- `create-task` - Create task/issue
- `draft-reply` - Draft email reply
- `skip` - Skip processing (used in "never touch" rules)

### Approval Modes

- `auto` - Execute immediately, no approval needed
- `queue` - Add to pending queue, wait for user approval

### Priority

Higher priority rules (larger numbers) are evaluated first. Use this to ensure "never touch" rules run before "auto-archive" rules.

```markdown
## Never touch starred
Conditions:
- starred is true
Action: skip
Approval: auto
Priority: 100        # High priority to run first
```

## Example Workflows

### Email Management

**Goal:** Archive newsletters automatically, flag urgent emails, never touch starred messages.

**Rules (email.md):**
```markdown
## Never touch starred
Conditions:
- starred is true
Action: skip
Approval: auto
Priority: 100

## Auto-archive newsletters
Conditions:
- sender contains "newsletter"
- subject contains "unsubscribe"
Action: archive
Approval: auto
Priority: 10

## Flag urgent
Conditions:
- subject contains "urgent" or "asap"
Action: flag
Approval: queue
Priority: 20
```

**Workflow:**
1. Daemon runs every 5 minutes
2. Checks inbox via gmail-cli
3. Evaluates rules (high priority first)
4. Auto-archives newsletters
5. Queues urgent flagging for approval
6. You approve via `mdos approve --all`

### Task Management

**Goal:** Auto-link Linear issues to projects, create prep tasks for meetings.

**Rules (linear.md):**
```markdown
## Auto-link to projects
Conditions:
- issue created
- title contains project keyword
Action: link-to-project
Approval: auto
Priority: 10
```

**Rules (calendar.md):**
```markdown
## Create prep tasks
Conditions:
- event type is meeting
- attendees > 2
- time in next 24h
Action: create-prep-task
Approval: queue
Priority: 20
```

## Configuration

**~/.mdos/config.yaml:**
```yaml
daemon:
  poll_interval: 60s       # How often to check
  cache_refresh: 5m        # How often to refresh caches
  max_pending: 10          # Max queued actions before pause
  quiet_hours: [22:00, 07:00]  # Don't run during these hours

tools:
  gmail: /usr/local/bin/gmail-cli
  linear: ~/.local/bin/linear-cli
  gh: gh

accounts:
  email:
    - address: you@gmail.com
      label: Personal
  linear:
    - workspace: factory
      label: Work
```

## Best Practices

### 1. Start with Queue-only

All rules should use `Approval: queue` initially. Once you trust them, switch to `auto`.

### 2. Use Priority Wisely

- 100+ : Never touch / safety rules
- 50-99 : Important actions
- 10-49 : Normal automation
- 1-9   : Low priority / experimental

### 3. Test with Dry Runs

```bash
mdos daemon run-once
# Check pending queue
mdos pending
# If it looks good, approve
mdos approve --all
```

### 4. Monitor Context

```bash
mdos log --since 1h
```

Review what the daemon did. If something's wrong, adjust rules.

### 5. Layer Rules

Use global.md for universal policies, specific files for tool-specific rules:

```yaml
# inbox.md frontmatter
rules: [global.md, email.md]
```

## Troubleshooting

### Daemon not proposing actions

- Check if rules are loaded: `mdos daemon run-once` shows loaded count
- Verify rule syntax: Parse errors are logged
- Check if data is available: Rules need data to evaluate

### Actions not executing

- Check pending queue: `mdos pending`
- Approve manually: `mdos approve 0`
- Check context log: `mdos log` for errors

### Too many pending actions

- Adjust `max_pending` in config.yaml
- Review rules - some might be too broad
- Use `auto` approval for trusted rules

### Rules not matching

- Test condition logic manually
- Check field names match data structure
- Use search to find similar actions: `mdos search "keyword"`

## Advanced: Command Agent (Coming Soon)

Natural language commands that execute immediately:

```bash
mdos do "draft a reply to Sarah's email"
mdos do "create Linear issue from meeting notes"
mdos do "archive all read emails from last week"
```

The command agent:
- Reads context for relevant history
- Interprets natural language
- Chains multiple tools if needed
- Executes or queues based on action type

## Roadmap

**Phase 1 (Complete):**
- ✅ Context logging
- ✅ Pending queue
- ✅ Rule parsing and evaluation
- ✅ Daemon loop
- ✅ CLI commands

**Phase 2 (Next):**
- [ ] Better rule engine (more condition types)
- [ ] Multiple tools support
- [ ] Smarter evaluation (fetch real data)
- [ ] Better action execution

**Phase 3 (Future):**
- [ ] Command agent (natural language)
- [ ] LLM integration for complex rules
- [ ] Reactive mode (respond to file changes)
- [ ] Multi-tool orchestration

**Phase 4 (Polish):**
- [ ] Error handling and recovery
- [ ] Rate limiting
- [ ] Quiet hours / focus mode
- [ ] Rule validation and linting
- [ ] Example templates
