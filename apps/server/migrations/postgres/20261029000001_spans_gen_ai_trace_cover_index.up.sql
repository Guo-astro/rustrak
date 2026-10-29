-- no-transaction
--
-- Covers the agents traces list, which groups every AI span by trace: the
-- totals, the filters in its HAVING and the sort keys, all from the index.
--
-- CONCURRENTLY so ingestion keeps writing while it builds; spans is the
-- hottest table.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_spans_gen_ai_trace_cover
    ON spans (project_id, trace_id)
    INCLUDE (gen_ai_operation_type, start_timestamp, environment, status, duration_ms, gen_ai_usage_total_tokens, gen_ai_agent_name, gen_ai_response_model, gen_ai_request_model, gen_ai_tool_name)
    WHERE gen_ai_operation_type IS NOT NULL AND trace_id IS NOT NULL;
