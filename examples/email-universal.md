---
tools:
  gmail: ../cli-tools/gmail-cli
cache:
  inbox: 5m
  email_count: 5m
---

# 📧 Email

A markdown file that's also an email client.

| View in | Experience |
|---------|------------|
| GitHub | Documentation |
| Typora | Editable doc |
| mdos | Live app |

---

{% if view.size > 0 %}{{ thread }}{% else %}{{ inbox }}

**{{ email_count }}** unread · [Refresh](#refresh){% endif %}

---

## How it works

The magic is in the **widget definitions** below - they look like markdown links but mdos executes them as commands:

```
[inbox]: !gmail inbox      ← Fetches your emails
[#archive-*]: !gmail archive $1   ← Archives when clicked
```

These are valid markdown (reference-style links) so they're **invisible in GitHub** but **functional in mdos**.

---

*Run with:* `bun mdos examples/email-universal.md`

[inbox]: !gmail inbox
[email_count]: !gmail count
[thread]: !gmail thread {{ view }}

[#archive-*]: !gmail archive $1
[#mark-read-*]: !gmail mark-read $1
[#refresh]: !gmail refresh
