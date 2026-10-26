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
