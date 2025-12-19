---
tools:
  email: ../cli-tools/gmail-cli
  tasks: ../cli-tools/tasks-cli
  metrics: ../cli-tools/metrics-cli

state: ./state.json

refresh: 30
---

# My Personal OS

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
