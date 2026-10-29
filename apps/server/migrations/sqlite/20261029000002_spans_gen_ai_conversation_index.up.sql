-- A conversation's turns: the traces carrying its `gen_ai.conversation.id`.
--
-- One index per file to keep versions aligned with Postgres, where
-- CONCURRENTLY must be the only statement in its migration.

CREATE INDEX IF NOT EXISTS idx_spans_gen_ai_conversation
    ON spans (project_id, gen_ai_conversation_id, trace_id, start_timestamp, environment)
    WHERE gen_ai_conversation_id IS NOT NULL;
