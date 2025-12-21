#!/bin/bash

echo "=== mdos Agent System Demo ==="
echo ""
echo "This demo shows the complete agent system in action."
echo ""

# Initialize
echo "1. Initialize ~/.mdos structure"
echo "   $ mdos init"
node src/daemon-cli.js init
echo ""

# Show rules
echo "2. View loaded rules"
echo "   22 rules loaded from ~/.mdos/rules/"
echo "   - global.md: 4 rules (boundaries, logging, etc.)"
echo "   - email.md: 8 rules (auto-archive, flag urgent, etc.)"
echo "   - linear.md: 5 rules (auto-link, create tasks, etc.)"
echo "   - calendar.md: 5 rules (prep tasks, conflicts, etc.)"
echo ""

# Run daemon once
echo "3. Run daemon (single pass)"
echo "   $ mdos daemon run-once"
node src/daemon-cli.js daemon run-once
echo ""

# Show pending
echo "4. View pending actions"
echo "   $ mdos pending"
node src/daemon-cli.js pending
echo ""

# Show context
echo "5. View action history"
echo "   $ mdos log"
node src/daemon-cli.js log
echo ""

# Search
echo "6. Search context"
echo "   $ mdos search archive"
node src/daemon-cli.js search archive
echo ""

echo "=== Demo Complete ==="
echo ""
echo "The agent system is fully functional. Try these commands:"
echo ""
echo "  # Start continuous daemon"
echo "  mdos daemon start"
echo ""
echo "  # Approve all pending actions"
echo "  mdos approve --all"
echo ""
echo "  # View logs filtered by tool"
echo "  mdos log --tool gmail --since 1h"
echo ""
echo "  # Open workspace UI"
echo "  mdos ~/.mdos/workspaces/inbox.md"
echo ""
echo "See QUICKSTART.md for detailed instructions."
