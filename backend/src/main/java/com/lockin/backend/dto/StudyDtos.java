package com.lockin.backend.dto;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** JSON records mirror frontend/src/lib/data/types.ts. Persistence never leaks owner IDs. */
public final class StudyDtos {
    private StudyDtos() {}
    public static final String COLORS = "ember|amber|moss|teal|sky|iris|orchid|slate";
    public static final String CONFIDENCE = "unrated|shaky|okay|solid|retired";
    public static final String KINDS = "assignment|exam|quiz|project|task";
    public static final String TIME = "(?:[01][0-9]|2[0-3]):[0-5][0-9]";
    public static final String URL = "https?://[^\\s]+";

    public record Course(UUID id, String code, String name, String color, String term,
            String instructor, String email, String website, String status, Instant createdAt) {}
    public record Resource(UUID id, String label, String url) {}
    public record Topic(UUID id, UUID courseId, String title, String details, String notes,
            LocalDate plannedDate, Instant plannedStart, Integer plannedMinutes, String confidence,
            Instant lastReviewedAt, int position, List<Resource> resources, Instant createdAt) {}
    public record ReviewEvent(UUID id, UUID topicId, String rating, String previous, Instant at, String source) {}
    public record Assessment(UUID id, UUID courseId, String title, String kind, LocalDate dueDate,
            String dueTime, BigDecimal weight, boolean done, Instant doneAt, String notes,
            List<UUID> topicIds, Instant createdAt) {}
    public record CalendarEvent(UUID id, String title, LocalDate date, String startTime,
            String endTime, String color, boolean done) {}
    public record StudySession(UUID id, UUID topicId, UUID courseId, Instant startedAt, int minutes, String note) {}
    public record Workspace(UserResponse user, List<Course> courses, List<Topic> topics,
            List<Assessment> assessments, List<CalendarEvent> events, List<StudySession> sessions,
            List<ReviewEvent> reviews, Instant generatedAt) {}
    public record RateResult(Topic topic, ReviewEvent review) {}
    public record UndoResult(Topic topic) {}

    public record CourseInput(
            @NotBlank(message="code is required") @Size(max=120) String code,
            @NotBlank(message="name is required") @Size(max=200) String name,
            @NotNull @Pattern(regexp=COLORS, message="color must be a supported color key") String color,
            @Size(max=120) String term, @Size(max=200) String instructor,
            @Email(message="email must be valid") @Size(max=254) String email,
            @Pattern(regexp=URL, message="website must be an http or https URL") @Size(max=2048) String website,
            @NotNull @Pattern(regexp="active|archived", message="status must be active or archived") String status) {}
    public record ResourceInput(
            @NotBlank @Size(max=200) String label,
            @NotBlank @Pattern(regexp=URL, message="url must be an http or https URL") @Size(max=2048) String url) {}
    /** Creation also distinguishes an omitted date from an explicitly cleared date. */
    public static final class TopicInput {
        @NotNull(message="courseId is required") public UUID courseId;
        @NotBlank(message="title is required") @Size(max=200) public String title;
        @Size(max=1000) public String details;
        @NotNull @Size(max=100000) public String notes;
        public LocalDate plannedDate;
        public OffsetDateTime plannedStart;
        @Min(1) @Max(1440) public Integer plannedMinutes;
        @NotNull @Pattern(regexp=CONFIDENCE, message="confidence must be unrated, shaky, okay, solid or retired") public String confidence;
        @NotNull @Min(0) public Integer position;
        @Size(max=100) public List<@NotNull @Valid ResourceInput> resources;
        @JsonIgnore private boolean plannedDateSupplied;

        @JsonSetter("plannedDate")
        public void setPlannedDate(LocalDate value) {
            plannedDate = value;
            plannedDateSupplied = true;
        }

        public UUID courseId() { return courseId; }
        public String title() { return title; }
        public String details() { return details; }
        public String notes() { return notes; }
        public LocalDate plannedDate() { return plannedDate; }
        public OffsetDateTime plannedStart() { return plannedStart; }
        public Integer plannedMinutes() { return plannedMinutes; }
        public String confidence() { return confidence; }
        public Integer position() { return position; }
        public List<ResourceInput> resources() { return resources; }
        public boolean hasPlannedDate() { return plannedDateSupplied; }
    }
    public record AssessmentInput(
            UUID courseId, @NotBlank(message="title is required") @Size(max=200) String title,
            @NotNull @Pattern(regexp=KINDS, message="kind must be assignment, exam, quiz, project or task") String kind,
            @NotNull(message="dueDate is required") LocalDate dueDate,
            @Pattern(regexp=TIME, message="dueTime must use HH:mm") String dueTime,
            @DecimalMin("0") @DecimalMax("100") @Digits(integer=3, fraction=2) BigDecimal weight,
            @NotNull Boolean done, @NotNull @Size(max=100000) String notes,
            @NotNull @Size(max=500) List<@NotNull UUID> topicIds) {}
    public record EventInput(
            @NotBlank(message="title is required") @Size(max=200) String title,
            @NotNull(message="date is required") LocalDate date,
            @Pattern(regexp=TIME, message="startTime must use HH:mm") String startTime,
            @Pattern(regexp=TIME, message="endTime must use HH:mm") String endTime,
            @NotNull @Pattern(regexp=COLORS, message="color must be a supported color key") String color,
            @NotNull Boolean done) {}
    public record SessionInput(UUID topicId, UUID courseId,
            @NotNull(message="startedAt is required") OffsetDateTime startedAt,
            @NotNull @Min(1) @Max(1440) Integer minutes, @Size(max=1000) String note) {}
    public record ReviewInput(
            @NotNull @Pattern(regexp=CONFIDENCE, message="rating must be unrated, shaky, okay, solid or retired") String rating,
            @NotNull @Pattern(regexp="review|focus|topic", message="source must be review, focus or topic") String source) {}
    public record BulkTopics(@NotNull @Size(min=1, max=300, message="Import between 1 and 300 topics at a time.") List<@NotNull @Valid TopicInput> topics) {}
    public record BulkAssessments(@NotNull @Size(min=1, max=300, message="Import between 1 and 300 assessments at a time.") List<@NotNull @Valid AssessmentInput> assessments) {}

    // Presence must be retained: PATCH null clears a nullable field; omission preserves it.
    public abstract static class FieldsPatch {
        private final Map<String, JsonNode> fields = new LinkedHashMap<>();
        @JsonAnySetter
        public void set(String name, JsonNode value) { fields.put(name, value); }
        public Map<String, JsonNode> fields() { return fields; }
    }
    public static final class CoursePatch extends FieldsPatch {}
    public static final class TopicPatch extends FieldsPatch {}
    public static final class AssessmentPatch extends FieldsPatch {}
    public static final class EventPatch extends FieldsPatch {}
}
