CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_projects_organization
        FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
);

CREATE TABLE aggregates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_key VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_aggregates_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id),

    CONSTRAINT uq_project_aggregate
        UNIQUE (project_id, aggregate_type, aggregate_key)
);

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    aggregate_id UUID NOT NULL,
    sequence_number BIGINT NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    event_version INTEGER NOT NULL,
    payload JSONB NOT NULL,
    metadata JSONB,
    occurred_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_events_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id),

    CONSTRAINT fk_events_aggregate
        FOREIGN KEY (aggregate_id)
        REFERENCES aggregates(id),

    CONSTRAINT uq_aggregate_sequence
        UNIQUE (aggregate_id, sequence_number)
);

CREATE INDEX idx_projects_organization_id
    ON projects(organization_id);

CREATE INDEX idx_aggregates_project_id
    ON aggregates(project_id);

CREATE INDEX idx_events_project_id
    ON events(project_id);

CREATE INDEX idx_events_aggregate_id_sequence
    ON events(aggregate_id, sequence_number);

CREATE INDEX idx_events_occurred_at
    ON events(occurred_at);

/*
organizations
      ↓
projects
      ↓
aggregates
      ↓
events
*/