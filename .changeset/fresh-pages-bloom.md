---
"@rustrak/server": "minor"
---

The dashboard is redesigned end to end on `@rustrak/ui`: projects, settings with integrations as their own pages, overview, issues, issue detail, user feedback, releases, performance, logs, crons, agents, alerts, the login and the command bar. The server gains the endpoints behind it (one log and log volume, agent conversations, releases with per-environment new issues and session health, monitor stats, an endpoint's trend, alert deliveries per day), projects can turn products off and reorder them, and a project can hold several alert rules for one trigger.