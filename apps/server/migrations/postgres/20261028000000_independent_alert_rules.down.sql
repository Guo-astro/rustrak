-- Back to one rule per trigger: keep the oldest rule of each, drop the rest.
DELETE FROM alert_rules WHERE id NOT IN (
    SELECT MIN(id) FROM alert_rules GROUP BY project_id, alert_type
);
ALTER TABLE alert_rules
    ADD CONSTRAINT alert_rules_project_id_alert_type_key UNIQUE (project_id, alert_type);
