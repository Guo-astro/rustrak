-- Independent alert rules: a project may hold several rules for one trigger
-- -- new issues by email with one set of filters, to Slack with another.
ALTER TABLE alert_rules DROP CONSTRAINT IF EXISTS alert_rules_project_id_alert_type_key;
