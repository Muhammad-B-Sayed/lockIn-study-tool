package com.lockin.backend.service;

import static com.lockin.backend.repository.StudyRepository.fields;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.lockin.backend.dto.StudyDtos.*;
import com.lockin.backend.exception.BadRequestException;
import com.lockin.backend.exception.ConflictException;
import com.lockin.backend.repository.StudyRepository;
import jakarta.validation.Validator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class StudyService {
    private static final String[] COURSE_FIELDS = {"code","name","color","term","instructor","email","website","status"};
    private static final String[] TOPIC_FIELDS = {"courseId","title","details","notes","plannedDate","plannedStart","plannedMinutes","confidence","position","resources"};
    private static final String[] ASSESSMENT_FIELDS = {"courseId","title","kind","dueDate","dueTime","weight","done","notes","topicIds"};
    private static final String[] EVENT_FIELDS = {"title","date","startTime","endTime","color","done"};
    private final StudyRepository repository;
    private final UserService users;
    private final ObjectMapper mapper;
    private final Validator validator;

    public StudyService(StudyRepository repository, UserService users, ObjectMapper mapper, Validator validator) {
        this.repository = repository;
        this.users = users;
        this.mapper = mapper;
        this.validator = validator;
    }

    @Transactional(readOnly=true, isolation=Isolation.REPEATABLE_READ)
    public Workspace workspace(UUID accountId) {
        var user = users.getProfile(accountId);
        return repository.workspace(user.id(), user, Instant.now());
    }

    public Course createCourse(UUID accountId, CourseInput input) {
        UUID owner = repository.owner(accountId, true);
        validate(input);
        UUID id = UUID.randomUUID();
        var values = courseFields(input);
        values.putAll(fields("id", id, "owner_id", owner, "created_at", Instant.now()));
        repository.insert("courses", values);
        return repository.course(id, owner);
    }

    public Course updateCourse(UUID accountId, UUID id, CoursePatch patch) {
        UUID owner = repository.owner(accountId, true);
        CourseInput input = merge(repository.course(id, owner), patch, CourseInput.class, COURSE_FIELDS);
        repository.update("courses", id, owner, courseFields(input));
        return repository.course(id, owner);
    }

    public void deleteCourse(UUID accountId, UUID id) { repository.delete("courses", id, repository.owner(accountId, true)); }

    public Topic createTopic(UUID accountId, TopicInput input) {
        return insertTopic(repository.owner(accountId, true), input);
    }

    public List<Topic> createTopics(UUID accountId, BulkTopics input) {
        UUID owner = repository.owner(accountId, true);
        validate(input);
        limitAggregate(input.topics().stream().mapToInt(topic -> topic.resources() == null ? 0 : topic.resources().size()).sum(), "resources");
        return input.topics().stream().map(topic -> insertTopic(owner, topic)).toList();
    }

    private Topic insertTopic(UUID owner, TopicInput input) {
        validate(input);
        repository.course(input.courseId(), owner);
        UUID id = UUID.randomUUID();
        var values = topicFields(input, input.hasPlannedDate(), true);
        values.putAll(fields("id", id, "owner_id", owner, "created_at", Instant.now(), "last_reviewed_at", null));
        repository.insert("topics", values);
        repository.replaceResources(id, owner, input.resources() == null ? List.of() : input.resources());
        return repository.topic(id, owner);
    }

    public Topic updateTopic(UUID accountId, UUID id, TopicPatch patch) {
        UUID owner = repository.owner(accountId, true);
        Topic previous = repository.topic(id, owner);
        // Course membership is immutable; lastReviewedAt remains patchable per TopicPatch.
        Set<String> allowed = new HashSet<>(Arrays.asList(TOPIC_FIELDS));
        allowed.remove("courseId");
        allowed.add("lastReviewedAt");
        checkFields(patch, allowed);
        ObjectNode json = project(previous, TOPIC_FIELDS);
        json.withArray("resources").forEach(resource -> ((ObjectNode) resource).remove("id"));
        patch.fields().forEach((key, value) -> { if (!key.equals("lastReviewedAt")) json.set(key, value); });
        // Moving a date-only plan off its time block clears the old block.
        if (patch.fields().containsKey("plannedDate") && !patch.fields().containsKey("plannedStart")
                && !Objects.equals(json.get("plannedDate"), mapper.valueToTree(previous.plannedDate()))) {
            json.putNull("plannedStart");
        }
        TopicInput input = decode(json, TopicInput.class);
        var values = topicFields(input, patch.fields().containsKey("plannedDate"), patch.fields().containsKey("plannedStart"));
        if (patch.fields().containsKey("lastReviewedAt")) {
            JsonNode value = patch.fields().get("lastReviewedAt");
            values.putAll(fields("last_reviewed_at", value.isNull() ? null : decode(value, OffsetDateTime.class).toInstant()));
        }
        repository.update("topics", id, owner, values);
        if (patch.fields().containsKey("resources")) {
            if (input.resources() == null) throw new BadRequestException("resources must be an array, use [] to clear it.");
            repository.replaceResources(id, owner, input.resources());
        }
        return repository.topic(id, owner);
    }

    public void deleteTopic(UUID accountId, UUID id) { repository.delete("topics", id, repository.owner(accountId, true)); }

    public RateResult rate(UUID accountId, UUID topicId, ReviewInput input) {
        UUID owner = repository.owner(accountId, true);
        Topic topic = repository.topic(topicId, owner);
        validate(input);
        Instant now = Instant.now();
        UUID reviewId = UUID.randomUUID();
        repository.insert("review_events", fields("id", reviewId, "owner_id", owner, "topic_id", topicId,
                "rating", input.rating(), "previous", topic.confidence(), "previous_last_reviewed_at", topic.lastReviewedAt(),
                "at", now, "source", input.source()));
        Instant reviewedAt = input.rating().equals("retired") || input.rating().equals("unrated") ? topic.lastReviewedAt() : now;
        repository.update("topics", topicId, owner, fields("confidence", input.rating(), "last_reviewed_at", reviewedAt));
        return new RateResult(repository.topic(topicId, owner), repository.review(reviewId, owner).event());
    }

    public UndoResult undo(UUID accountId, UUID reviewId) {
        UUID owner = repository.owner(accountId, true);
        var snapshot = repository.review(reviewId, owner);
        ReviewEvent review = snapshot.event();
        if (!reviewId.equals(repository.latestReview(review.topicId(), owner))) {
            throw new ConflictException("Only the latest review for a topic can be undone.");
        }
        repository.update("topics", review.topicId(), owner,
                fields("confidence", review.previous(), "last_reviewed_at", snapshot.previousLastReviewedAt()));
        repository.delete("review_events", reviewId, owner);
        return new UndoResult(repository.topic(review.topicId(), owner));
    }

    public Assessment createAssessment(UUID accountId, AssessmentInput input) {
        return insertAssessment(repository.owner(accountId, true), input);
    }

    public List<Assessment> createAssessments(UUID accountId, BulkAssessments input) {
        UUID owner = repository.owner(accountId, true);
        validate(input);
        limitAggregate(input.assessments().stream().mapToInt(assessment -> assessment.topicIds().size()).sum(), "topic links");
        return input.assessments().stream().map(assessment -> insertAssessment(owner, assessment)).toList();
    }

    private Assessment insertAssessment(UUID owner, AssessmentInput input) {
        validateAssessment(owner, input);
        UUID id = UUID.randomUUID();
        var values = assessmentFields(input);
        values.putAll(fields("id", id, "owner_id", owner, "created_at", Instant.now(), "done_at", input.done() ? Instant.now() : null));
        repository.insert("assessments", values);
        repository.replaceLinks(id, owner, input.topicIds());
        return repository.assessment(id, owner);
    }

    public Assessment updateAssessment(UUID accountId, UUID id, AssessmentPatch patch) {
        UUID owner = repository.owner(accountId, true);
        Assessment previous = repository.assessment(id, owner);
        AssessmentInput input = merge(previous, patch, AssessmentInput.class, ASSESSMENT_FIELDS);
        validateAssessment(owner, input);
        var values = assessmentFields(input);
        values.putAll(fields("done_at", input.done() ? (previous.done() ? previous.doneAt() : Instant.now()) : null));
        repository.update("assessments", id, owner, values);
        repository.replaceLinks(id, owner, input.topicIds());
        return repository.assessment(id, owner);
    }

    public void deleteAssessment(UUID accountId, UUID id) { repository.delete("assessments", id, repository.owner(accountId, true)); }

    public CalendarEvent createEvent(UUID accountId, EventInput input) {
        UUID owner = repository.owner(accountId, true);
        validateEvent(input);
        UUID id = UUID.randomUUID();
        var values = eventFields(input);
        values.putAll(fields("id", id, "owner_id", owner));
        repository.insert("calendar_events", values);
        return repository.event(id, owner);
    }

    public CalendarEvent updateEvent(UUID accountId, UUID id, EventPatch patch) {
        UUID owner = repository.owner(accountId, true);
        EventInput input = merge(repository.event(id, owner), patch, EventInput.class, EVENT_FIELDS);
        validateEvent(input);
        repository.update("calendar_events", id, owner, eventFields(input));
        return repository.event(id, owner);
    }

    public void deleteEvent(UUID accountId, UUID id) { repository.delete("calendar_events", id, repository.owner(accountId, true)); }

    public StudySession createSession(UUID accountId, SessionInput input) {
        UUID owner = repository.owner(accountId, true);
        validate(input);
        if (input.courseId() != null) repository.course(input.courseId(), owner);
        if (input.topicId() != null) {
            Topic topic = repository.topic(input.topicId(), owner);
            if (input.courseId() != null && !input.courseId().equals(topic.courseId())) {
                throw new BadRequestException("courseId must match the topic's course.");
            }
        }
        UUID id = UUID.randomUUID();
        repository.insert("study_sessions", fields("id", id, "owner_id", owner, "topic_id", input.topicId(),
                "course_id", input.courseId(), "started_at", input.startedAt(), "minutes", input.minutes(), "note", input.note()));
        return new StudySession(id, input.topicId(), input.courseId(), input.startedAt().toInstant(), input.minutes(), input.note());
    }

    public void deleteSession(UUID accountId, UUID id) { repository.delete("study_sessions", id, repository.owner(accountId, true)); }

    private void limitAggregate(int count, String label) {
        if (count > 2000) throw new BadRequestException("A bulk request can contain at most 2000 " + label + ".");
    }

    private void validateAssessment(UUID owner, AssessmentInput input) {
        validate(input);
        if (input.courseId() != null) repository.course(input.courseId(), owner);
        if (new HashSet<>(input.topicIds()).size() != input.topicIds().size()) {
            throw new BadRequestException("topicIds must not contain duplicates.");
        }
        repository.requireTopics(owner, input.topicIds());
    }

    private void validateEvent(EventInput input) {
        validate(input);
        if (input.startTime() != null && input.endTime() != null && input.endTime().compareTo(input.startTime()) <= 0) {
            throw new BadRequestException("endTime must be after startTime.");
        }
    }

    private Map<String, Object> courseFields(CourseInput input) {
        return fields("code", input.code().trim(), "name", input.name().trim(), "color", input.color(), "term", input.term(),
                "instructor", input.instructor(), "email", input.email(), "website", input.website(), "status", input.status());
    }
    private Map<String, Object> topicFields(TopicInput input, boolean dateSupplied, boolean startSupplied) {
        LocalDate date = input.plannedDate();
        OffsetDateTime start = input.plannedStart();
        Integer minutes = input.plannedMinutes();
        if (dateSupplied && date == null) {
            start = null;
            minutes = null;
        } else if (!dateSupplied && startSupplied && start != null) {
            date = start.toLocalDate();
        }
        if (start != null && minutes == null) minutes = 60;
        return fields("course_id", input.courseId(), "title", input.title().trim(), "details", input.details(), "notes", input.notes(),
                "planned_date", date, "planned_start", start, "planned_minutes", minutes,
                "confidence", input.confidence(), "position", input.position());
    }
    private Map<String, Object> assessmentFields(AssessmentInput input) {
        return fields("course_id", input.courseId(), "title", input.title().trim(), "kind", input.kind(), "due_date", input.dueDate(),
                "due_time", localTime(input.dueTime()), "weight", input.weight(), "done", input.done(), "notes", input.notes());
    }
    private Map<String, Object> eventFields(EventInput input) {
        return fields("title", input.title().trim(), "date", input.date(), "start_time", localTime(input.startTime()),
                "end_time", localTime(input.endTime()), "color", input.color(), "done", input.done());
    }
    private LocalTime localTime(String value) { return value == null ? null : LocalTime.parse(value); }

    private <T> T merge(Object previous, FieldsPatch patch, Class<T> type, String[] allowed) {
        checkFields(patch, Set.of(allowed));
        ObjectNode json = project(previous, allowed);
        patch.fields().forEach(json::set);
        return decode(json, type);
    }
    private ObjectNode project(Object previous, String[] fields) {
        ObjectNode all = mapper.valueToTree(previous);
        ObjectNode result = mapper.createObjectNode();
        for (String field : fields) result.set(field, all.get(field));
        return result;
    }
    private void checkFields(FieldsPatch patch, Set<String> allowed) {
        for (String field : patch.fields().keySet()) {
            if (!allowed.contains(field)) throw new BadRequestException(field + " cannot be changed.");
        }
    }
    private <T> T decode(JsonNode json, Class<T> type) {
        try {
            T value = mapper.readerFor(type).with(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).readValue(json);
            return validate(value);
        } catch (java.io.IOException | IllegalArgumentException exception) {
            throw new BadRequestException("Invalid field value. Use YYYY-MM-DD dates and ISO-8601 instants with an offset or Z. " + exception.getMessage());
        }
    }
    private <T> T validate(T input) {
        if (input == null) throw new BadRequestException("A JSON object is required.");
        var violations = validator.validate(input);
        if (!violations.isEmpty()) {
            var violation = violations.stream().sorted(Comparator.comparing(v -> v.getPropertyPath().toString())).findFirst().orElseThrow();
            throw new BadRequestException(violation.getPropertyPath() + ": " + violation.getMessage());
        }
        return input;
    }
}
