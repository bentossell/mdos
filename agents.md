# Agents Guide

## Quick Start

```bash
bun install
bun src/cli.js examples/email.md

# Dev mode with hot reload
bun src/cli.js dev examples/email.md

# With specific config
bun src/cli.js examples/email.md --config work-config.json
```

## One-Line Tests

```bash
# Check if server starts
curl -s http://localhost:3000 | grep -q "Markdown OS" && echo "OK" || echo "FAIL"

# Check email inbox loads
curl -s http://localhost:3000 | grep -q "data-thread-id" && echo "OK" || echo "FAIL"

# Check action endpoint responds
curl -s -X POST http://localhost:3000/action -H "Content-Type: application/json" -d '{"action":"test"}' | grep -q "error\|success" && echo "OK" || echo "FAIL"
```

## Testing with Dev Browser

Use the dev-browser skill for visual testing:

```bash
~/.factory/skills/dev-browser/server.sh &
```

Then run test scripts from `~/.factory/skills/dev-browser/`:

```bash
cd ~/.factory/skills/dev-browser && bun x tsx <<'EOF'
import { connect, waitForPageLoad } from "@/client.js";
const client = await connect();
const page = await client.page("main");
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto("http://localhost:3000");
await waitForPageLoad(page);
await page.screenshot({ path: "tmp/test.png" });
await client.disconnect();
EOF
```

## Server Management

**IMPORTANT:** Always check for running servers before starting new ones to avoid port conflicts.

```bash
# Check if port 3000 is in use
lsof -i :3000

# Kill existing server on port 3000
lsof -ti :3000 | xargs kill 2>/dev/null

# Start fresh server
bun src/cli.js examples/email.md
```

## Project Structure

- `src/cli.js` - Entry point, Express server
- `src/parser.js` - Parses markdown frontmatter and action definitions
- `src/renderer.js` - Renders markdown with Liquid templates
- `src/executor.js` - Executes CLI tools and actions
- `src/state.js` - State persistence
- `cli-tools/` - CLI wrappers (gmail-cli)
- `examples/` - Example markdown apps
- `examples/scripts/` - External JavaScript files for app interactions

## Git Preferences

- **Always create PRs** - Push changes via pull request, never direct to main (unless explicitly asked)
- **Structured PR descriptions** - Use clear sections: What, Why, How
- **Keep it concise** - Not overly verbose, get to the point

## Best Practices

1. **External Scripts** - Keep JavaScript in separate files, reference via frontmatter:
   ```yaml
   scripts:
     - ./scripts/interactions.js
   ```
   Markdown stays readable, JS is reusable and maintainable

2. **Cache Configuration** - Add TTLs to avoid repeated CLI calls:
   ```yaml
   cache:
     inbox: 30s
     tasks: 1m
     metrics: 5m
   ```
   Dramatically improves load times for data that doesn't change frequently

3. **Dev Mode** - Use `mdos dev file.md` for development with hot reload

4. **HTML Output** - Output HTML on single lines to prevent markdown parser treating indented HTML as code blocks

5. **Pattern Actions** - Use wildcards for dynamic IDs: `[#archive-*]: !gmail archive $1`

6. **Markdown Enhancements** - Use built-in syntax:
   - `- [ ]` for checkboxes
   - `(2h ago)` for inline metadata
   - `[[page]]` for wiki links

7. **Multi-Account** - Use separate config files for different accounts/profiles

8. **Environment Variables** - Pass config via env vars (GMAIL_ACCOUNT, GMAIL_LIMIT)

9. **Template Variables** - Access state at root level in Liquid templates: `{{ variable }}` not `{{ state.variable }}`

10. **Event Propagation** - Use `event.stopPropagation()` on nested clickable elements

11. **Port Management** - Default port is 3000, always kill stale servers before starting
