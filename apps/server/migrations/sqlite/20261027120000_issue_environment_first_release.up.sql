-- The release an issue was first seen with in each environment: what makes it
-- a new issue of that release there, as Sentry's per-environment count
-- (`ReleaseProjectEnvironment.new_issues_count`). Kept here, not read from
-- events, so the count outlives retention.
ALTER TABLE issue_environments ADD COLUMN first_release VARCHAR(250) NOT NULL DEFAULT '';

-- What the writer would have kept, as far as retained events show it: the
-- issue's own first release, where the environment's earliest retained event
-- with a release has it. An issue that reached the environment on a later
-- release, even if it came back there on its first one, is not new there;
-- what retention already took is left unknown.
UPDATE issue_environments SET first_release = (
    SELECT issues.first_release FROM issues WHERE issues.id = issue_environments.issue_id
)
WHERE (
    SELECT events.release FROM events
    WHERE events.issue_id = issue_environments.issue_id
      AND events.environment = issue_environments.environment
      AND events.release <> ''
    ORDER BY events.ingested_at
    LIMIT 1
) = (
    SELECT issues.first_release FROM issues
    WHERE issues.id = issue_environments.issue_id AND issues.first_release <> ''
);
