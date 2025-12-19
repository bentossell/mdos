#!/bin/bash

echo "🚀 Markdown OS Demo"
echo ""
echo "Starting server on port 3000..."
echo ""
echo "Examples:"
echo "  Simple:     http://localhost:3000  (examples/simple.md)"
echo "  Dashboard:  change to dashboard.md in command below"
echo ""
echo "Press Ctrl+C to stop"
echo ""

node src/cli.js examples/simple.md
