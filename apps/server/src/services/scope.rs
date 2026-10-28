//! What a page's filters narrow a read to: the project overview's
//! environment and release, applied the same way to events, issues and
//! sessions so every panel answers for the same slice.

/// Both unset is the whole project.
#[derive(Debug, Default, Clone, Copy)]
pub struct Scope<'a> {
    /// Only what happened in this environment.
    pub environment: Option<&'a str>,
    /// Only what happened in this release.
    pub release: Option<&'a str>,
}

impl<'a> Scope<'a> {
    pub fn environment(environment: Option<&'a str>) -> Self {
        Self {
            environment,
            release: None,
        }
    }
}

/// `column` falls in the last `hours`, as a SQL condition; true without a
/// window. `hours` is a parsed integer, never request text.
pub(crate) fn since(column: &str, hours: Option<i64>) -> String {
    let Some(hours) = hours else {
        return "1 = 1".to_string();
    };
    #[cfg(feature = "postgres")]
    return format!("{column} >= NOW() - INTERVAL '{hours} hours'");
    #[cfg(not(feature = "postgres"))]
    return format!("datetime({column}) >= datetime('now', '-{hours} hours')");
}

/// [`since`] for a `DATE` column.
pub(crate) fn since_day(column: &str, hours: Option<i64>) -> String {
    let Some(hours) = hours else {
        return "1 = 1".to_string();
    };
    #[cfg(feature = "postgres")]
    return format!("{column} >= (NOW() - INTERVAL '{hours} hours')::date");
    #[cfg(not(feature = "postgres"))]
    return format!("{column} >= date('now', '-{hours} hours')");
}

/// Bucket width for a window, in hours: about 24 to 60 buckets for any of
/// the dashboard's windows.
pub(crate) fn bucket_hours(period_hours: i64) -> i64 {
    match period_hours {
        ..=24 => 1,
        25..=168 => 3,
        169..=336 => 6,
        337..=720 => 12,
        _ => 24,
    }
}

/// A search as a case-insensitive `LIKE ... ESCAPE '\'` pattern, its own
/// `%`, `_` and `\` taken literally. `None` for a blank search.
///
/// Lowered by the same rules as the column's `LOWER()`: Unicode on Postgres,
/// ASCII only on SQLite, where `É` stays `É` on both sides and still matches.
// ponytail: on SQLite `échec` does not find `Échec`; that takes the ICU
// extension's `LOWER()`.
pub(crate) fn like_pattern(query: Option<&str>) -> Option<String> {
    let query = query?.trim();
    #[cfg(feature = "postgres")]
    let query = query.to_lowercase();
    #[cfg(not(feature = "postgres"))]
    let query = query.to_ascii_lowercase();
    if query.is_empty() {
        return None;
    }
    let escaped = query
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_");
    Some(format!("%{escaped}%"))
}
