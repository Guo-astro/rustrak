-- Covers every agents aggregate over a window (summary, timeseries, models,
-- tools, environments): read from the index, never from rows whose `data`
-- holds whole prompts. `start_timestamp` right after the operation type is
-- what lets a window narrow the read at all.
--
-- One index per file to keep versions aligned with Postgres, where
-- CONCURRENTLY must be the only statement in its migration.

CREATE INDEX IF NOT EXISTS idx_spans_gen_ai_window
    ON spans (project_id, gen_ai_operation_type, start_timestamp, environment, status, duration_ms, gen_ai_usage_total_tokens, gen_ai_usage_input_tokens, gen_ai_usage_cached_input_tokens, gen_ai_usage_output_tokens, gen_ai_usage_reasoning_output_tokens, gen_ai_response_model, gen_ai_request_model, gen_ai_tool_name)
    WHERE gen_ai_operation_type IS NOT NULL;
