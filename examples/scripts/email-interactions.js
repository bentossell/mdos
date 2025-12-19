// Email app interactions
let selectedThreads = new Set();
let currentAccount = '';
let currentLimit = 10;

function updateSelectionUI() {
  const count = selectedThreads.size;
  const selectedCountEl = document.getElementById('selected-count');
  const bulkActionsEl = document.getElementById('bulk-actions');
  if (selectedCountEl) selectedCountEl.textContent = count;
  if (bulkActionsEl) bulkActionsEl.classList.toggle('hidden', count === 0);
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
      const threadContent = document.getElementById('thread-content');
      const threadView = document.getElementById('thread-view');
      const inboxList = document.getElementById('inbox-list');
      if (threadContent) threadContent.innerHTML = data.stdout;
      if (threadView) threadView.classList.remove('hidden');
      if (inboxList) inboxList.classList.add('hidden');
      // Auto mark as read when viewing
      markRead(id);
    }
  });
}

function closeThread() {
  const threadView = document.getElementById('thread-view');
  const inboxList = document.getElementById('inbox-list');
  if (threadView) threadView.classList.add('hidden');
  if (inboxList) inboxList.classList.remove('hidden');
}

function archiveThread(id) {
  fetch('/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'archive-' + id })
  })
  .then(() => {
    const el = document.querySelector('[data-thread-id="' + id + '"]');
    if (el) el.remove();
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
      const badge = el.querySelector('.bg-blue-500');
      if (badge) badge.remove();
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
    ids.forEach(id => {
      const el = document.querySelector('[data-thread-id="' + id + '"]');
      if (el) el.remove();
    });
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
        const badge = el.querySelector('.bg-blue-500');
        if (badge) badge.remove();
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
  if (!threadView) return;
  const isThreadOpen = !threadView.classList.contains('hidden');
  
  // Escape to close thread view
  if (e.key === 'Escape' && isThreadOpen) {
    closeThread();
  }
});
