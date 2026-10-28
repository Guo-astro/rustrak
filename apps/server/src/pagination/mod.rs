pub mod cursor;

pub use cursor::{EventCursor, IssueCursor, TransactionCursor};

use serde::{Deserialize, Serialize};

/// Default page size for pagination
pub const PAGE_SIZE: i64 = 20;

/// The rows before a 1-indexed `page`. `page` comes from the query string, so
/// a page below 1 is the first and one past any offset saturates: an empty
/// page rather than an overflow or a negative `OFFSET`.
pub fn offset(page: i64, per_page: i64) -> i64 {
    page.max(1)
        .saturating_sub(1)
        .saturating_mul(per_page.max(0))
}

/// Paginated response wrapper (cursor-based)
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[cfg_attr(feature = "openapi", schema(bound = "T: utoipa::ToSchema"))]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
    pub has_more: bool,
}

impl<T> PaginatedResponse<T> {
    pub fn new(items: Vec<T>, next_cursor: Option<String>, has_more: bool) -> Self {
        Self {
            items,
            next_cursor,
            has_more,
        }
    }
}

/// Offset-based paginated response wrapper
#[derive(Debug, Serialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[cfg_attr(feature = "openapi", schema(bound = "T: utoipa::ToSchema"))]
pub struct OffsetPaginatedResponse<T> {
    pub items: Vec<T>,
    pub total_count: i64,
    pub page: i64,
    pub per_page: i64,
    pub total_pages: i64,
}

impl<T> OffsetPaginatedResponse<T> {
    pub fn new(items: Vec<T>, total_count: i64, page: i64, per_page: i64) -> Self {
        let per_page = per_page.max(1);
        let total_pages = total_count.saturating_add(per_page - 1) / per_page;
        Self {
            items,
            total_count,
            page,
            per_page,
            total_pages,
        }
    }
}

/// Sort mode for issues listing
#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum IssueSort {
    /// Sort by digest_order (stable, unique per project)
    #[default]
    DigestOrder,
    /// Sort by last_seen (activity-based, may reorder)
    LastSeen,
    /// Sort by digested_event_count (most/least frequent issues)
    EventCount,
    /// Sort by first_seen (newest or oldest issues)
    FirstSeen,
    /// Sort by priority: high, then medium, then low
    Priority,
}

impl IssueSort {
    pub fn as_str(&self) -> &'static str {
        match self {
            IssueSort::DigestOrder => "digest_order",
            IssueSort::LastSeen => "last_seen",
            IssueSort::EventCount => "event_count",
            IssueSort::FirstSeen => "first_seen",
            IssueSort::Priority => "priority",
        }
    }
}

impl std::fmt::Display for IssueSort {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Sort order direction
#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "lowercase")]
pub enum SortOrder {
    Asc,
    #[default]
    Desc,
}

impl SortOrder {
    pub fn as_str(&self) -> &'static str {
        match self {
            SortOrder::Asc => "asc",
            SortOrder::Desc => "desc",
        }
    }

    #[allow(dead_code)] // Utility method for future use
    pub fn is_desc(&self) -> bool {
        matches!(self, SortOrder::Desc)
    }
}

impl std::fmt::Display for SortOrder {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

/// Query parameters for listing issues (offset-based)
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::IntoParams))]
pub struct ListIssuesQuery {
    /// Page number (1-indexed, default: 1)
    #[serde(default = "default_page")]
    #[cfg_attr(feature = "openapi", param(minimum = 1))]
    pub page: i64,

    /// Items per page (default: 20, max: 100)
    #[serde(default = "default_per_page")]
    #[cfg_attr(feature = "openapi", param(minimum = 1, maximum = 100))]
    pub per_page: i64,

    /// Sort mode (default: last_seen)
    #[serde(default)]
    pub sort: IssueSort,

    /// Sort order direction (default: desc)
    #[serde(default)]
    pub order: SortOrder,

    /// Filter: open (not resolved, not muted), resolved, muted, all
    #[serde(default)]
    pub filter: IssueFilter,

    /// Issue category: error (default) or feedback
    #[serde(default)]
    pub category: IssueCategory,

    /// Free-text search across type, value, transaction, and culprit.
    #[serde(default)]
    pub q: Option<String>,

    /// Only issues seen in this environment, with that environment's first
    /// and last seen, event count, users and trend.
    #[serde(default)]
    pub environment: Option<String>,

    /// Only issues that had an event in this release.
    #[serde(default)]
    pub release: Option<String>,

    /// Only these levels, comma-separated: `fatal,error`.
    #[serde(default)]
    pub level: Option<String>,

    /// Only these priorities, comma-separated: `high,medium`.
    #[serde(default)]
    pub priority: Option<String>,

    /// `none` for unassigned issues, or a user id.
    #[serde(default)]
    pub assigned: Option<String>,

    /// Only issues first seen within this window: `24h`, `7d`.
    #[serde(default)]
    pub first_seen: Option<String>,

    /// Only issues last seen within this window: `24h`, `7d`.
    #[serde(default)]
    pub last_seen: Option<String>,

    /// Only issues with at least this many events.
    #[serde(default)]
    pub events_min: Option<i64>,

    /// Only issues with at most this many events.
    #[serde(default)]
    pub events_max: Option<i64>,
}

impl ListIssuesQuery {
    /// The table's narrowing filters, read out of the query string. A value
    /// that does not parse narrows nothing rather than failing the list.
    pub fn issue_filters(&self) -> crate::services::issue::IssueFilters {
        let list = |raw: &Option<String>| -> Vec<String> {
            raw.as_deref()
                .unwrap_or("")
                .split(',')
                .map(str::trim)
                .filter(|v| !v.is_empty())
                .map(str::to_string)
                .collect()
        };
        let period = |raw: &Option<String>| {
            raw.as_deref()
                .and_then(|p| crate::routes::period::parse_period_hours(Some(p)))
        };
        crate::services::issue::IssueFilters {
            levels: list(&self.level),
            priorities: list(&self.priority),
            assigned: match self.assigned.as_deref() {
                Some("none") => Some(crate::services::issue::Assignee::Nobody),
                Some(id) => id.parse().ok().map(crate::services::issue::Assignee::User),
                None => None,
            },
            first_seen_hours: period(&self.first_seen),
            last_seen_hours: period(&self.last_seen),
            events_min: self.events_min,
            events_max: self.events_max,
        }
    }
}

fn default_page() -> i64 {
    1
}

fn default_per_page() -> i64 {
    PAGE_SIZE
}

/// Filter for issues listing
#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum IssueFilter {
    /// Only open issues (not resolved and not muted)
    #[default]
    Open,
    /// Only resolved issues
    Resolved,
    /// Only muted issues
    Muted,
    /// All issues
    All,
}

/// Which kind of issue a list shows. Feedback is kept out of the default
/// list, as Sentry's `FeedbackGroup` is (`in_default_search=False`).
#[derive(Debug, Clone, Copy, Default, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum IssueCategory {
    /// Issues grouped from error events
    #[default]
    Error,
    /// User feedback, one issue per submission
    Feedback,
}

impl IssueCategory {
    /// The `issues.issue_category` value; also trusted SQL.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Error => "error",
            Self::Feedback => "feedback",
        }
    }
}

/// Query parameters for listing transactions (offset-based)
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::IntoParams))]
pub struct ListTransactionsQuery {
    /// Page number (1-indexed, default: 1)
    #[serde(default = "default_page")]
    #[cfg_attr(feature = "openapi", param(minimum = 1))]
    pub page: i64,

    /// Items per page (default: 20, max: 100)
    #[serde(default = "default_per_page")]
    #[cfg_attr(feature = "openapi", param(minimum = 1, maximum = 100))]
    pub per_page: i64,

    /// Filter by exact transaction name (lists one group's samples).
    pub name: Option<String>,

    /// Filter by trace operation (contexts.trace.op), e.g. `http.server`.
    pub op: Option<String>,

    /// Filter by trace status (contexts.trace.status), e.g. `ok`.
    pub status: Option<String>,

    /// Filter by environment.
    pub environment: Option<String>,

    /// Filter by release.
    pub release: Option<String>,

    /// Only this window (`24h`, `7d`, `14d`...); all time if absent.
    pub period: Option<String>,

    /// `slowest` for the longest first; newest first otherwise.
    #[cfg_attr(feature = "openapi", param(inline))]
    pub sort: Option<TransactionListSort>,
}

/// The order of a transaction list.
#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "openapi", derive(utoipa::ToSchema))]
#[serde(rename_all = "snake_case")]
pub enum TransactionListSort {
    Recent,
    Slowest,
}

/// Query parameters for listing logs (offset-based)
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::IntoParams))]
pub struct ListLogsQuery {
    /// Page number (1-indexed, default: 1)
    #[serde(default = "default_page")]
    #[cfg_attr(feature = "openapi", param(minimum = 1))]
    pub page: i64,

    /// Items per page (default: 20, max: 100)
    #[serde(default = "default_per_page")]
    #[cfg_attr(feature = "openapi", param(minimum = 1, maximum = 100))]
    pub per_page: i64,

    /// Filter by log level (trace/debug/info/warn/error/fatal).
    pub level: Option<String>,

    /// Filter by trace id.
    pub trace_id: Option<String>,

    /// Only the logs whose message contains this, ignoring case.
    pub query: Option<String>,

    /// Only this window (`24h`, `7d`, `14d`...); all time if absent.
    pub period: Option<String>,
}

impl ListLogsQuery {
    pub fn filters(&self) -> crate::services::log::LogFilters {
        crate::services::log::LogFilters {
            level: self.level.clone().filter(|l| !l.is_empty()),
            trace_id: self.trace_id.clone().filter(|t| !t.is_empty()),
            query: self.query.clone(),
            period_hours: crate::routes::period::parse_period_hours(self.period.as_deref()),
        }
    }
}

/// Query parameters for the log volume: the list's filters, no page.
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::IntoParams))]
pub struct LogVolumeQuery {
    /// Filter by log level (trace/debug/info/warn/error/fatal).
    pub level: Option<String>,

    /// Filter by trace id.
    pub trace_id: Option<String>,

    /// Only the logs whose message contains this, ignoring case.
    pub query: Option<String>,

    /// Only this window (`24h`, `7d`, `14d`...); since the oldest log if absent.
    pub period: Option<String>,
}

impl LogVolumeQuery {
    pub fn filters(&self) -> crate::services::log::LogFilters {
        crate::services::log::LogFilters {
            level: self.level.clone().filter(|l| !l.is_empty()),
            trace_id: self.trace_id.clone().filter(|t| !t.is_empty()),
            query: self.query.clone(),
            period_hours: crate::routes::period::parse_period_hours(self.period.as_deref()),
        }
    }
}

/// Query parameters for listing spans (offset-based)
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::IntoParams))]
pub struct ListSpansQuery {
    /// Page number (1-indexed, default: 1)
    #[serde(default = "default_page")]
    #[cfg_attr(feature = "openapi", param(minimum = 1))]
    pub page: i64,

    /// Items per page (default: 20, max: 100)
    #[serde(default = "default_per_page")]
    #[cfg_attr(feature = "openapi", param(minimum = 1, maximum = 100))]
    pub per_page: i64,

    /// Filter by span operation, e.g. `http.client`.
    pub op: Option<String>,

    /// Filter by span status.
    pub status: Option<String>,

    /// Filter by trace id — matches spans regardless of origin (standalone
    /// or extracted from a transaction), since both share this table.
    pub trace_id: Option<String>,

    /// Filter by gen_ai.operation.type
    /// (`agent`/`tool`/`handoff`/`ai_client`/`other`).
    pub operation_type: Option<String>,
}

/// Query parameters for AI Agent Monitoring time-series widgets (Agent Runs,
/// Estimated Cost, Duration).
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::IntoParams))]
pub struct AgentTimeseriesQuery {
    /// Lookback window in hours (default: all time, no filter).
    pub period_hours: Option<i64>,

    /// Restrict to spans reporting this environment (default: all).
    pub environment: Option<String>,

    /// Bucket width in hours (default: 1).
    #[serde(default = "default_interval_hours")]
    #[cfg_attr(feature = "openapi", param(minimum = 1))]
    pub interval_hours: i64,
}

fn default_interval_hours() -> i64 {
    1
}

/// Query parameters for AI Agent Monitoring breakdown widgets (LLM Calls by
/// Model, Tokens Used by Model, Tool Calls by Tool).
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::IntoParams))]
pub struct AgentBreakdownQuery {
    /// Lookback window in hours (default: all time, no filter).
    pub period_hours: Option<i64>,

    /// Restrict to spans reporting this environment (default: all).
    pub environment: Option<String>,

    /// Max rows returned (default: 3, matching Sentry's own widget cap).
    #[serde(default = "default_breakdown_limit")]
    #[cfg_attr(feature = "openapi", param(minimum = 1, maximum = 100))]
    pub limit: i64,
}

fn default_breakdown_limit() -> i64 {
    3
}

/// Query parameters for the agents-dashboard aggregates that return a whole
/// table rather than a top-N slice: summary, models, tools/stats.
///
/// Deliberately not `AgentBreakdownQuery`: that one carries `limit`, which
/// these endpoints have no way to honour, and reusing it published a
/// documented parameter they silently ignored.
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::IntoParams))]
pub struct AgentWindowQuery {
    /// Lookback window in hours (default: all time, no filter).
    pub period_hours: Option<i64>,

    /// Restrict to spans reporting this environment (default: all).
    pub environment: Option<String>,
}

/// Query parameters for the AI Agent Monitoring Traces table (offset-based).
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::IntoParams))]
pub struct AgentTracesQuery {
    /// Lookback window in hours (default: all time, no filter). The dashboard
    /// applies one window to every widget, and this table is one of them.
    pub period_hours: Option<i64>,

    /// Restrict to spans reporting this environment (default: all).
    pub environment: Option<String>,

    /// Page number (1-indexed, default: 1)
    #[serde(default = "default_page")]
    #[cfg_attr(feature = "openapi", param(minimum = 1))]
    pub page: i64,

    /// Items per page (default: 20, max: 100)
    #[serde(default = "default_per_page")]
    #[cfg_attr(feature = "openapi", param(minimum = 1, maximum = 100))]
    pub per_page: i64,
}

/// Query parameters for the transaction stats overview (offset-based)
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::IntoParams))]
pub struct TransactionStatsQuery {
    /// Page number (1-indexed, default: 1)
    #[serde(default = "default_page")]
    #[cfg_attr(feature = "openapi", param(minimum = 1))]
    pub page: i64,

    /// Items per page (default: 20, max: 100)
    #[serde(default = "default_per_page")]
    #[cfg_attr(feature = "openapi", param(minimum = 1, maximum = 100))]
    pub per_page: i64,

    /// Only this environment.
    pub environment: Option<String>,

    /// Only this window (`24h`, `7d`, `14d`...); all time if absent.
    pub period: Option<String>,

    /// Only the endpoints whose name contains this, ignoring case.
    pub query: Option<String>,

    /// How to rank them; most time spent in all by default.
    #[serde(default)]
    #[cfg_attr(feature = "openapi", param(inline))]
    pub sort: crate::services::transaction::StatsSort,
}

impl TransactionStatsQuery {
    pub fn filter(&self) -> crate::services::transaction::StatsFilter {
        crate::services::transaction::StatsFilter {
            environment: self.environment.clone().filter(|e| !e.is_empty()),
            period_hours: crate::routes::period::parse_period_hours(self.period.as_deref()),
            query: self.query.clone(),
            sort: self.sort,
        }
    }
}

/// Query parameters for a single transaction group's aggregate stats.
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::IntoParams))]
pub struct TransactionStatGroupQuery {
    /// Exact transaction name of the group.
    pub name: String,
    /// Trace operation of the group (omit for groups with no op).
    pub op: Option<String>,
    /// Only this environment.
    pub environment: Option<String>,
    /// Only this window (`24h`, `7d`, `14d`...); all time if absent.
    pub period: Option<String>,
}

impl TransactionStatGroupQuery {
    pub fn filter(&self) -> crate::services::transaction::StatsFilter {
        crate::services::transaction::StatsFilter {
            environment: self.environment.clone().filter(|e| !e.is_empty()),
            period_hours: crate::routes::period::parse_period_hours(self.period.as_deref()),
            ..Default::default()
        }
    }
}

/// Query parameters for listing events
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::IntoParams))]
pub struct ListEventsQuery {
    /// Sort order direction (default: desc = newest first)
    #[serde(default)]
    pub order: SortOrder,

    /// Pagination cursor
    pub cursor: Option<String>,

    /// Only events in this environment.
    #[serde(default)]
    pub environment: Option<String>,
}

/// Query parameters for listing projects (offset-based)
#[derive(Debug, Deserialize)]
#[cfg_attr(feature = "openapi", derive(utoipa::IntoParams))]
pub struct ListProjectsQuery {
    /// Page number (1-indexed, default: 1)
    #[serde(default = "default_page")]
    #[cfg_attr(feature = "openapi", param(minimum = 1))]
    pub page: i64,

    /// Items per page (default: 20, max: 100)
    #[serde(default = "default_per_page")]
    #[cfg_attr(feature = "openapi", param(minimum = 1, maximum = 100))]
    pub per_page: i64,

    /// Sort order direction (default: desc = newest first)
    #[serde(default)]
    pub order: SortOrder,

    /// Window for the per-project stats on each row (e.g. `24h`, `7d`).
    ///
    /// Omitted means the caller does not want stats at all, and the extra
    /// aggregate queries are skipped entirely — this is what keeps the plain
    /// `GET /api/projects` that SDK tooling and the project picker use as
    /// cheap as it was before the list table grew a sparkline. Sentry's own
    /// projects endpoint gates its `stats` field on `?statsPeriod=` the same
    /// way.
    #[serde(default)]
    pub stats_period: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::offset;

    #[test]
    fn offset_skips_the_pages_before() {
        assert_eq!(offset(1, 25), 0);
        assert_eq!(offset(3, 25), 50);
    }

    #[test]
    fn offset_never_goes_negative_or_overflows() {
        assert_eq!(offset(0, 25), 0);
        assert_eq!(offset(-5, 25), 0);
        assert_eq!(offset(i64::MAX, 100), i64::MAX);
    }
}
