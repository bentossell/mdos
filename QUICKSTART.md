# Quick Start: Agent System

Get your AI agent running in 5 minutes.

## Step 1: Initialize

```bash
mdos init
```

This creates `~/.mdos` with all necessary directories.

## Step 2: Create Rules

Create `~/.mdos/rules/email.md`:

```markdown
# Email Rules

## Auto-archive newsletters
Conditions:
- sender contains "newsletter"
- subject contains "unsubscribe"
Action: archive
Approval: auto
Priority: 10

## Never touch starred
Conditions:
- starred is true
Action: skip
Approval: auto
Priority: 100
```

## Step 3: Create Workspace

Create `~/.mdos/workspaces/inbox.md`:

```yaml
---
tools:
  gmail: gmail-cli

rules: [email.md]

cache:
  inbox: 30s
---

# Inbox

{{ inbox }}

[inbox]: !gmail inbox --limit 20
```

## Step 4: Start Daemon

```bash
mdos daemon start
```

Daemon runs every 60 seconds, evaluating rules.

## Step 5: Check Pending

```bash
mdos pending
```

You'll see proposed actions like:

```
## Queued
  0. [ ] Archive 5 newsletters
```

## Step 6: Approve

```bash
mdos approve 0       # Approve specific action
# or
mdos approve --all   # Approve everything
```

## Step 7: View UI

```bash
mdos ~/.mdos/workspaces/inbox.md
```

Open http://localhost:3000 to see your inbox.

## What Just Happened?

1. **Daemon** read your inbox via gmail-cli
2. **Evaluated** email.md rules
3. **Proposed** archiving newsletters
4. **You approved** the actions
5. **Daemon executed** the CLI commands
6. **Logged** everything to context.json

## View History

```bash
mdos log                    # Recent actions
mdos log --tool gmail       # Gmail only
mdos log --since 1h         # Last hour
mdos search "archive"       # Search for keyword
```

## Add More Tools

Edit your workspace to add Linear:

```yaml
---
tools:
  gmail: gmail-cli
  linear: linear-cli

rules: [email.md, linear.md]
---
```

Create `~/.mdos/rules/linear.md` with Linear-specific automation.

## Next Steps

- Read [AGENT_SYSTEM.md](./AGENT_SYSTEM.md) for full documentation
- See [examples/](./examples/) for more workspace examples
- Customize rules in `~/.mdos/rules/`
- Add more workspaces in `~/.mdos/workspaces/`

## Tips

- Start with `Approval: queue` for all rules
- Use `Priority` to control evaluation order (higher = first)
- Monitor with `mdos log` to see what daemon does
- Use `mdos daemon run-once` to test without continuous loop
