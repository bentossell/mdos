---
tools:
  gmail: ../cli-tools/gmail-cli

state: ./email-state.json
refresh: 0

scripts:
  - ./scripts/email-interactions.js
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

[inbox]: !gmail inbox
[email_count]: !gmail count

[#view-*]: !gmail thread $1
[#archive-*]: !gmail archive $1
[#mark-read-*]: !gmail mark-read $1
[#archive-selected-*]: !gmail archive-selected $1
[#mark-read-selected-*]: !gmail mark-read-selected $1
[#reply-*]: !gmail reply $1
