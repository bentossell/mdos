---
tools:
  gmail: ../cli-tools/gmail-cli

state: ./email-state.json
refresh: 60
---

# Gmail

<div class="flex items-center justify-between mb-6">
  <div class="flex items-center gap-4">
    <span class="text-2xl font-bold">Inbox</span>
    <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">{{ email_count }} unread</span>
    <span class="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">{{ starred_count }} starred</span>
  </div>
  <div class="flex gap-2">
    [Mark All Read](#mark-all-read)
    [Archive Old](#archive-old)
  </div>
</div>

{{ inbox_table }}

---

## Starred

{{ starred_list }}

---

<div class="text-sm text-gray-500 mt-4">
Account: ben.tossell@gmail.com | Last action: {{ state.last_action }} at {{ state.last_action_time }}
</div>

[email_count]: !gmail count
[starred_count]: !gmail count-starred
[inbox_table]: !gmail inbox
[starred_list]: !gmail starred

[#mark-all-read]: !gmail mark-all-read
[#archive-old]: !gmail archive-old
[#archive-*]: !gmail archive $1
[#star-*]: !gmail star $1
[#unstar-*]: !gmail unstar $1
[#mark-read-*]: !gmail mark-read $1
[#view-*]: !gmail thread $1
