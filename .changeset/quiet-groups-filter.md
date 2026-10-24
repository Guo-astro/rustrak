---
"@rustrak/server": minor
---

SSO can map OIDC groups to the global admin role (`OIDC_GROUPS_CLAIM`, `OIDC_ADMIN_GROUPS`) and can be made the only way to sign in (`OIDC_DISABLE_PASSWORD_LOGIN`), with the first account kept as a break-glass (@GhaziBenDahmane). Issues and events can be filtered by environment through `?environment=`, `GET /api/projects/{id}/environments` and `environment:` in the Sentry-compatible search, and a stray quote in a search no longer swallows the filters after it. On SQLite, a storage cleanup now gives the freed space back to the disk (@chrisedington), and a database created before this release can be compacted once from the Storage page. Signing in returns to the page that asked for it, including through SSO (@chrisedington), and project keys carried over from Sentry that are not RFC 4122 UUIDs are accepted (@chrisedington).
