-- The release an issue was first seen with in each environment: what makes it
-- a new issue of that release there, as Sentry's per-environment count
-- (`ReleaseProjectEnvironment.new_issues_count`). Kept here, not read from
-- events, so the count outlives retention.
ALTER TABLE issue_environments ADD COLUMN first_release VARCHAR(250) NOT NULL DEFAULT '';

-- What the count read from events until now, frozen: the issue's own first
-- release, where a retained event shows it in the environment. Never the
-- earliest retained event's release, which may be a later one; what
-- retention already took is left unknown.
UPDATE issue_environments SET first_release = (
    SELECT issues.first_release FROM issues WHERE issues.id = issue_environments.issue_id
)
WHERE EXISTS (
    SELECT 1 FROM events JOIN issues ON issues.id = events.issue_id
    WHERE events.issue_id = issue_environments.issue_id
      AND events.environment = issue_environments.environment
      AND issues.first_release <> ''
      AND events.release = issues.first_release
);
