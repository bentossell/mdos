---
tools:
  email: ../cli-tools/email-cli
  tasks: ../cli-tools/tasks-cli
  metrics: ../cli-tools/metrics-cli

state: ./state.json

# Cache widget results to avoid repeated CLI calls
cache:
  email_count: 30s     # Cache for 30 seconds
  inbox_list: 1m       # Cache for 1 minute
  task_count: 30s
  task_list: 1m
  metrics_summary: 2m  # Cache for 2 minutes
  metrics_alerts: 5m   # Cache for 5 minutes
---

# My Personal OS (Cached)

Last updated: {{ state.last_action_time }}

## 📬 Inbox

You have **{{ email_count }}** unread emails

{{ inbox_list }}

[Mark All Read](#mark-all-read) [Archive Old](#archive-old)

## ✅ Tasks

Active tasks: **{{ task_count }}**

{{ task_list }}

[New Task](#new-task) [Complete Task](#complete-task)

## 📊 Metrics

{{ metrics_summary }}

{{ metrics_alerts }}

[Refresh Metrics](#refresh-metrics)

---

[email_count]: !email count
[inbox_list]: !email inbox
[task_count]: !tasks count
[task_list]: !tasks list
[metrics_summary]: !metrics summary
[metrics_alerts]: !metrics alerts

[#mark-all-read]: !email mark-all-read
[#archive-old]: !email archive-old
[#new-task]: !tasks create "New feature request"
[#complete-task]: !tasks complete
[#refresh-metrics]: !metrics summary
