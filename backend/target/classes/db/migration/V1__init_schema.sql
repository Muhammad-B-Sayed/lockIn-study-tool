CREATE TABLE app_users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    description TEXT,
    due_date DATE,
    course VARCHAR(120),
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    type VARCHAR(60) NOT NULL DEFAULT 'Task',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tasks_owner_due_date ON tasks (owner_id, due_date);

CREATE TABLE calendar_events (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES app_users (id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    event_date DATE NOT NULL,
    color_hex VARCHAR(20) NOT NULL DEFAULT '#2563eb',
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_calendar_events_owner_date ON calendar_events (owner_id, event_date);
