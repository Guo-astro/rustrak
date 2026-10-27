-- The release an issue was first seen with in each environment: what makes it
-- a new issue of that release there, as Sentry's per-environment count
-- (`ReleaseProjectEnvironment.new_issues_count`). Kept here, not read from
-- events, so the count outlives retention.
ALTER TABLE issue_environments ADD COLUMN first_release VARCHAR(250) NOT NULL DEFAULT '';

-- From the events retention has kept: the first one there with a release.
UPDATE issue_environments SET first_release = COALESCE((
    SELECT release FROM events
    WHERE events.issue_id = issue_environments.issue_id
      AND events.environment = issue_environments.environment
      AND events.release <> ''
    ORDER BY events.ingested_at
    LIMIT 1
), '');
