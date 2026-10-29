-- Covers the agents traces list, which groups every AI span by trace: the
-- totals, the filters in its HAVING and the sort keys, all from the index.
--
-- One index per file to keep versions aligned with Postgres, where
-- CONCURRENTLY must be the only statement in its migration.

CREATE INDEX IF NOT EXISTS idx_spans_gen_ai_trace_cover
    ON spans (project_id, trace_id, gen_ai_operation_type, start_timestamp, environment, status, duration_ms, gen_ai_usage_total_tokens, gen_ai_agent_name, gen_ai_response_model, gen_ai_request_model, gen_ai_tool_name)
    WHERE gen_ai_operation_type IS NOT NULL AND trace_id IS NOT NULL;
