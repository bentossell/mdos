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
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    /* Base markdown styles */
    .markdown-body a[href^="#"] {
      @apply inline-block px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm font-medium no-underline mx-0.5 my-0.5;
    }
    .markdown-body code {
      @apply bg-gray-100 px-1.5 py-0.5 rounded text-sm;
    }
    .markdown-body pre {
      @apply bg-gray-100 p-4 rounded-lg overflow-x-auto;
    }
    .markdown-body pre code {
      @apply bg-transparent p-0;
    }
    .markdown-body h1 {
      @apply text-3xl font-bold mt-6 mb-4;
    }
    .markdown-body h2 {
      @apply text-2xl font-bold mt-5 mb-3;
    }
    .markdown-body h3 {
      @apply text-xl font-semibold mt-4 mb-2;
    }
    .markdown-body p {
      @apply mb-4;
    }
    .markdown-body ul, .markdown-body ol {
      @apply mb-4 ml-6;
    }
    .markdown-body li {
      @apply mb-1;
    }
    .markdown-body strong {
      @apply font-semibold;
    }
    .markdown-body table {
      @apply w-full border-collapse mb-4;
    }
    .markdown-body th {
      @apply border border-gray-300 px-4 py-2 bg-gray-50 font-semibold text-left;
    }
    .markdown-body td {
      @apply border border-gray-300 px-4 py-2;
    }
    .markdown-body blockquote {
      @apply border-l-4 border-gray-300 pl-4 italic my-4;
    }
    .markdown-body hr {
      @apply my-6 border-t border-gray-300;
    }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div class="max-w-4xl mx-auto px-6 py-8">
    <div class="text-gray-500 text-xs mb-6">
      ${parsed.refresh ? `Auto-refresh: ${parsed.refresh}s` : ''}
      <span id="last-update" class="ml-2"></span>
    </div>
    
    <div id="content" class="markdown-body bg-white rounded-lg shadow-sm p-8">
      ${html}
    </div>
  </div>
  
  <div id="status" class="fixed top-5 right-5 px-4 py-2 rounded shadow-lg text-white font-medium hidden"></div>
  
  <script>
    const statusEl = document.getElementById('status');
    const lastUpdateEl = document.getElementById('last-update');
    
    function showStatus(message, isError = false) {
      statusEl.textContent = message;
      statusEl.className = 'fixed top-5 right-5 px-4 py-2 rounded shadow-lg text-white font-medium block ' + 
        (isError ? 'bg-red-500' : 'bg-green-500');
      setTimeout(() => {
        statusEl.className = 'fixed top-5 right-5 px-4 py-2 rounded shadow-lg text-white font-medium hidden';
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
