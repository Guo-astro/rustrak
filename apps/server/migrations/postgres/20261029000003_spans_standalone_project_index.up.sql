-- no-transaction
--
-- The storage figures count standalone spans per project; without this the
-- count reads the whole spans table.
--
-- CONCURRENTLY so ingestion keeps writing while it builds; spans is the
-- hottest table.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_spans_standalone_project
    ON spans (project_id)
    WHERE transaction_id IS NULL;
