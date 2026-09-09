ALTER TABLE replay_jobs
    ADD COLUMN aggregate_type VARCHAR(100),
    ADD COLUMN result JSONB;
