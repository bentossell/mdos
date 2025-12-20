import { marked } from 'marked';

// Configure marked to allow HTML passthrough
marked.setOptions({
  breaks: true,
  gfm: true
});
import express from 'express';
import { watch } from 'chokidar';
import { resolve, dirname } from 'path';
import { readFileSync, existsSync } from 'fs';
import { WebSocketServer } from 'ws';
import { parseMarkdown, extractActions, extractActionLinks, renderTemplate, cleanBody } from './parser.js';
import { loadState, saveState, mergeWidgetResults } from './state.js';
import { executeWidgets, executeAction } from './executor.js';
import { Cache } from './cache.js';
import { enhanceMarkdown } from './enhancer.js';

// Load config with multi-account support
function loadConfig(configName = 'config.json') {
  const configPath = resolve(process.cwd(), configName);
  if (existsSync(configPath)) {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  }
  return { accounts: [], defaults: { limit: 10 } };
}

/**
 * Start web server for markdown OS
 */
export async function startServer(mdPath, port = 3000, options = {}) {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  const mdDir = dirname(resolve(mdPath));
  
  // Serve static files (scripts, styles, etc.) from markdown directory
  app.use(express.static(mdDir));
  
  const devMode = options.dev || false;
  const configFile = options.config || 'config.json';
  const config = loadConfig(configFile);
  
  let currentState = {};
  let parsed = null;
  let actionsMap = {};
  let widgetsMap = {};
  let cache = null;
  
  // WebSocket for hot reload
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set();
  
  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.on('close', () => clients.delete(ws));
  });
  
  // Broadcast reload to all connected clients
  function broadcastReload() {
    clients.forEach(client => {
      if (client.readyState === 1) { // OPEN
        client.send(JSON.stringify({ type: 'reload' }));
      }
    });
  }
  
  // Parse and render the markdown
  async function render(query = {}) {
    try {
      parsed = parseMarkdown(resolve(mdPath));
      const { actions, widgets } = extractActions(parsed.body);
      actionsMap = actions;
      
      // Initialize cache
      const statePath = parsed.statePath ? resolve(mdDir, parsed.statePath) : null;
      cache = new Cache(statePath);
      
      // Load state
      const stateFromFile = statePath ? loadState(statePath) : {};
      
      // Get default account from config
      const defaultAccount = config.accounts[0]?.email || '';
      const defaultLimit = config.defaults?.limit || 10;
      
      // Build initial state with query params (needed for widget command rendering)
      currentState = { ...stateFromFile };
      currentState.accounts = config.accounts;
      currentState.account = query.account || defaultAccount;
      currentState.limit = query.limit || String(defaultLimit);
      currentState.view = query.view || '';
      currentState.page = query.page || '';
      
      // Render widget commands through Liquid (so {{ view }} etc. get substituted)
      const renderedWidgets = {};
      for (const [name, command] of Object.entries(widgets)) {
        renderedWidgets[name] = await renderTemplate(command, currentState);
      }
      widgetsMap = renderedWidgets;
      
      // Build environment from query params
      const env = { ...process.env };
      if (query.account) env.GMAIL_ACCOUNT = query.account;
      else if (defaultAccount) env.GMAIL_ACCOUNT = defaultAccount;
      if (query.limit) env.GMAIL_LIMIT = query.limit;
      
      // Parse cache TTLs from frontmatter
      const cacheTTLs = {};
      if (parsed.frontmatter.cache) {
        for (const [widget, ttlStr] of Object.entries(parsed.frontmatter.cache)) {
          cacheTTLs[widget] = Cache.parseTTL(ttlStr);
        }
      }
      
      // Execute widgets to get data (with caching)
      const widgetResults = await executeWidgets(
        renderedWidgets, 
        parsed.tools, 
        mdDir, 
        env,
        cache,
        cacheTTLs
      );
      
      // Merge widget results into state
      currentState = mergeWidgetResults(currentState, widgetResults);
      
      // Render template - pass vars at root level AND under state for flexibility
      const cleanedBody = cleanBody(parsed.body);
      
      // Apply markdown enhancements
      const enhancedBody = enhanceMarkdown(cleanedBody);
      
      const renderedBody = await renderTemplate(enhancedBody, { ...currentState, state: currentState });
      
      return {
        html: marked(renderedBody),
        actions: extractActionLinks(renderedBody),
        state: currentState,
        error: null
      };
    } catch (error) {
      console.error('Render error:', error);
      return {
        html: '',
        actions: [],
        state: {},
        error: error.message
      };
    }
  }
  
  // Main page
  app.get('/', async (req, res) => {
    try {
      const { html, actions, state, error } = await render(req.query);
      
      if (error) {
        return res.status(500).send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Error - Markdown OS</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50 p-8">
  <div class="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-lg p-6">
    <h1 class="text-2xl font-bold text-red-700 mb-2">Render Error</h1>
    <pre class="bg-white p-4 rounded text-sm overflow-x-auto">${error}</pre>
    <p class="mt-4 text-sm text-gray-600">Check your markdown syntax, widget commands, and CLI tool paths.</p>
  </div>
</body>
</html>
        `);
      }
      
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
    .markdown-body a[href^="?"]:not([href^="#"]) {
      @apply text-blue-600 hover:text-blue-800 underline;
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
    
    /* Hover preload hint */
    a[data-preload]:hover::after {
      content: '⚡';
      @apply ml-1 text-xs;
    }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  <div class="max-w-4xl mx-auto px-6 py-8">
    <div class="text-gray-500 text-xs mb-6">
      ${parsed.refresh ? `Auto-refresh: ${parsed.refresh}s` : ''}
      <span id="last-update" class="ml-2"></span>
      ${devMode ? '<span class="ml-2 px-2 py-1 bg-yellow-200 text-yellow-800 rounded text-xs">DEV MODE</span>' : ''}
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
      if (lastUpdateEl) {
        lastUpdateEl.textContent = 'Last update: ' + new Date().toLocaleTimeString();
      }
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
    
    // Preload on hover
    document.addEventListener('mouseover', (e) => {
      if (e.target.tagName === 'A' && e.target.getAttribute('href')?.startsWith('?')) {
        const href = e.target.getAttribute('href');
        if (!e.target.dataset.preloaded) {
          const link = document.createElement('link');
          link.rel = 'prefetch';
          link.href = href;
          document.head.appendChild(link);
          e.target.dataset.preloaded = 'true';
        }
      }
    });
    
    // Auto-refresh
    ${parsed.refresh ? `
    setInterval(() => {
      window.location.reload();
    }, ${parsed.refresh * 1000});
    ` : ''}
    
    // WebSocket for hot reload
    ${devMode ? `
    const ws = new WebSocket('ws://' + location.host);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'reload') {
        console.log('File changed, reloading...');
        window.location.reload();
      }
    };
    ws.onerror = () => console.log('WebSocket disconnected');
    ` : ''}
  </script>
  
  ${(parsed.frontmatter.scripts || []).map(src => `<script src="${src}"></script>`).join('\n  ')}
</body>
</html>
      `);
    } catch (error) {
      res.status(500).send(`<h1>Error</h1><pre>${error.message}\n\n${error.stack}</pre>`);
    }
  });
  
  // Execute action endpoint
  app.post('/action', async (req, res) => {
    const { action } = req.body;
    
    try {
      const result = await executeAction(action, actionsMap, parsed.tools, mdDir);
      
      // Invalidate cache for write actions
      if (result.success && cache) {
        // Invalidate all cache on successful write
        cache.invalidateAll();
      }
      
      // Update state with timestamp
      if (result.success && parsed.statePath) {
        const statePath = resolve(mdDir, parsed.statePath);
        const state = loadState(statePath);
        state.last_action = action;
        state.last_action_time = new Date().toISOString();
        saveState(statePath, state);
      }
      
      res.json(result);
    } catch (error) {
      if (devMode) {
        console.error('Action error:', error);
      }
      res.status(500).json({
        success: false,
        error: error.message,
        stack: devMode ? error.stack : undefined
      });
    }
  });
  
  // Watch markdown file for changes (hot reload in dev mode)
  if (devMode) {
    watch(resolve(mdPath), (eventType) => {
      if (eventType === 'change') {
        console.log('Markdown file changed, notifying clients...');
        broadcastReload();
      }
    });
  } else {
    watch(resolve(mdPath), (eventType) => {
      if (eventType === 'change') {
        console.log('Markdown file changed, will reload on next request');
      }
    });
  }
  
  // Start server
  const server = app.listen(port, () => {
    console.log(`\nMarkdown OS running at http://localhost:${port}`);
    console.log(`Watching: ${resolve(mdPath)}`);
    if (devMode) {
      console.log(`Dev mode: Hot reload enabled`);
    }
    if (configFile !== 'config.json') {
      console.log(`Config: ${configFile}`);
    }
    console.log();
  });
  
  // Handle WebSocket upgrades
  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });
}
