---
tools:
  gmail: ../cli-tools/gmail-cli

state: ./email-state.json
refresh: 0
---

<div id="email-app">
  <!-- Account Tabs -->
  <div class="flex items-center gap-1 mb-4 border-b">
    {% for acc in accounts %}<button onclick="switchAccount('{{ acc.email }}')" class="account-tab px-4 py-2 text-sm font-medium {% if account == acc.email %}border-b-2 border-blue-500 text-blue-600{% else %}text-gray-500 hover:text-gray-700{% endif %}" data-account="{{ acc.email }}">{{ acc.label }}</button>{% endfor %}
    <div class="flex-1"></div>
    <span class="text-sm text-gray-500">{{ email_count }} unread</span>
  </div>

  <!-- Bulk Actions Bar (hidden by default) -->
  <div id="bulk-actions" class="hidden mb-4 p-3 bg-blue-50 rounded-lg flex items-center gap-3">
    <span class="text-sm text-blue-700"><span id="selected-count">0</span> selected</span>
    <button onclick="archiveSelected()" class="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50">Archive</button>
    <button onclick="markReadSelected()" class="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-50">Mark Read</button>
    <button onclick="clearSelection()" class="ml-auto text-sm text-gray-500 hover:text-gray-700">Clear</button>
  </div>

  <!-- Thread View (hidden by default) -->
  <div id="thread-view" class="hidden mb-4">
    <div id="thread-content"></div>
  </div>

  <!-- Inbox List -->
  <div id="inbox-list">
    {{ inbox }}
  </div>

  <!-- Load More -->
  <div class="mt-4 text-center">
    <button onclick="loadMore()" class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded">
      Load more...
    </button>
  </div>
</div>

<script>
let selectedThreads = new Set();
let currentAccount = '{{ account }}';
let currentLimit = {{ limit }};

function updateSelectionUI() {
  const count = selectedThreads.size;
  document.getElementById('selected-count').textContent = count;
  document.getElementById('bulk-actions').classList.toggle('hidden', count === 0);
}

function viewThread(id) {
  fetch('/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'view-' + id })
  })
  .then(r => r.json())
  .then(data => {
    if (data.success) {
      document.getElementById('thread-content').innerHTML = data.stdout;
      document.getElementById('thread-view').classList.remove('hidden');
      document.getElementById('inbox-list').classList.add('hidden');
      // Auto mark as read when viewing
      markRead(id);
    }
  });
}

function closeThread() {
  document.getElementById('thread-view').classList.add('hidden');
  document.getElementById('inbox-list').classList.remove('hidden');
}

function archiveThread(id) {
  fetch('/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'archive-' + id })
  })
  .then(() => {
    document.querySelector('[data-thread-id="' + id + '"]')?.remove();
  });
}

function markRead(id) {
  fetch('/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'mark-read-' + id })
  })
  .then(() => {
    const el = document.querySelector('[data-thread-id="' + id + '"]');
    if (el) {
      el.classList.remove('font-semibold');
      el.querySelector('.bg-blue-500')?.remove();
    }
  });
}

function archiveSelected() {
  const ids = Array.from(selectedThreads);
  if (ids.length === 0) return;
  
  fetch('/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'archive-selected-' + ids.join('-') })
  })
  .then(() => {
    ids.forEach(id => document.querySelector('[data-thread-id="' + id + '"]')?.remove());
    clearSelection();
  });
}

function markReadSelected() {
  const ids = Array.from(selectedThreads);
  if (ids.length === 0) return;
  
  fetch('/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'mark-read-selected-' + ids.join('-') })
  })
  .then(() => {
    ids.forEach(id => {
      const el = document.querySelector('[data-thread-id="' + id + '"]');
      if (el) {
        el.classList.remove('font-semibold');
        el.querySelector('.bg-blue-500')?.remove();
      }
    });
    clearSelection();
  });
}

function clearSelection() {
  selectedThreads.clear();
  document.querySelectorAll('.thread-select').forEach(cb => cb.checked = false);
  updateSelectionUI();
}

function switchAccount(account) {
  window.location.href = '/?account=' + encodeURIComponent(account);
}

function loadMore() {
  currentLimit += 10;
  window.location.href = '/?limit=' + currentLimit;
}

function replyToThread(id) {
  const body = prompt('Enter your reply:');
  if (body) {
    fetch('/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reply-' + id + '-' + encodeURIComponent(body) })
    })
    .then(r => r.json())
    .then(data => {
      alert(data.success ? 'Draft created!' : 'Error: ' + data.error);
    });
  }
}

// Setup checkbox listeners
document.addEventListener('change', (e) => {
  if (e.target.classList.contains('thread-select')) {
    const id = e.target.dataset.id;
    if (e.target.checked) {
      selectedThreads.add(id);
    } else {
      selectedThreads.delete(id);
    }
    updateSelectionUI();
  }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  const threadView = document.getElementById('thread-view');
  const isThreadOpen = !threadView.classList.contains('hidden');
  
  // Escape to close thread view
  if (e.key === 'Escape' && isThreadOpen) {
    closeThread();
  }
});
</script>

[inbox]: !gmail inbox
[email_count]: !gmail count

[#view-*]: !gmail thread $1
[#archive-*]: !gmail archive $1
[#mark-read-*]: !gmail mark-read $1
[#archive-selected-*]: !gmail archive-selected $1
[#mark-read-selected-*]: !gmail mark-read-selected $1
[#reply-*]: !gmail reply $1
