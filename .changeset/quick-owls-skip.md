---
"@rustrak/server": patch
---

The dashboard now responds to every click at once: each page shows its own skeleton while it loads, and changing a filter or a page keeps the current results on screen, dimmed, until the new ones arrive. A crontab monitor run that starts up to 10 seconds before its slot now fills that slot instead of marking it missed (@rookbreezy). Dependencies updated to their latest versions.
