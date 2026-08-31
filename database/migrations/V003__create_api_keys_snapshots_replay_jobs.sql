CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    key_prefix VARCHAR(12) NOT NULL,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_api_keys_project_id ON api_keys(project_id);

-- snapshots: belong to an aggregate and its project
CREATE TABLE snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id UUID NOT NULL,
    project_id UUID NOT NULL,
    sequence_number BIGINT NOT NULL,
    state JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_snapshots_aggregate_project
        FOREIGN KEY (aggregate_id, project_id) REFERENCES aggregates(id, project_id),
    CONSTRAINT uq_snapshot_aggregate_sequence UNIQUE (aggregate_id, sequence_number)
);
CREATE INDEX idx_snapshots_aggregate_id ON snapshots(aggregate_id);

-- replay_jobs: belong to a project, optionally target one aggregate
CREATE TABLE replay_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    aggregate_id UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_replay_jobs_project FOREIGN KEY (project_id) REFERENCES projects(id),
    CONSTRAINT fk_replay_jobs_aggregate_project
        FOREIGN KEY (aggregate_id, project_id) REFERENCES aggregates(id, project_id)
);
CREATE INDEX idx_replay_jobs_project_id ON replay_jobs(project_id);