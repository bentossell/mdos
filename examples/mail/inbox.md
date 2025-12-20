---
tools:
  gmail: ../../cli-tools/gmail-cli
cache:
  inbox: 5m
  email_count: 5m
---

# 📧 Inbox

> Your email, powered by markdown. Run with `bun mdos examples/mail/inbox.md`

---

{{ inbox }}

---

**{{ email_count }}** unread · [Refresh](#refresh) · [Load more](?limit=20)

---

### About

This is a markdown file that becomes a live email client.

- Click a **sender name** to view the thread
- Click **Archive** to archive a message  
- Click **Refresh** to fetch new emails

[inbox]: !gmail inbox
[email_count]: !gmail count

[#archive-*]: !gmail archive $1
[#mark-read-*]: !gmail mark-read $1
[#refresh]: !gmail refresh
