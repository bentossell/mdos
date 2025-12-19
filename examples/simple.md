---
tools:
  date: date
  echo: echo

state: ./simple-state.json
---

# Simple Example

Current time: {{ current_time }}

Last action: {{ state.last_action }}

[Get Time](#get-time) [Say Hello](#say-hello)

---

[current_time]: !date +%H:%M:%S

[#get-time]: !date
[#say-hello]: !echo "Hello from Markdown OS!"
