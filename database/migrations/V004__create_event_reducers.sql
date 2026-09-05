CREATE TABLE event_reducers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    aggregate_type VARCHAR(100) NOT NULL,
    event_type VARCHAR(255) NOT NULL,
    operation VARCHAR(20) NOT NULL,
    field VARCHAR(255),
    config JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_event_reducers_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id),

    CONSTRAINT uq_event_reducer
        UNIQUE (project_id, aggregate_type, event_type),

    CONSTRAINT chk_event_reducer_operation
        CHECK (operation IN ('set', 'merge', 'append'))
);

CREATE INDEX idx_event_reducers_project_id
    ON event_reducers(project_id);
