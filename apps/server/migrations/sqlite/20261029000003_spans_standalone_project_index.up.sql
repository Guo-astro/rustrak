-- The storage figures count standalone spans per project; without this the
-- count reads the whole spans table.
--
-- One index per file to keep versions aligned with Postgres, where
-- CONCURRENTLY must be the only statement in its migration.

CREATE INDEX IF NOT EXISTS idx_spans_standalone_project
    ON spans (project_id)
    WHERE transaction_id IS NULL;
