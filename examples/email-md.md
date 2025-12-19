---
tools:
  gmail: ../cli-tools/gmail-cli

state: ./email-state.json
---

{% if view.size > 0 %}

{{ thread }}

{% else %}

# Inbox

{% for acc in accounts %}[{{ acc.label }}](?account={{ acc.email }}) {% endfor %}

{{ inbox }}

[Load more](?limit={{ limit | plus: 10 }}) · [Refresh](#refresh)

---

{{ email_count }} unread

{% endif %}

[inbox]: !gmail inbox
[thread]: !gmail thread {{ view }}
[email_count]: !gmail count

[#archive-*]: !gmail archive $1
[#mark-read-*]: !gmail mark-read $1
[#refresh]: !gmail refresh
