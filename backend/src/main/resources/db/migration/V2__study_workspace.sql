CREATE TABLE courses (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    code VARCHAR(120) NOT NULL CHECK (btrim(code) <> ''),
    name VARCHAR(200) NOT NULL CHECK (btrim(name) <> ''),
    color VARCHAR(12) NOT NULL CHECK (color IN ('ember','amber','moss','teal','sky','iris','orchid','slate')),
    term VARCHAR(120), instructor VARCHAR(200), email VARCHAR(254), website VARCHAR(2048),
    status VARCHAR(8) NOT NULL CHECK (status IN ('active','archived')),
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE (id, owner_id)
);
CREATE INDEX idx_courses_owner ON courses(owner_id, created_at);

CREATE TABLE topics (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL CHECK (btrim(title) <> ''),
    details VARCHAR(1000), notes TEXT NOT NULL DEFAULT '',
    planned_date DATE, planned_start TIMESTAMPTZ,
    planned_minutes INTEGER CHECK (planned_minutes BETWEEN 1 AND 1440),
    confidence VARCHAR(8) NOT NULL CHECK (confidence IN ('unrated','shaky','okay','solid','retired')),
    last_reviewed_at TIMESTAMPTZ,
    position INTEGER NOT NULL CHECK (position >= 0),
    created_at TIMESTAMPTZ NOT NULL,
    UNIQUE (id, owner_id),
    FOREIGN KEY (course_id, owner_id) REFERENCES courses(id, owner_id) ON DELETE CASCADE
);
CREATE INDEX idx_topics_owner_course ON topics(owner_id, course_id, position);

CREATE TABLE topic_resources (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL,
    label VARCHAR(200) NOT NULL CHECK (btrim(label) <> ''),
    url VARCHAR(2048) NOT NULL,
    position INTEGER NOT NULL,
    FOREIGN KEY (topic_id, owner_id) REFERENCES topics(id, owner_id) ON DELETE CASCADE
);
CREATE INDEX idx_resources_owner_topic ON topic_resources(owner_id, topic_id, position);

CREATE TABLE review_events (
    id UUID PRIMARY KEY,
    sequence BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
    owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    topic_id UUID NOT NULL,
    rating VARCHAR(8) NOT NULL CHECK (rating IN ('unrated','shaky','okay','solid','retired')),
    previous VARCHAR(8) NOT NULL CHECK (previous IN ('unrated','shaky','okay','solid','retired')),
    previous_last_reviewed_at TIMESTAMPTZ,
    at TIMESTAMPTZ NOT NULL,
    source VARCHAR(6) NOT NULL CHECK (source IN ('review','focus','topic')),
    FOREIGN KEY (topic_id, owner_id) REFERENCES topics(id, owner_id) ON DELETE CASCADE
);
CREATE INDEX idx_reviews_owner_at ON review_events(owner_id, at DESC);
CREATE INDEX idx_reviews_topic_latest ON review_events(topic_id, sequence DESC);

CREATE TABLE assessments (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    course_id UUID,
    title VARCHAR(200) NOT NULL CHECK (btrim(title) <> ''),
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('assignment','exam','quiz','project','task')),
    due_date DATE NOT NULL, due_time TIME,
    weight NUMERIC(5,2) CHECK (weight BETWEEN 0 AND 100),
    done BOOLEAN NOT NULL DEFAULT FALSE, done_at TIMESTAMPTZ,
    notes TEXT NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL,
    UNIQUE (id, owner_id),
    FOREIGN KEY (course_id, owner_id) REFERENCES courses(id, owner_id) ON DELETE CASCADE
);
CREATE INDEX idx_assessments_owner_due ON assessments(owner_id, due_date);
CREATE INDEX idx_assessments_course ON assessments(course_id);

CREATE TABLE assessment_topics (
    owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL,
    topic_id UUID NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (assessment_id, topic_id),
    FOREIGN KEY (assessment_id, owner_id) REFERENCES assessments(id, owner_id) ON DELETE CASCADE,
    FOREIGN KEY (topic_id, owner_id) REFERENCES topics(id, owner_id) ON DELETE CASCADE
);
CREATE INDEX idx_assessment_topics_owner ON assessment_topics(owner_id, assessment_id);
CREATE INDEX idx_assessment_topics_topic ON assessment_topics(topic_id);

ALTER TABLE calendar_events RENAME TO legacy_calendar_events;
CREATE TABLE calendar_events (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL CHECK (btrim(title) <> ''),
    date DATE NOT NULL, start_time TIME, end_time TIME,
    color VARCHAR(12) NOT NULL CHECK (color IN ('ember','amber','moss','teal','sky','iris','orchid','slate')),
    done BOOLEAN NOT NULL DEFAULT FALSE,
    CHECK (end_time IS NULL OR start_time IS NULL OR end_time > start_time)
);
CREATE INDEX idx_events_owner_date ON calendar_events(owner_id, date);

CREATE TABLE study_sessions (
    id UUID PRIMARY KEY,
    owner_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    topic_id UUID, course_id UUID,
    started_at TIMESTAMPTZ NOT NULL,
    minutes INTEGER NOT NULL CHECK (minutes BETWEEN 1 AND 1440),
    note VARCHAR(1000),
    FOREIGN KEY (topic_id, owner_id) REFERENCES topics(id, owner_id) ON DELETE CASCADE,
    FOREIGN KEY (course_id, owner_id) REFERENCES courses(id, owner_id) ON DELETE CASCADE
);
CREATE INDEX idx_sessions_owner_started ON study_sessions(owner_id, started_at DESC);
CREATE INDEX idx_sessions_course ON study_sessions(course_id);
CREATE INDEX idx_sessions_topic ON study_sessions(topic_id);

INSERT INTO courses(id, owner_id, code, name, color, status, created_at)
SELECT gen_random_uuid(), owner_id, course, course,
       (ARRAY['ember','amber','moss','teal','sky','iris','orchid','slate'])
           [((row_number() OVER (PARTITION BY owner_id ORDER BY course) - 1) % 8 + 1)::integer],
       'active', created_at AT TIME ZONE 'UTC'
FROM (
    SELECT owner_id, btrim(course) AS course, min(created_at) AS created_at
    FROM tasks WHERE course IS NOT NULL AND btrim(course) <> ''
    GROUP BY owner_id, btrim(course)
) old_courses;

INSERT INTO assessments(id, owner_id, course_id, title, kind, due_date, done, done_at, notes, created_at)
SELECT t.id, t.owner_id, c.id, t.title,
       CASE WHEN lower(btrim(t.type)) IN ('assignment','exam','quiz','project','task')
           THEN lower(btrim(t.type)) ELSE 'task' END,
       coalesce(t.due_date, t.created_at::date), t.completed,
       CASE WHEN t.completed THEN t.updated_at AT TIME ZONE 'UTC' ELSE NULL END,
       coalesce(t.description, ''), t.created_at AT TIME ZONE 'UTC'
FROM tasks t LEFT JOIN courses c ON c.owner_id = t.owner_id AND c.code = btrim(t.course);

INSERT INTO calendar_events(id, owner_id, title, date, color, done)
SELECT id, owner_id, name, event_date, 'slate', completed FROM legacy_calendar_events;

DROP TABLE tasks;
DROP TABLE legacy_calendar_events;
