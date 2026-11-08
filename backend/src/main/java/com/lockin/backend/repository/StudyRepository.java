package com.lockin.backend.repository;

import com.lockin.backend.dto.StudyDtos.*;
import com.lockin.backend.exception.NotFoundException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.*;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.stereotype.Repository;

/** Explicit, owner-scoped SQL keeps workspace reads constant in query count. */
@Repository
public class StudyRepository {
    private final NamedParameterJdbcTemplate jdbc;

    public StudyRepository(NamedParameterJdbcTemplate jdbc) { this.jdbc = jdbc; }

    public UUID owner(UUID accountId, boolean lock) {
        return one("SELECT id FROM app_users WHERE id=:id" + (lock ? " FOR UPDATE" : ""),
                Map.of("id", accountId), (rs, n) -> uuid(rs, "id"), "User");
    }

    public void insert(String table, Map<String, Object> fields) {
        jdbc.update("INSERT INTO " + table + " (" + String.join(",", fields.keySet()) + ") VALUES (:"
                + String.join(",:", fields.keySet()) + ")", fields);
    }

    public void update(String table, UUID id, UUID owner, Map<String, Object> fields) {
        String assignments = String.join(",", fields.keySet().stream().map(key -> key + "=:" + key).toList());
        var params = new LinkedHashMap<>(fields);
        params.put("id", id);
        params.put("owner", owner);
        jdbc.update("UPDATE " + table + " SET " + assignments + " WHERE id=:id AND owner_id=:owner", params);
    }

    public void delete(String table, UUID id, UUID owner) {
        if (jdbc.update("DELETE FROM " + table + " WHERE id=:id AND owner_id=:owner", ids(id, owner)) == 0) {
            throw new NotFoundException("Record not found.");
        }
    }

    public Course course(UUID id, UUID owner) {
        return one("SELECT * FROM courses WHERE id=:id AND owner_id=:owner", ids(id, owner), COURSE, "Course");
    }

    public void requireTopics(UUID owner, List<UUID> topics) {
        if (topics.isEmpty()) return;
        Integer count = jdbc.queryForObject("SELECT count(*) FROM topics WHERE owner_id=:owner AND id IN (:topics)",
                Map.of("owner", owner, "topics", topics), Integer.class);
        if (count == null || count != topics.size()) throw new NotFoundException("Topic not found.");
    }

    public Topic topic(UUID id, UUID owner) {
        var resources = resources(owner, id);
        return one("SELECT * FROM topics WHERE id=:id AND owner_id=:owner", ids(id, owner), topicMapper(resources), "Topic");
    }

    public Assessment assessment(UUID id, UUID owner) {
        var links = links(owner, id);
        return one("SELECT * FROM assessments WHERE id=:id AND owner_id=:owner", ids(id, owner), assessmentMapper(links), "Assessment");
    }

    public CalendarEvent event(UUID id, UUID owner) {
        return one("SELECT * FROM calendar_events WHERE id=:id AND owner_id=:owner", ids(id, owner), EVENT, "Event");
    }

    public ReviewSnapshot review(UUID id, UUID owner) {
        return one("SELECT * FROM review_events WHERE id=:id AND owner_id=:owner", ids(id, owner),
                (rs, n) -> new ReviewSnapshot(REVIEW.mapRow(rs, n), instant(rs, "previous_last_reviewed_at")), "Review");
    }

    public UUID latestReview(UUID topicId, UUID owner) {
        return one("SELECT id FROM review_events WHERE topic_id=:id AND owner_id=:owner ORDER BY sequence DESC LIMIT 1",
                ids(topicId, owner), (rs, n) -> uuid(rs, "id"), "Review");
    }

    public void replaceResources(UUID topic, UUID owner, List<ResourceInput> resources) {
        jdbc.update("DELETE FROM topic_resources WHERE topic_id=:id AND owner_id=:owner", ids(topic, owner));
        SqlParameterSource[] rows = new SqlParameterSource[resources.size()];
        for (int position = 0; position < resources.size(); position++) {
            ResourceInput resource = resources.get(position);
            rows[position] = new MapSqlParameterSource(fields("id", UUID.randomUUID(), "owner_id", owner, "topic_id", topic,
                    "label", resource.label().trim(), "url", resource.url(), "position", position));
        }
        if (rows.length > 0) jdbc.batchUpdate("INSERT INTO topic_resources(id,owner_id,topic_id,label,url,position) "
                + "VALUES (:id,:owner_id,:topic_id,:label,:url,:position)", rows);
    }

    public void replaceLinks(UUID assessment, UUID owner, List<UUID> topics) {
        jdbc.update("DELETE FROM assessment_topics WHERE assessment_id=:id AND owner_id=:owner", ids(assessment, owner));
        SqlParameterSource[] rows = new SqlParameterSource[topics.size()];
        for (int position = 0; position < topics.size(); position++) {
            rows[position] = new MapSqlParameterSource(fields("owner_id", owner, "assessment_id", assessment,
                    "topic_id", topics.get(position), "position", position));
        }
        if (rows.length > 0) jdbc.batchUpdate("INSERT INTO assessment_topics(owner_id,assessment_id,topic_id,position) "
                + "VALUES (:owner_id,:assessment_id,:topic_id,:position)", rows);
    }

    public Workspace workspace(UUID owner, com.lockin.backend.dto.UserResponse user, Instant now) {
        Map<String, Object> params = fields("owner", owner, "cutoff", now.minus(java.time.Duration.ofDays(120)));
        // Two batched child reads, regardless of how many topics or assessments exist.
        var resources = resources(owner, null);
        var links = links(owner, null);
        return new Workspace(user,
                jdbc.query("SELECT * FROM courses WHERE owner_id=:owner ORDER BY created_at,id", params, COURSE),
                jdbc.query("SELECT * FROM topics WHERE owner_id=:owner ORDER BY course_id,position,created_at,id", params, topicMapper(resources)),
                jdbc.query("SELECT * FROM assessments WHERE owner_id=:owner ORDER BY due_date,created_at,id", params, assessmentMapper(links)),
                jdbc.query("SELECT * FROM calendar_events WHERE owner_id=:owner ORDER BY date,id", params, EVENT),
                jdbc.query("SELECT * FROM study_sessions WHERE owner_id=:owner AND started_at>=:cutoff ORDER BY started_at DESC,id", params, SESSION),
                jdbc.query("SELECT * FROM review_events WHERE owner_id=:owner AND at>=:cutoff ORDER BY sequence DESC", params, REVIEW), now);
    }

    private Map<UUID, List<Resource>> resources(UUID owner, UUID topic) {
        Map<UUID, List<Resource>> result = new HashMap<>();
        jdbc.query("SELECT * FROM topic_resources WHERE owner_id=:owner" + (topic == null ? "" : " AND topic_id=:id")
                + " ORDER BY topic_id,position", ids(topic, owner), (org.springframework.jdbc.core.RowCallbackHandler) rs ->
                result.computeIfAbsent(uuid(rs, "topic_id"), key -> new ArrayList<>())
                        .add(new Resource(uuid(rs, "id"), rs.getString("label"), rs.getString("url"))));
        return result;
    }

    private Map<UUID, List<UUID>> links(UUID owner, UUID assessment) {
        Map<UUID, List<UUID>> result = new HashMap<>();
        jdbc.query("SELECT * FROM assessment_topics WHERE owner_id=:owner" + (assessment == null ? "" : " AND assessment_id=:id")
                + " ORDER BY assessment_id,position", ids(assessment, owner), (org.springframework.jdbc.core.RowCallbackHandler) rs ->
                result.computeIfAbsent(uuid(rs, "assessment_id"), key -> new ArrayList<>()).add(uuid(rs, "topic_id")));
        return result;
    }

    private <T> T one(String sql, Map<String, ?> params, RowMapper<T> mapper, String label) {
        return jdbc.query(sql, params, mapper).stream().findFirst().orElseThrow(() -> new NotFoundException(label + " not found."));
    }

    private static final RowMapper<Course> COURSE = (rs, n) -> new Course(uuid(rs, "id"), rs.getString("code"),
            rs.getString("name"), rs.getString("color"), rs.getString("term"), rs.getString("instructor"),
            rs.getString("email"), rs.getString("website"), rs.getString("status"), instant(rs, "created_at"));
    private static RowMapper<Topic> topicMapper(Map<UUID, List<Resource>> resources) {
        return (rs, n) -> new Topic(uuid(rs, "id"), uuid(rs, "course_id"), rs.getString("title"), rs.getString("details"),
                rs.getString("notes"), rs.getObject("planned_date", LocalDate.class), instant(rs, "planned_start"),
                rs.getObject("planned_minutes", Integer.class), rs.getString("confidence"), instant(rs, "last_reviewed_at"),
                rs.getInt("position"), resources.getOrDefault(uuid(rs, "id"), List.of()), instant(rs, "created_at"));
    }
    private static RowMapper<Assessment> assessmentMapper(Map<UUID, List<UUID>> links) {
        return (rs, n) -> new Assessment(uuid(rs, "id"), uuid(rs, "course_id"), rs.getString("title"), rs.getString("kind"),
                rs.getObject("due_date", LocalDate.class), time(rs, "due_time"), rs.getBigDecimal("weight"), rs.getBoolean("done"),
                instant(rs, "done_at"), rs.getString("notes"), links.getOrDefault(uuid(rs, "id"), List.of()), instant(rs, "created_at"));
    }
    private static final RowMapper<CalendarEvent> EVENT = (rs, n) -> new CalendarEvent(uuid(rs, "id"), rs.getString("title"),
            rs.getObject("date", LocalDate.class), time(rs, "start_time"), time(rs, "end_time"), rs.getString("color"), rs.getBoolean("done"));
    private static final RowMapper<StudySession> SESSION = (rs, n) -> new StudySession(uuid(rs, "id"), uuid(rs, "topic_id"),
            uuid(rs, "course_id"), instant(rs, "started_at"), rs.getInt("minutes"), rs.getString("note"));
    private static final RowMapper<ReviewEvent> REVIEW = (rs, n) -> new ReviewEvent(uuid(rs, "id"), uuid(rs, "topic_id"),
            rs.getString("rating"), rs.getString("previous"), instant(rs, "at"), rs.getString("source"));

    public record ReviewSnapshot(ReviewEvent event, Instant previousLastReviewedAt) {}

    private static UUID uuid(ResultSet rs, String column) throws SQLException { return rs.getObject(column, UUID.class); }
    private static Instant instant(ResultSet rs, String column) throws SQLException {
        OffsetDateTime time = rs.getObject(column, OffsetDateTime.class);
        return time == null ? null : time.toInstant();
    }
    private static String time(ResultSet rs, String column) throws SQLException {
        var time = rs.getObject(column, java.time.LocalTime.class);
        return time == null ? null : time.format(java.time.format.DateTimeFormatter.ofPattern("HH:mm"));
    }
    private static Map<String, Object> ids(UUID id, UUID owner) { return fields("id", id, "owner", owner); }

    /** Internal column names only. Values always use JDBC parameters. */
    public static Map<String, Object> fields(Object... pairs) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            Object value = pairs[i + 1];
            result.put((String) pairs[i], value instanceof Instant time ? time.atOffset(ZoneOffset.UTC) : value);
        }
        return result;
    }
}
