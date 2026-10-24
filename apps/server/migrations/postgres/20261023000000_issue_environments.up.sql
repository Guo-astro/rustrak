-- Where each issue has been seen: Sentry's `GroupEnvironment`, with the
-- numbers Sentry reads from Snuba for an environment. Kept at digest time,
-- so listing by environment never scans events. An event with no
-- environment adds no row, as Sentry lists no "" environment.
CREATE TABLE issue_environments (
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    environment VARCHAR(64) NOT NULL,
    first_seen TIMESTAMPTZ NOT NULL,
    last_seen TIMESTAMPTZ NOT NULL,
    event_count INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (issue_id, environment)
);
CREATE INDEX idx_issue_environments_project ON issue_environments(project_id, environment);

-- From the events retention has kept: an older issue counts only those.
INSERT INTO issue_environments (issue_id, project_id, environment, first_seen, last_seen, event_count)
SELECT issue_id, project_id, environment, MIN(ingested_at), MAX(ingested_at), COUNT(*)
FROM events
WHERE environment <> ''
GROUP BY issue_id, project_id, environment;
