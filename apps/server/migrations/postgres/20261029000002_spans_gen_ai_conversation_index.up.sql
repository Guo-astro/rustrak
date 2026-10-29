-- no-transaction
--
-- A conversation's turns: the traces carrying its `gen_ai.conversation.id`.
--
-- CONCURRENTLY so ingestion keeps writing while it builds; spans is the
-- hottest table.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_spans_gen_ai_conversation
    ON spans (project_id, gen_ai_conversation_id)
    INCLUDE (trace_id, start_timestamp, environment)
    WHERE gen_ai_conversation_id IS NOT NULL;
