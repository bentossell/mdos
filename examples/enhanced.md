---
tools:
  date: date

state: ./enhanced-state.json
---

# Markdown Enhancements Demo

## Checkboxes

Tasks for today:

- [ ] Review pull requests
- [x] Ship new feature
- [ ] Update documentation
- [!] Fix critical bug (urgent!)
- [x] Team meeting (completed)

## Lists with Actions

Recent emails:

- Meeting invite from Sarah (10m ago) [Archive](#archive-1) [Reply](#reply-1)
- PR review request (1h ago) [View](#view-2) [Archive](#archive-2)
- Newsletter from Dev.to (2h ago) [Archive](#archive-3)
- Security alert (5m ago) [Acknowledge](#ack-4) [View](#view-4)

## Wiki-Style Links

Navigate to other pages:

- [[inbox]] - Check your email
- [[tasks|My Tasks]] - View todo list
- [[settings]] - Configure app

## Time Display

Current time: {{ current_time }}

---

[current_time]: !date +%H:%M:%S

[#archive-*]: !echo "Archived $1"
[#reply-*]: !echo "Replying to $1"
[#view-*]: !echo "Viewing $1"
[#ack-*]: !echo "Acknowledged $1"
