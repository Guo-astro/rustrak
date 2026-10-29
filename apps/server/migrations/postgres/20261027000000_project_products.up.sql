-- The products a project keeps (dropped at ingest when listed here), and the
-- order its sidebar lists them in. JSON arrays of product keys.
ALTER TABLE projects ADD COLUMN disabled_products JSONB NOT NULL DEFAULT '[]';
ALTER TABLE projects ADD COLUMN product_order JSONB NOT NULL DEFAULT '[]';
