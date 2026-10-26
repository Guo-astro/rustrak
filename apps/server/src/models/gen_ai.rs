//! Response models for the AI Agent Monitoring dashboard (story-ai-agent-monitoring.md, GH #180).

use chrono::{DateTime, Utc};
use serde::Serialize;

/// One time-bucketed value (count or sum) — mirrors `SessionTimeseriesPoint`.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AgentTimeseriesPoint {
    pub bucket: DateTime<Utc>,
    pub value: f64,
    /// Of the bucket's spans, those whose status is set and not `ok`.
    pub errors: i64,
}

/// avg/p95 duration for one time bucket.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AgentDurationPoint {
    pub bucket: DateTime<Utc>,
    pub avg_ms: f64,
    pub p95_ms: f64,
}

/// One row of a "top N by X" breakdown (model or tool name).
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct GenAiBreakdownRow {
    pub label: String,
    pub value: f64,
}

/// Headline numbers for the agents dashboard, over the selected window.
///
/// Token totals exclude `agent`-type spans throughout, for the same reason
/// the Traces table does: an agent span's usage is a client-side rollup of
/// its `ai_client` children, so counting both double-counts.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AgentSummary {
    pub agent_runs: i64,
    pub llm_calls: i64,
    pub tool_calls: i64,
    /// AI spans whose status is set and not `ok`.
    pub error_count: i64,
    pub total_tokens: f64,
    /// Over `agent` and `ai_client` spans — matching the Duration chart.
    pub avg_duration_ms: f64,
    pub p95_duration_ms: f64,
}

/// One row of the Models table: per response model, the volume, the failures,
/// the latency and the full token split.
///
/// Cached input and reasoning output are SUBSETS of input/output, not
/// additions — a reader comparing them must not add all four together.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AgentModelRow {
    pub model: String,
    pub requests: i64,
    pub errors: i64,
    pub avg_ms: f64,
    pub p95_ms: f64,
    pub input_tokens: f64,
    pub cached_input_tokens: f64,
    pub output_tokens: f64,
    pub reasoning_output_tokens: f64,
    pub total_tokens: f64,
}

/// One row of the Tools table: per tool, how often it ran and how often it
/// failed. A tool with a high failure rate is the most actionable signal the
/// agents page can carry.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AgentToolRow {
    pub tool: String,
    pub calls: i64,
    pub errors: i64,
    pub avg_ms: f64,
    pub p95_ms: f64,
}

/// One row of the Traces table — per-`trace_id` aggregate across all AI
/// spans (standalone and transaction-embedded) sharing that trace.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AgentTraceSummary {
    pub trace_id: String,
    /// Every distinct agent that ran in this trace, earliest first. A trace
    /// with handoffs involves more than one, so this is a list rather than a
    /// single root name — Sentry's own Traces table shows them all.
    pub agent_names: Vec<String>,
    /// Duration of the root/longest AI span in this trace, in milliseconds.
    #[cfg_attr(feature = "openapi", schema(required))]
    pub duration_ms: Option<f64>,
    pub total_tokens: f64,
    pub tool_call_count: i64,
    /// `ai_client` spans in this trace — how many times a model was actually
    /// called, which is what separates a one-shot answer from an agent loop.
    pub llm_call_count: i64,
    /// AI spans in this trace whose status is set and not `ok`.
    pub error_count: i64,
    pub started_at: DateTime<Utc>,
}

/// One conversation: every trace sharing a `gen_ai.conversation.id`, each a
/// turn, with the totals of all of them -- a row of Sentry's conversations.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AgentConversationSummary {
    pub conversation_id: String,
    /// Traces in the conversation.
    pub turn_count: i64,
    /// Every agent that ran in it, earliest first.
    pub agent_names: Vec<String>,
    pub llm_call_count: i64,
    pub tool_call_count: i64,
    /// `agent` spans excluded, as everywhere: their usage rolls up their children.
    pub total_tokens: f64,
    pub error_count: i64,
    pub first_seen: DateTime<Utc>,
    pub last_seen: DateTime<Utc>,
}

/// A conversation in full: its AI spans across every turn, oldest first,
/// each with what went in and came out, for a transcript.
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct AgentConversation {
    pub conversation_id: String,
    pub spans: Vec<ConversationSpan>,
}

#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
pub struct ConversationSpan {
    pub id: uuid::Uuid,
    pub trace_id: String,
    #[cfg_attr(feature = "openapi", schema(required))]
    pub span_id: Option<String>,
    #[cfg_attr(feature = "openapi", schema(required))]
    pub parent_span_id: Option<String>,
    /// `agent`, `ai_client`, `tool` or `handoff`.
    pub operation_type: String,
    #[cfg_attr(feature = "openapi", schema(required))]
    pub agent_name: Option<String>,
    /// The response model, else the request model.
    #[cfg_attr(feature = "openapi", schema(required))]
    pub model: Option<String>,
    #[cfg_attr(feature = "openapi", schema(required))]
    pub tool_name: Option<String>,
    #[cfg_attr(feature = "openapi", schema(required))]
    pub status: Option<String>,
    #[cfg_attr(feature = "openapi", schema(required))]
    pub start_timestamp: Option<DateTime<Utc>>,
    #[cfg_attr(feature = "openapi", schema(required))]
    pub duration_ms: Option<f64>,
    #[cfg_attr(feature = "openapi", schema(required))]
    pub total_tokens: Option<f64>,
    /// The prompt or the tool's arguments, verbatim.
    #[cfg_attr(feature = "openapi", schema(required))]
    pub input: Option<String>,
    /// The answer or the tool's result, verbatim.
    #[cfg_attr(feature = "openapi", schema(required))]
    pub output: Option<String>,
    /// The tool calls the model asked for.
    #[cfg_attr(feature = "openapi", schema(required))]
    pub tool_calls: Option<String>,
}
