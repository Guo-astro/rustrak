//! Issues by environment, as Sentry's project issue list reads them
//! (`ProjectGroupIndexEndpoint`): the issues seen in it (`GroupEnvironment`),
//! with that environment's numbers (`group.py`, `__seen_stats_impl`).

use crate::common::{null_sourcemap_provider, process_error_event, TestDb};
use actix_web::{test, web, App};
use chrono::{DateTime, Duration, Utc};
use rustrak::config::RateLimitConfig;
use rustrak::db::DbPool;
use rustrak::ingest::{store_event, EventMetadata};
use rustrak::models::{CreateAuthToken, CreateProject};
use rustrak::routes;
use rustrak::services::{AuthTokenService, EventService, ProjectService};
use serde_json::{json, Value};
use uuid::Uuid;

/// Digests an error event of type `exc_type` at `at` by `user`, in
/// `environment` when there is one. Returns its issue id.
async fn ingest(
    pool: &DbPool,
    project_id: i32,
    exc_type: &str,
    environment: Option<&str>,
    user: &str,
    at: DateTime<Utc>,
) -> Uuid {
    let dir = tempfile::TempDir::new().unwrap();
    let event_id = Uuid::new_v4();
    let mut event = json!({
        "event_id": event_id.simple().to_string(),
        "timestamp": at.timestamp() as f64,
        "platform": "python",
        "level": "error",
        "user": {"id": user},
        "exception": {"values": [{"type": exc_type, "value": "boom"}]}
    });
    if let Some(env) = environment {
        event["environment"] = json!(env);
    }
    store_event(
        dir.path(),
        &event_id.simple().to_string(),
        &serde_json::to_vec(&event).unwrap(),
    )
    .await
    .unwrap();
    let limits = RateLimitConfig {
        max_events_per_minute: 1000,
        max_events_per_hour: 10000,
        max_events_per_project_per_minute: 1000,
        max_events_per_project_per_hour: 10000,
    };
    process_error_event(
        pool,
        &EventMetadata {
            event_id: event_id.simple().to_string(),
            project_id,
            ingested_at: at,
            remote_addr: None,
        },
        dir.path(),
        &limits,
        null_sourcemap_provider(),
    )
    .await
    .expect("digest");
    EventService::issue_id_for_event(pool, project_id, event_id)
        .await
        .unwrap()
        .expect("event has an issue")
}

async fn setup() -> (TestDb, i32, String) {
    let db = TestDb::new().await;
    let project = ProjectService::create(
        &db.pool,
        CreateProject {
            name: "Tenants".to_string(),
            slug: None,
            platform: None,
        },
    )
    .await
    .unwrap();
    let token = AuthTokenService::create(&db.pool, CreateAuthToken { description: None })
        .await
        .unwrap()
        .token;
    (db, project.id, token)
}

async fn get(pool: &DbPool, token: &str, uri: &str) -> Value {
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .configure(routes::events::configure)
            .configure(routes::issues::configure),
    )
    .await;
    let req = test::TestRequest::get()
        .uri(uri)
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    let resp = test::call_service(&app, req).await;
    assert!(resp.status().is_success(), "{uri}: {}", resp.status());
    test::read_body_json(resp).await
}

fn ids(body: &Value) -> Vec<String> {
    body["items"]
        .as_array()
        .unwrap()
        .iter()
        .map(|i| i["id"].as_str().unwrap().to_string())
        .collect()
}

fn ts(v: &Value) -> i64 {
    v.as_str()
        .unwrap()
        .parse::<DateTime<Utc>>()
        .unwrap()
        .timestamp()
}

#[actix_web::test]
async fn issue_list_keeps_the_issues_seen_in_the_environment() {
    let (db, project_id, token) = setup().await;
    let now = Utc::now();
    let shared = ingest(&db.pool, project_id, "Shared", Some("acme"), "u1", now).await;
    ingest(&db.pool, project_id, "Shared", Some("lanza"), "u2", now).await;
    let acme_only = ingest(&db.pool, project_id, "AcmeOnly", Some("acme"), "u1", now).await;
    ingest(&db.pool, project_id, "Bare", None, "u1", now).await;
    let base = format!("/api/projects/{project_id}/issues");

    let body = get(&db.pool, &token, &format!("{base}?environment=lanza")).await;
    assert_eq!(ids(&body), vec![shared.to_string()]);
    assert_eq!(body["total_count"], 1);

    let body = get(&db.pool, &token, &format!("{base}?environment=acme")).await;
    let mut acme = ids(&body);
    acme.sort();
    let mut expected = vec![shared.to_string(), acme_only.to_string()];
    expected.sort();
    assert_eq!(acme, expected);

    // An environment nothing was seen in is an empty list (`prep_search`).
    let body = get(&db.pool, &token, &format!("{base}?environment=nowhere")).await;
    assert_eq!(body["total_count"], 0);

    let body = get(&db.pool, &token, &base).await;
    assert_eq!(body["total_count"], 3);
}

#[actix_web::test]
async fn issue_numbers_are_the_environments() {
    let (db, project_id, token) = setup().await;
    let t0 = Utc::now() - Duration::hours(3);
    let t1 = Utc::now() - Duration::hours(2);
    let t2 = Utc::now() - Duration::hours(1);
    ingest(&db.pool, project_id, "Shared", Some("lanza"), "u1", t0).await;
    ingest(&db.pool, project_id, "Shared", Some("acme"), "u2", t1).await;
    ingest(&db.pool, project_id, "Shared", Some("acme"), "u3", t2).await;
    let base = format!("/api/projects/{project_id}/issues");

    let body = get(&db.pool, &token, &format!("{base}?environment=acme")).await;
    let issue = &body["items"][0];
    assert_eq!(issue["event_count"], 2);
    assert_eq!(ts(&issue["first_seen"]), t1.timestamp());
    assert_eq!(ts(&issue["last_seen"]), t2.timestamp());
    assert_eq!(issue["user_count"], 2);
    let trend: i64 = issue["trend"]
        .as_array()
        .unwrap()
        .iter()
        .map(|v| v.as_i64().unwrap())
        .sum();
    assert_eq!(trend, 2);

    let body = get(&db.pool, &token, &format!("{base}?environment=lanza")).await;
    let issue = &body["items"][0];
    assert_eq!(issue["event_count"], 1);
    assert_eq!(ts(&issue["last_seen"]), t0.timestamp());
    assert_eq!(issue["user_count"], 1);
}

#[actix_web::test]
async fn a_late_older_event_keeps_the_environments_dates() {
    let (db, project_id, token) = setup().await;
    let older = Utc::now() - Duration::hours(2);
    let newer = Utc::now() - Duration::hours(1);
    ingest(&db.pool, project_id, "Shared", Some("acme"), "u", newer).await;
    ingest(&db.pool, project_id, "Shared", Some("acme"), "u", older).await;

    let body = get(
        &db.pool,
        &token,
        &format!("/api/projects/{project_id}/issues?environment=acme"),
    )
    .await;
    let issue = &body["items"][0];
    assert_eq!(ts(&issue["first_seen"]), older.timestamp());
    assert_eq!(ts(&issue["last_seen"]), newer.timestamp());
}

#[actix_web::test]
async fn environments_of_a_missing_project_are_not_found() {
    let (db, _, token) = setup().await;
    let app = test::init_service(
        App::new()
            .app_data(web::Data::new(db.pool.clone()))
            .configure(routes::issues::configure),
    )
    .await;
    let req = test::TestRequest::get()
        .uri("/api/projects/999999/environments")
        .insert_header(("Authorization", format!("Bearer {token}")))
        .to_request();
    assert_eq!(test::call_service(&app, req).await.status(), 404);
}

#[actix_web::test]
async fn environment_combines_with_search_status_and_sort() {
    let (db, project_id, token) = setup().await;
    let now = Utc::now();
    ingest(&db.pool, project_id, "Alpha", Some("acme"), "u", now).await;
    let beta = ingest(&db.pool, project_id, "Beta", Some("acme"), "u", now).await;
    ingest(&db.pool, project_id, "Beta", Some("acme"), "u", now).await;
    ingest(&db.pool, project_id, "Alpha", Some("lanza"), "u", now).await;
    ingest(&db.pool, project_id, "Alpha", Some("lanza"), "u", now).await;
    ingest(&db.pool, project_id, "Alpha", Some("lanza"), "u", now).await;
    let base = format!("/api/projects/{project_id}/issues");

    let body = get(
        &db.pool,
        &token,
        &format!("{base}?environment=acme&q=beta&filter=open"),
    )
    .await;
    assert_eq!(ids(&body), vec![beta.to_string()]);

    // Alpha has more events overall, but fewer in acme.
    let body = get(
        &db.pool,
        &token,
        &format!("{base}?environment=acme&sort=event_count&per_page=1"),
    )
    .await;
    assert_eq!(ids(&body), vec![beta.to_string()]);
    assert_eq!(body["total_count"], 2);

    let body = get(
        &db.pool,
        &token,
        &format!("{base}?environment=acme&filter=resolved"),
    )
    .await;
    assert_eq!(body["total_count"], 0);
}

#[actix_web::test]
async fn project_environments_are_listed_by_name() {
    let (db, project_id, token) = setup().await;
    let now = Utc::now();
    ingest(&db.pool, project_id, "A", Some("lanza"), "u", now).await;
    ingest(&db.pool, project_id, "A", Some("acme"), "u", now).await;
    ingest(&db.pool, project_id, "B", Some("acme"), "u", now).await;
    ingest(&db.pool, project_id, "C", None, "u", now).await;

    let body = get(
        &db.pool,
        &token,
        &format!("/api/projects/{project_id}/environments"),
    )
    .await;
    // No environment is not one (Sentry leaves "" out).
    assert_eq!(body, json!(["acme", "lanza"]));
}

#[actix_web::test]
async fn issue_events_filter_by_environment() {
    let (db, project_id, token) = setup().await;
    let now = Utc::now();
    let issue = ingest(&db.pool, project_id, "Shared", Some("acme"), "u", now).await;
    ingest(&db.pool, project_id, "Shared", Some("lanza"), "u", now).await;
    ingest(&db.pool, project_id, "Shared", Some("lanza"), "u", now).await;

    let uri = format!("/api/projects/{project_id}/issues/{issue}/events");
    let all = get(&db.pool, &token, &uri).await;
    assert_eq!(all["items"].as_array().unwrap().len(), 3);
    let lanza = get(&db.pool, &token, &format!("{uri}?environment=lanza")).await;
    assert_eq!(lanza["items"].as_array().unwrap().len(), 2);
}
