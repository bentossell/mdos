---
tools:
  gmail: ../cli-tools/gmail-cli
---

# Benbox

{% if view != "" %}
{{ thread }}
{% else %}
{{ inbox }}
{% endif %}

[inbox]: !gmail inbox --format=terminal
[thread]: !gmail thread {{ view }}
[#archive-*]: !gmail archive $1
[#mark-read-*]: !gmail mark-read $1
