import { marked } from 'marked';

// Configure marked to allow HTML passthrough
marked.setOptions({
  breaks: true,
  gfm: true
});
import express from 'express';
import { watch } from 'chokidar';
import { resolve, dirname } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
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
      // Edit mode - show split view editor with live preview
      if (req.query.edit === 'true') {
        const rawContent = readFileSync(resolve(mdPath), 'utf-8');
        return res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Edit - Markdown OS</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .preview-frame { border: none; }
    .divider { cursor: col-resize; }
    .divider:hover { background: #4B5563; }
  </style>
</head>
<body class="bg-gray-900 min-h-screen overflow-hidden">
  <div class="flex flex-col h-screen">
    <div class="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
      <div class="flex items-center gap-4">
        <span class="text-gray-400 text-sm font-mono">${resolve(mdPath).split('/').pop()}</span>
        <span id="status" class="text-xs text-gray-500"></span>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="save()" class="px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700">Save</button>
        <button onclick="togglePreview()" id="previewBtn" class="px-3 py-1.5 bg-gray-700 text-gray-200 text-sm rounded hover:bg-gray-600">Hide Preview</button>
        <a href="/" class="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">View App</a>
      </div>
    </div>
    <div class="flex flex-1 overflow-hidden">
      <textarea id="editor" class="w-1/2 p-4 bg-gray-900 text-gray-100 font-mono text-sm resize-none focus:outline-none border-r border-gray-700" spellcheck="false">${rawContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
      <div id="divider" class="divider w-1 bg-gray-700 hover:bg-gray-600"></div>
      <iframe id="preview" src="/" class="preview-frame flex-1 bg-white"></iframe>
    </div>
  </div>
  <script>
    const editor = document.getElementById('editor');
    const preview = document.getElementById('preview');
    const status = document.getElementById('status');
    const previewBtn = document.getElementById('previewBtn');
    let modified = false;
    let previewVisible = true;
    let saveTimeout;
    
    editor.addEventListener('input', () => {
      modified = true;
      status.textContent = 'Modified';
      status.className = 'text-xs text-yellow-500';
      
      // Auto-save after 1s of no typing
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        save(true);
      }, 1000);
    });
    
    function togglePreview() {
      previewVisible = !previewVisible;
      preview.style.display = previewVisible ? 'block' : 'none';
      document.getElementById('divider').style.display = previewVisible ? 'block' : 'none';
      editor.style.width = previewVisible ? '50%' : '100%';
      previewBtn.textContent = previewVisible ? 'Hide Preview' : 'Show Preview';
    }
    
    async function save(auto = false) {
      status.textContent = auto ? 'Auto-saving...' : 'Saving...';
      status.className = 'text-xs text-blue-400';
      try {
        const res = await fetch('/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: editor.value })
        });
        const data = await res.json();
        if (data.success) {
          status.textContent = 'Saved';
          status.className = 'text-xs text-green-500';
          modified = false;
          // Refresh preview
          preview.src = preview.src;
        } else {
          status.textContent = 'Error: ' + data.error;
          status.className = 'text-xs text-red-500';
        }
      } catch (e) {
        status.textContent = 'Error: ' + e.message;
        status.className = 'text-xs text-red-500';
      }
    }
    
    // Cmd/Ctrl+S to save
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    });
    
    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
      if (modified) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  </script>
</body>
</html>
        `);
      }
      
      // Raw mode - show raw markdown
      if (req.query.raw === 'true') {
        const rawContent = readFileSync(resolve(mdPath), 'utf-8');
        return res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Markdown OS</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-white min-h-screen">
  <div class="max-w-4xl mx-auto px-6 py-8">
    <div class="flex justify-end mb-4 gap-2">
      <a href="/" class="text-sm text-blue-600 hover:underline">Rendered</a>
      <span class="text-gray-300">|</span>
      <a href="?edit=true" class="text-sm text-blue-600 hover:underline">Edit</a>
    </div>
    <pre class="font-mono text-sm whitespace-pre-wrap">${rawContent.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
  </div>
</body>
</html>
        `);
      }
      
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
  <title>mdos</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', monospace;
      font-size: 14px;
      line-height: 1.5;
      background: #1a1b26;
      color: #c0caf5;
      min-height: 100vh;
      padding: 16px;
    }
    a { color: #7aa2f7; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .container { max-width: 900px; margin: 0 auto; }
    
    /* Terminal box */
    .box {
      border: 1px solid #414868;
      margin-bottom: 8px;
    }
    .box-header {
      background: #24283b;
      padding: 4px 12px;
      border-bottom: 1px solid #414868;
      color: #7aa2f7;
      font-weight: bold;
    }
    .box-content { padding: 8px 12px; }
    .box-footer {
      background: #24283b;
      padding: 4px 12px;
      border-top: 1px solid #414868;
      color: #565f89;
      font-size: 12px;
    }
    
    /* List items */
    .item {
      padding: 6px 0;
      border-bottom: 1px solid #24283b;
      cursor: pointer;
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .item:last-child { border-bottom: none; }
    .item:hover { background: #24283b; }
    .item.selected { background: #364a82; }
    .item.cursor { outline: 1px solid #7aa2f7; outline-offset: -1px; }
    .item .checkbox { color: #565f89; }
    .item .checkbox.checked { color: #9ece6a; }
    .item .unread { color: #f7768e; }
    .item .from { color: #c0caf5; font-weight: 500; min-width: 180px; }
    .item .subject { color: #a9b1d6; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .item .date { color: #565f89; font-size: 12px; }
    .item .actions { display: none; gap: 8px; margin-left: auto; }
    .item:hover .actions, .item.cursor .actions { display: flex; }
    .item .actions a { color: #565f89; font-size: 12px; }
    .item .actions a:hover { color: #7aa2f7; }
    
    /* Markdown content */
    .md h1 { font-size: 20px; font-weight: bold; margin-bottom: 12px; color: #c0caf5; }
    .md h2 { font-size: 16px; font-weight: bold; margin: 16px 0 8px; color: #7aa2f7; }
    .md h3 { font-size: 14px; font-weight: bold; margin: 12px 0 6px; color: #bb9af7; }
    .md p { margin-bottom: 8px; }
    .md ul, .md ol { margin-left: 20px; margin-bottom: 8px; }
    .md li { margin-bottom: 2px; }
    .md code { background: #24283b; padding: 2px 6px; border-radius: 3px; }
    .md pre { background: #24283b; padding: 12px; margin: 8px 0; overflow-x: auto; border-radius: 4px; }
    .md pre code { background: none; padding: 0; }
    .md hr { border: none; border-top: 1px solid #414868; margin: 16px 0; }
    .md strong { color: #c0caf5; font-weight: 600; }
    .md em { color: #565f89; }
    .md blockquote { border-left: 2px solid #414868; padding-left: 12px; color: #565f89; }
    .md table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    .md th, .md td { padding: 6px 12px; border: 1px solid #414868; text-align: left; }
    .md th { background: #24283b; color: #7aa2f7; }
    
    /* Chat panel - bottom mode (default) */
    #chat-panel {
      display: none;
      background: #1a1b26;
      border-top: 2px solid #7aa2f7;
      z-index: 100;
    }
    #chat-panel.open { display: flex; flex-direction: column; }
    #chat-panel.bottom {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
    }
    #chat-panel.bottom #chat-output { max-height: 200px; }
    
    /* Chat panel - split mode */
    #chat-panel.split {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: 400px;
      border-top: none;
      border-left: 2px solid #7aa2f7;
    }
    #chat-panel.split #chat-output { flex: 1; max-height: none; }
    body.chat-split .container { margin-right: 420px; }
    
    #chat-header {
      padding: 8px 16px;
      background: #24283b;
      color: #7aa2f7;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    #chat-header .chat-controls { display: flex; gap: 8px; align-items: center; }
    #chat-header .chat-controls button {
      background: #414868;
      border: none;
      color: #c0caf5;
      padding: 2px 8px;
      font-family: inherit;
      font-size: 12px;
      cursor: pointer;
      border-radius: 3px;
    }
    #chat-header .chat-controls button:hover { background: #565f89; }
    #chat-header .chat-controls button.active { background: #7aa2f7; color: #1a1b26; }
    #chat-output {
      padding: 12px 16px;
      max-height: 200px;
      overflow-y: auto;
      font-size: 13px;
      white-space: pre-wrap;
      color: #9aa5ce;
    }
    #chat-input-container {
      padding: 8px 16px 16px;
      display: flex;
      gap: 8px;
    }
    #chat-input {
      flex: 1;
      background: #24283b;
      border: 1px solid #414868;
      color: #c0caf5;
      padding: 8px 12px;
      font-family: inherit;
      font-size: 14px;
      outline: none;
    }
    #chat-input:focus { border-color: #7aa2f7; }
    #chat-send {
      background: #7aa2f7;
      color: #1a1b26;
      border: none;
      padding: 8px 16px;
      font-family: inherit;
      font-weight: bold;
      cursor: pointer;
    }
    #chat-send:hover { background: #89b4fa; }
    
    /* Status bar */
    #status-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #24283b;
      padding: 6px 16px;
      font-size: 12px;
      color: #565f89;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #414868;
    }
    #status-bar.hidden { display: none; }
    .key { 
      background: #414868;
      color: #c0caf5;
      padding: 1px 6px;
      border-radius: 3px;
      margin-right: 4px;
    }
    
    /* Thread view */
    .thread-view { display: none; }
    .thread-view.active { display: block; }
    .thread-header {
      padding: 12px;
      background: #24283b;
      border-bottom: 1px solid #414868;
    }
    .thread-from { color: #7aa2f7; font-weight: bold; }
    .thread-subject { color: #c0caf5; margin-top: 4px; }
    .thread-meta { color: #565f89; font-size: 12px; margin-top: 8px; }
    .thread-body { padding: 16px; white-space: pre-wrap; }
    .thread-actions { padding: 12px; border-top: 1px solid #414868; display: flex; gap: 16px; }
    
    /* Loading */
    .loading { color: #565f89; }
  </style>
</head>
<body>
  <div class="container">
    <div id="main-view">
      <div id="content" class="md">
        ${html}
      </div>
    </div>
  </div>
  
  <!-- Chat panel -->
  <div id="chat-panel" class="bottom">
    <div id="chat-header">
      <span>Chat (droid exec)</span>
      <div class="chat-controls">
        <span id="chat-mode-label" style="color: #565f89; font-weight: normal; font-size: 12px">bottom</span>
        <span style="color: #565f89; font-weight: normal; font-size: 12px">· ctrl+shift+t toggle · esc close</span>
      </div>
    </div>
    <div id="chat-output"></div>
    <div id="chat-input-container">
      <input type="text" id="chat-input" placeholder="Ask the agent to help...">
      <button id="chat-send">Send</button>
    </div>
  </div>
  
  <!-- Status bar -->
  <div id="status-bar">
    <div>
      <span class="key">j</span><span class="key">k</span> move
      <span class="key">space</span> select
      <span class="key">enter</span> open
      <span class="key">a</span> archive
      <span class="key">r</span> refresh
      <span class="key">c</span> chat
      <span class="key">+</span> new chat
    </div>
    <div id="status-msg"></div>
  </div>
  
  <script>
    // State
    let items = [];
    let cursor = 0;
    let selected = new Set();
    let chatOpen = false;
    let currentView = null;
    
    // Find all selectable items
    function initItems() {
      items = Array.from(document.querySelectorAll('.item, [data-item]'));
      items.forEach((el, i) => {
        el.dataset.index = i;
        el.addEventListener('click', () => {
          cursor = i;
          updateCursor();
          openItem(el);
        });
      });
      if (items.length > 0) updateCursor();
    }
    
    function updateCursor() {
      items.forEach((el, i) => {
        el.classList.toggle('cursor', i === cursor);
      });
      // Scroll into view
      if (items[cursor]) {
        items[cursor].scrollIntoView({ block: 'nearest' });
      }
    }
    
    function toggleSelect(index) {
      const el = items[index];
      if (!el) return;
      const id = el.dataset.id || el.dataset.threadId;
      if (selected.has(id)) {
        selected.delete(id);
        el.classList.remove('selected');
        const checkbox = el.querySelector('.checkbox');
        if (checkbox) checkbox.classList.remove('checked');
        if (checkbox) checkbox.textContent = '[ ]';
      } else {
        selected.add(id);
        el.classList.add('selected');
        const checkbox = el.querySelector('.checkbox');
        if (checkbox) checkbox.classList.add('checked');
        if (checkbox) checkbox.textContent = '[x]';
      }
      updateStatusMsg();
    }
    
    function updateStatusMsg() {
      const msg = document.getElementById('status-msg');
      if (selected.size > 0) {
        msg.textContent = selected.size + ' selected';
      } else {
        msg.textContent = '';
      }
    }
    
    function openItem(el) {
      const href = el.querySelector('a')?.getAttribute('href');
      if (href && href.startsWith('?')) {
        window.location.href = href;
      }
    }
    
    async function executeAction(action) {
      showStatus('Executing...');
      try {
        const response = await fetch('/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action })
        });
        const result = await response.json();
        if (result.success) {
          showStatus('Done');
          setTimeout(() => window.location.reload(), 300);
        } else {
          showStatus('Error: ' + result.error);
        }
      } catch (error) {
        showStatus('Error: ' + error.message);
      }
    }
    
    async function archiveSelected() {
      if (selected.size === 0 && items[cursor]) {
        const id = items[cursor].dataset.threadId || items[cursor].dataset.id;
        if (id) {
          await executeAction('archive-' + id);
        }
      } else {
        for (const id of selected) {
          await executeAction('archive-' + id);
        }
      }
    }
    
    function showStatus(msg) {
      document.getElementById('status-msg').textContent = msg;
    }
    
    // Chat functions
    let chatMode = 'split'; // 'split' (default) or 'bottom'
    
    function openChat() {
      chatOpen = true;
      const panel = document.getElementById('chat-panel');
      panel.classList.add('open');
      setChatMode(chatMode); // Apply current mode (split default)
      document.getElementById('chat-input').focus();
    }
    
    function closeChat() {
      chatOpen = false;
      document.getElementById('chat-panel').classList.remove('open');
      document.getElementById('status-bar').classList.remove('hidden');
      document.body.classList.remove('chat-split');
    }
    
    function setChatMode(mode) {
      chatMode = mode;
      const panel = document.getElementById('chat-panel');
      panel.classList.remove('bottom', 'split');
      panel.classList.add(mode);
      document.getElementById('chat-mode-label').textContent = mode;
      
      if (mode === 'split') {
        document.body.classList.add('chat-split');
        document.getElementById('status-bar').classList.remove('hidden');
      } else {
        document.body.classList.remove('chat-split');
        if (chatOpen) document.getElementById('status-bar').classList.add('hidden');
      }
    }
    
    function toggleChatMode() {
      setChatMode(chatMode === 'bottom' ? 'split' : 'bottom');
    }
    
    // Session management
    let currentSessionId = localStorage.getItem('mdos-session-id') || null;
    
    function newSession() {
      currentSessionId = null;
      localStorage.removeItem('mdos-session-id');
      document.getElementById('chat-output').textContent = '[New session]\\n';
      document.getElementById('chat-input').focus();
    }
    
    function loadSession(session) {
      currentSessionId = session.id;
      localStorage.setItem('mdos-session-id', session.id);
      
      const output = document.getElementById('chat-output');
      output.textContent = '';
      
      // Render messages
      if (session.messages) {
        for (const msg of session.messages) {
          if (msg.role === 'user') {
            output.textContent += '> ' + msg.content + '\\n\\n';
          } else {
            output.textContent += msg.content + '\\n\\n';
          }
        }
      }
      output.scrollTop = output.scrollHeight;
      document.getElementById('chat-input').focus();
    }
    
    async function showSessionHistory() {
      openChat();
      
      try {
        const response = await fetch('/chat/sessions');
        const sessions = await response.json();
        
        if (!sessions.length) {
          document.getElementById('chat-output').textContent = '[No previous sessions]\\n';
          return;
        }
        
        const output = document.getElementById('chat-output');
        output.textContent = '[Session History] (click to load)\\n\\n';
        
        // Show recent sessions
        sessions.slice(-10).reverse().forEach((s, i) => {
          const date = new Date(s.lastUpdated || s.created).toLocaleString();
          const preview = s.messages?.[0]?.content?.slice(0, 50) || 'Empty session';
          const isCurrent = s.id === currentSessionId ? ' [current]' : '';
          
          const line = document.createElement('div');
          line.className = 'session-item';
          line.style.cssText = 'cursor: pointer; padding: 4px 0; border-bottom: 1px solid #333;';
          line.textContent = (i + 1) + '. ' + date + isCurrent + '\\n   ' + preview + '...';
          line.onclick = () => loadSession(s);
          output.appendChild(line);
        });
      } catch (error) {
        document.getElementById('chat-output').textContent = '[Error loading sessions]\\n';
      }
    }
    
    async function sendChat() {
      const input = document.getElementById('chat-input');
      const output = document.getElementById('chat-output');
      const prompt = input.value.trim();
      if (!prompt) return;
      
      // Build context - only include emails if explicitly selected or in detail view
      const params = new URLSearchParams(window.location.search);
      const viewId = params.get('view') || '';
      const selectedIds = Array.from(selected);
      
      const context = {
        selectedIds: selectedIds.length > 0 ? selectedIds : [],
        viewId: viewId || null
      };
      
      input.value = '';
      output.textContent = '> ' + prompt + '\\n\\n';
      
      try {
        const response = await fetch('/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            prompt, 
            context,
            sessionId: currentSessionId,
            isNewSession: !currentSessionId
          })
        });
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let shouldRefresh = false;
        let fullText = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          fullText += chunk;
          
          // Parse signals from stream
          const lines = chunk.split('\\n');
          for (const line of lines) {
            // Parse session ID
            const sessionMatch = line.match(/\\[SESSION:(.+?)\\]/);
            if (sessionMatch) {
              currentSessionId = sessionMatch[1];
              localStorage.setItem('mdos-session-id', currentSessionId);
              continue;
            }
            
            // Parse refresh signal
            if (line.includes('[REFRESH]')) {
              shouldRefresh = true;
              continue;
            }
            
            // Show non-signal lines
            if (line.trim()) {
              output.textContent += line + '\\n';
            }
          }
          output.scrollTop = output.scrollHeight;
        }
        
        // Auto-refresh after archive actions
        if (shouldRefresh) {
          setTimeout(() => window.location.reload(), 800);
        }
      } catch (error) {
        output.textContent += '\\nError: ' + error.message;
      }
    }
    
    // Keyboard handler
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+T toggles chat mode (works everywhere)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'T' || e.key === 't')) {
        e.preventDefault();
        toggleChatMode();
        return;
      }
      
      // Ctrl+N: new session (works everywhere)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N') && !e.shiftKey) {
        e.preventDefault();
        openChat();
        newSession();
        return;
      }
      
      // Ctrl+H: show session history (works everywhere)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'h' || e.key === 'H') && !e.shiftKey) {
        e.preventDefault();
        showSessionHistory();
        return;
      }
      
      // Ignore if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') {
          closeChat();
          e.target.blur();
        }
        if (e.key === 'Enter' && chatOpen) {
          sendChat();
        }
        return;
      }
      
      switch (e.key) {
        case 'j':
          cursor = Math.min(cursor + 1, items.length - 1);
          updateCursor();
          break;
        case 'k':
          cursor = Math.max(cursor - 1, 0);
          updateCursor();
          break;
        case ' ':
          e.preventDefault();
          toggleSelect(cursor);
          break;
        case 'Enter':
          if (items[cursor]) openItem(items[cursor]);
          break;
        case 'a':
          archiveSelected();
          break;
        case 'r':
          window.location.reload();
          break;
        case 'c':
          openChat();
          break;
        case '+':
        case '=':
          openChat();
          newSession();
          break;
        case 'Escape':
          if (chatOpen) {
            closeChat();
          } else {
            // Go back
            const params = new URLSearchParams(window.location.search);
            if (params.has('view')) {
              window.location.href = '/';
            }
          }
          break;
      }
    });
    
    // Init
    initItems();
    
    // Handle action links
    document.addEventListener('click', async (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (link) {
        e.preventDefault();
        const action = link.getAttribute('href').slice(1);
        if (action) await executeAction(action);
      }
    });
    
    // Chat send button
    document.getElementById('chat-send').addEventListener('click', sendChat);
  </script>
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
  
  // Save markdown file endpoint
  app.post('/save', async (req, res) => {
    const { content } = req.body;
    
    try {
      writeFileSync(resolve(mdPath), content, 'utf-8');
      
      // Invalidate cache after save
      if (cache) {
        cache.invalidateAll();
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  // Session storage
  const sessionsPath = resolve(mdDir, '.chat-sessions.json');
  
  function loadSessions() {
    if (existsSync(sessionsPath)) {
      return JSON.parse(readFileSync(sessionsPath, 'utf-8'));
    }
    return [];
  }
  
  function saveSessions(sessions) {
    writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2));
  }
  
  // Get sessions endpoint
  app.get('/chat/sessions', (req, res) => {
    res.json(loadSessions());
  });
  
  // Chat endpoint - runs droid exec with haiku model
  app.post('/chat', async (req, res) => {
    const { prompt, context, sessionId, isNewSession } = req.body;
    
    // Build prompt - keep it simple
    let fullPrompt = prompt;
    
    // Add email context only if explicitly selected or in detail view
    if (context?.selectedIds?.length > 0) {
      fullPrompt += `\n\n[Selected emails: ${context.selectedIds.join(', ')}]`;
    } else if (context?.viewId) {
      fullPrompt += `\n\n[Viewing email: ${context.viewId}]`;
    }
    
    // Add tools info
    fullPrompt += `\n\n[Available: cli-tools/gmail-cli - inbox, thread, archive, mark-read, star, reply]`;
    
    // Session management
    let sessions = loadSessions();
    let currentSessionId = sessionId || null;
    
    // Set headers for streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.flushHeaders();
    
    try {
      const { spawn } = await import('child_process');
      
      // Build args - use haiku for speed, stream-json for tool visibility
      const args = [
        'exec',
        '--auto', 'medium',
        '-m', 'claude-haiku-4-5-20251001',
        '--output-format', 'stream-json'
      ];
      
      // Resume existing session if we have one (and not creating new)
      if (!isNewSession && sessionId) {
        args.push('-s', sessionId);
      }
      
      args.push(fullPrompt);
      
      const droid = spawn('droid', args, {
        cwd: mdDir,
        env: { ...process.env }
      });
      
      let output = '';
      let finalText = '';
      let shouldRefresh = false;
      
      droid.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        
        // Parse stream-json lines
        const lines = text.split('\n').filter(l => l.trim());
        for (const line of lines) {
          try {
            const event = JSON.parse(line);
            
            // Tool call - show clean status
            if (event.type === 'tool_call') {
              const toolName = event.toolName || '';
              const params = event.parameters || {};
              
              // Check if this is an archive action
              if (toolName === 'Execute' && params.command?.includes('archive')) {
                shouldRefresh = true;
                res.write('[Archiving...]\n');
              } else if (toolName === 'Execute') {
                res.write('[Executing...]\n');
              } else if (toolName === 'Read') {
                res.write('[Reading...]\n');
              } else {
                res.write(`[${toolName}...]\n`);
              }
            }
            
            // Tool result - minimal feedback
            else if (event.type === 'tool_result') {
              if (event.isError) {
                res.write(`[Error: ${String(event.value).slice(0, 100)}]\n`);
              } else {
                res.write('[Done]\n');
              }
            }
            
            // Completion - show final text and get session_id
            else if (event.type === 'completion') {
              finalText = event.finalText || '';
              res.write('\n' + finalText + '\n');
              
              // Capture the real session ID from droid
              if (event.session_id) {
                currentSessionId = event.session_id;
              }
              
              // Send refresh signal if needed
              if (shouldRefresh) {
                res.write('\n[REFRESH]\n');
              }
            }
            
            // System init - capture session_id
            else if (event.type === 'system' && event.session_id) {
              currentSessionId = event.session_id;
            }
          } catch {
            // Not valid JSON, ignore
          }
        }
      });
      
      droid.stderr.on('data', (data) => {
        res.write('[Error] ' + data.toString());
      });
      
      droid.on('close', (code) => {
        // Save session if we have an ID
        if (currentSessionId) {
          const existingIdx = sessions.findIndex(s => s.id === currentSessionId);
          if (existingIdx >= 0) {
            sessions[existingIdx].messages = sessions[existingIdx].messages || [];
            sessions[existingIdx].messages.push({ role: 'user', content: prompt });
            sessions[existingIdx].messages.push({ role: 'assistant', content: finalText });
            sessions[existingIdx].lastUpdated = new Date().toISOString();
          } else {
            sessions.push({
              id: currentSessionId,
              created: new Date().toISOString(),
              lastUpdated: new Date().toISOString(),
              messages: [
                { role: 'user', content: prompt },
                { role: 'assistant', content: finalText }
              ]
            });
          }
          
          // Keep last 20 sessions
          if (sessions.length > 20) sessions = sessions.slice(-20);
          saveSessions(sessions);
          
          // Send session ID to client for storage
          res.write(`\n[SESSION:${currentSessionId}]\n`);
        }
        
        if (cache) cache.invalidateAll();
        res.end();
      });
      
      droid.on('error', (error) => {
        res.write(`Error: ${error.message}`);
        res.end();
      });
    } catch (error) {
      res.write(`Error: ${error.message}`);
      res.end();
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
