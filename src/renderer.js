import { marked } from 'marked';
import express from 'express';
import { watch } from 'chokidar';
import { resolve, dirname } from 'path';
import { parseMarkdown, extractActions, extractActionLinks, renderTemplate, cleanBody } from './parser.js';
import { loadState, saveState, mergeWidgetResults } from './state.js';
import { executeWidgets, executeAction } from './executor.js';

/**
 * Start web server for markdown OS
 */
export async function startServer(mdPath, port = 3000) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  const mdDir = dirname(resolve(mdPath));
  let currentState = {};
  let parsed = null;
  let actionsMap = {};
  let widgetsMap = {};
  
  // Parse and render the markdown
  async function render() {
    parsed = parseMarkdown(resolve(mdPath));
    const { actions, widgets } = extractActions(parsed.body);
    actionsMap = actions;
    widgetsMap = widgets;
    
    // Load state
    const stateFromFile = parsed.statePath ? loadState(resolve(mdDir, parsed.statePath)) : {};
    
    // Execute widgets to get data
    const widgetResults = await executeWidgets(widgetsMap, parsed.tools, mdDir);
    
    // Merge state
    currentState = mergeWidgetResults(stateFromFile, widgetResults);
    
    // Render template
    const cleanedBody = cleanBody(parsed.body);
    const renderedBody = await renderTemplate(cleanedBody, { state: currentState });
    
    return {
      html: marked(renderedBody),
      actions: extractActionLinks(renderedBody),
      state: currentState
    };
  }
  
  // Main page
  app.get('/', async (req, res) => {
    try {
      const { html, actions, state } = await render();
      
      res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Markdown OS</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      max-width: 900px;
      margin: 40px auto;
      padding: 0 20px;
      line-height: 1.6;
      color: #333;
    }
    a[href^="#"] {
      display: inline-block;
      padding: 6px 12px;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      margin: 2px;
      font-size: 14px;
    }
    a[href^="#"]:hover {
      background: #0056b3;
    }
    .status {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 10px 15px;
      background: #28a745;
      color: white;
      border-radius: 4px;
      display: none;
    }
    .status.error {
      background: #dc3545;
    }
    .status.show {
      display: block;
    }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 90%;
    }
    pre {
      background: #f4f4f4;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
    }
    pre code {
      background: none;
      padding: 0;
    }
    h1, h2, h3 {
      margin-top: 1.5em;
    }
    .refresh-info {
      color: #666;
      font-size: 12px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="refresh-info">
    ${parsed.refresh ? `Auto-refresh: ${parsed.refresh}s` : ''}
    <span id="last-update"></span>
  </div>
  
  <div id="content">
    ${html}
  </div>
  
  <div id="status" class="status"></div>
  
  <script>
    const statusEl = document.getElementById('status');
    const lastUpdateEl = document.getElementById('last-update');
    
    function showStatus(message, isError = false) {
      statusEl.textContent = message;
      statusEl.className = 'status show' + (isError ? ' error' : '');
      setTimeout(() => {
        statusEl.className = 'status';
      }, 3000);
    }
    
    function updateTimestamp() {
      lastUpdateEl.textContent = 'Last update: ' + new Date().toLocaleTimeString();
    }
    
    updateTimestamp();
    
    // Handle action clicks
    document.addEventListener('click', async (e) => {
      if (e.target.tagName === 'A' && e.target.getAttribute('href')?.startsWith('#')) {
        e.preventDefault();
        const action = e.target.getAttribute('href').slice(1);
        
        if (!action) return;
        
        showStatus('Executing...');
        
        try {
          const response = await fetch('/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
          });
          
          const result = await response.json();
          
          if (result.success) {
            showStatus('Done!');
            // Reload page to show updated state
            setTimeout(() => window.location.reload(), 500);
          } else {
            showStatus('Error: ' + result.error, true);
          }
        } catch (error) {
          showStatus('Error: ' + error.message, true);
        }
      }
    });
    
    // Auto-refresh
    ${parsed.refresh ? `
    setInterval(() => {
      window.location.reload();
    }, ${parsed.refresh * 1000});
    ` : ''}
  </script>
</body>
</html>
      `);
    } catch (error) {
      res.status(500).send(`Error: ${error.message}`);
    }
  });
  
  // Execute action endpoint
  app.post('/action', async (req, res) => {
    const { action } = req.body;
    
    try {
      const result = await executeAction(action, actionsMap, parsed.tools, mdDir);
      
      // Update state with timestamp
      if (result.success && parsed.statePath) {
        const state = loadState(resolve(mdDir, parsed.statePath));
        state.last_action = action;
        state.last_action_time = new Date().toISOString();
        saveState(resolve(mdDir, parsed.statePath), state);
      }
      
      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // Watch markdown file for changes
  const watcher = watch(resolve(mdPath), {
    persistent: true
  });
  
  watcher.on('change', () => {
    console.log('Markdown file changed, will reload on next request');
  });
  
  // Start server
  app.listen(port, () => {
    console.log(`\nMarkdown OS running at http://localhost:${port}`);
    console.log(`Watching: ${resolve(mdPath)}\n`);
  });
}
