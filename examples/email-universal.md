---
tools:
  gmail: ../cli-tools/gmail-cli
cache:
  inbox: 5m
  email_count: 5m
---

# 📧 Inbox

---

{% if view.size > 0 %}{{ thread }}{% else %}{{ inbox }}

**{{ email_count }}** unread · [Refresh](#refresh){% endif %}

---

*Run with:* `bun mdos examples/email-universal.md`

[inbox]: !gmail inbox --format=checklist
[email_count]: !gmail count
[thread]: !gmail thread {{ view }}

[#archive-*]: !gmail archive $1
[#mark-read-*]: !gmail mark-read $1
[#refresh]: !gmail refresh
