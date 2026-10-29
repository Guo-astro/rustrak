---
"@rustrak/server": patch
---

The whole dashboard now reads and writes through TanStack Query, with one shared cache. Going back to a page shows it immediately and refreshes it in the background, saving a change refreshes every page that shows that data, and signing out or switching users empties the cache. Every page uses the same error screen with a retry. The Agents and Storage pages load without timing out on large databases. New partial indexes cover the Agents queries and the per-project count of standalone spans, a page of conversations reads its agent names in one query instead of one per row, and the Agents page defaults to the last 24 hours (`?period=all` shows everything). Storage figures are read at startup and refreshed in the background. GenAI model, agent and tool names are cut to 255 bytes, so spans with long multibyte names no longer fail to insert on PostgreSQL.
