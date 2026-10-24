//! Debug information files: what a `difs/assemble` job turns into.
//!
//! Detection follows Sentry's `detect_dif_from_path`
//! (`src/sentry/models/debugfile.py`, 2458718b2c): a ProGuard mapping is
//! known by its name, which carries its UUID; anything else must parse as a
//! known format: JVM source bundles and Apple Mach-O debug files for now.

use std::sync::LazyLock;

use uuid::Uuid;

use crate::db::DbPool;
use crate::error::{AppError, AppResult};
use crate::services::jvm::{
    build_proguard_cache, PROGUARD_CACHE_FILE_TYPE, PROGUARD_FILE_TYPE, SOURCE_BUNDLE_FILE_TYPE,
};
use crate::services::native::{MACHO_FILE_TYPE, SYMCACHE_FILE_TYPE};
use crate::services::sourcemap::{finish_job, join_chunks, store_file};
use crate::services::sourcemap_store::SourceMapStore;

/// Sentry's `_proguard_file_re`.
static PROGUARD_NAME: LazyLock<fancy_regex::Regex> = LazyLock::new(|| {
    fancy_regex::Regex::new(r"/proguard/(?:mapping-)?(.*?)\.txt$").expect("valid regex")
});

/// The UUID a ProGuard mapping's name carries (`.../proguard/<uuid>.txt` or
/// `.../proguard/mapping-<uuid>.txt`).
pub fn proguard_uuid_from_name(name: &str) -> Option<Uuid> {
    let caps = PROGUARD_NAME.captures(name).ok().flatten()?;
    Uuid::parse_str(caps.get(1)?.as_str()).ok()
}

/// Assembles a worker-owned DIF job, storing what it turns out to be and
/// committing the job's terminal state with it.
pub async fn assemble_dif_for_job(
    pool: &DbPool,
    store: &dyn SourceMapStore,
    job: &crate::models::source_file::AssemblyJob,
    max_size_bytes: usize,
) -> AppResult<()> {
    let data = join_chunks(pool, job.chunk_list(), max_size_bytes, &job.bundle_checksum).await?;
    let name = job.name.as_deref().unwrap_or_default();

    let files: Vec<(Uuid, &str, Vec<u8>)> = if let Some(uuid) = proguard_uuid_from_name(name) {
        // ponytail: the cache build peaks at ~40x the mapping's size in RAM;
        // the single assembly worker builds one at a time.
        let (data, cache) = tokio::task::spawn_blocking(move || {
            let cache = build_proguard_cache(&data);
            (data, cache)
        })
        .await
        .map_err(|e| AppError::Internal(format!("proguard cache build panicked: {e}")))?;
        let cache = cache.map_err(AppError::Validation)?;
        vec![
            (uuid, PROGUARD_FILE_TYPE, data),
            (uuid, PROGUARD_CACHE_FILE_TYPE, cache),
        ]
    } else if data.starts_with(b"SYSB") {
        let uuid = source_bundle_debug_id(&data)
            .or_else(|| {
                job.debug_id
                    .as_deref()
                    .and_then(|id| Uuid::parse_str(id).ok())
            })
            .ok_or_else(|| AppError::Validation("source bundle has no debug ID".into()))?;
        vec![(uuid, SOURCE_BUNDLE_FILE_TYPE, data)]
    } else if crate::services::native::is_macho(&data) {
        // The raw file is kept too, as with ProGuard, so a cache can be rebuilt.
        let (data, caches) = tokio::task::spawn_blocking(move || {
            let caches = crate::services::native::build_symcaches(&data);
            (data, caches)
        })
        .await
        .map_err(|e| AppError::Internal(format!("symcache build panicked: {e}")))?;
        let caches = caches.map_err(AppError::Validation)?;
        caches
            .into_iter()
            .flat_map(|(uuid, cache)| {
                [
                    (uuid, MACHO_FILE_TYPE, data.clone()),
                    (uuid, SYMCACHE_FILE_TYPE, cache),
                ]
            })
            .collect()
    } else {
        return Err(AppError::Validation(format!(
            "unsupported debug information file: {name}"
        )));
    };

    let mut tx = pool.begin().await?;
    for (uuid, file_type, bytes) in files {
        store_file(&mut tx, store, job.project_id, uuid, file_type, bytes).await?;
    }
    finish_job(&mut tx, Some(job.id), job.chunk_list()).await?;
    tx.commit().await?;
    Ok(())
}

/// The `debug_id` a source bundle's `manifest.json` declares.
fn source_bundle_debug_id(data: &[u8]) -> Option<Uuid> {
    use std::io::Read as _;
    // The zip's offsets count the 8-byte header, so it opens over all of it.
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(data)).ok()?;
    let mut manifest = String::new();
    archive
        .by_name("manifest.json")
        .ok()?
        .read_to_string(&mut manifest)
        .ok()?;
    let manifest: serde_json::Value = serde_json::from_str(&manifest).ok()?;
    Uuid::parse_str(manifest["debug_id"].as_str()?).ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn proguard_names_carry_the_uuid() {
        let uuid = "11111111-2222-3333-4444-555555555555";
        for name in [
            format!("/proguard/{uuid}.txt"),
            format!("/proguard/mapping-{uuid}.txt"),
            format!("x/proguard/{uuid}.txt"),
        ] {
            assert_eq!(
                proguard_uuid_from_name(&name).map(|u| u.to_string()),
                Some(uuid.to_string()),
                "{name}"
            );
        }
        assert_eq!(proguard_uuid_from_name("proguard/not-a-uuid.txt"), None);
        assert_eq!(proguard_uuid_from_name("mapping.txt"), None);
    }
}
