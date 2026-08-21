ALTER TABLE aggregates
    ADD CONSTRAINT uq_aggregates_id_project
    UNIQUE (id, project_id);

ALTER TABLE events
    DROP CONSTRAINT fk_events_aggregate;

ALTER TABLE events
    ADD CONSTRAINT fk_events_aggregate_project
    FOREIGN KEY (aggregate_id, project_id)
    REFERENCES aggregates(id, project_id);