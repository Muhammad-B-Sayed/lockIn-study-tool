package com.lockin.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
class StudyApiTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwords;
    @Autowired javax.sql.DataSource dataSource;
    @Autowired org.springframework.security.oauth2.jwt.JwtEncoder jwtEncoder;
    @MockitoSpyBean NamedParameterJdbcTemplate namedJdbc;
    UUID owner;
    UUID other;
    String username;
    String otherUsername;
    String token;
    String otherToken;

    @BeforeEach void seedOwners() {
        owner = UUID.randomUUID();
        other = UUID.randomUUID();
        username = "a-" + owner;
        otherUsername = "b-" + other;
        for (var entry : Map.of(owner, username, other, otherUsername).entrySet()) {
            jdbc.update("INSERT INTO app_users(id,username,password_hash) VALUES (?,?,?)", entry.getKey(), entry.getValue(), passwords.encode("secret123"));
        }
        token = token(owner.toString(), username);
        otherToken = token(other.toString(), otherUsername);
    }

    @AfterEach void cleanOwners() {
        jdbc.update("DELETE FROM app_users WHERE id IN (?,?) OR username IN (?,?)", owner, other, username, otherUsername);
    }

    @Test void coursesSupportCreatePartialPatchAndDeleteWithCascades() throws Exception {
        JsonNode course = course();
        String courseId = id(course);
        JsonNode topic = topic(courseId);
        String topicId = id(topic);
        create("/assessments", assessmentInput(courseId, List.of(topicId)));
        create("/sessions", sessionInput(courseId, topicId));
        create("/topics/" + topicId + "/reviews", json("rating", "okay", "source", "review"));
        JsonNode updated = update("/courses/" + courseId, json("status", "archived", "term", null));
        assertThat(updated.get("status").asText()).isEqualTo("archived");
        assertThat(updated.get("code")).isEqualTo(course.get("code"));
        assertThat(updated.get("term").isNull()).isTrue();
        remove("/courses/" + courseId);
        JsonNode workspace = workspace();
        for (String collection : List.of("courses", "topics", "assessments", "sessions", "reviews")) {
            assertThat(workspace.get(collection)).isEmpty();
        }
        assertThat(jdbc.queryForObject("SELECT count(*) FROM topic_resources WHERE owner_id=?", Integer.class, owner)).isZero();
    }

    @Test void topicSupportsResourcesPlanningPartialPatchesAndDelete() throws Exception {
        String courseId = id(course());
        ObjectNode input = topicInput(courseId);
        input.put("plannedStart", "2026-11-07T23:30:00-05:00");
        input.remove("plannedDate");
        input.putNull("plannedMinutes");
        JsonNode topic = create("/topics", input);
        assertThat(topic.get("plannedDate").asText()).isEqualTo("2026-11-07");
        assertThat(topic.get("plannedStart").asText()).isEqualTo("2026-11-08T04:30:00Z");
        assertThat(topic.get("plannedMinutes").asInt()).isEqualTo(60);
        String resourceId = topic.at("/resources/0/id").asText();
        String topicId = id(topic);
        JsonNode patched = update("/topics/" + topicId, json("details", null, "notes", "line one\nline two"));
        assertThat(patched.get("details").isNull()).isTrue();
        assertThat(patched.at("/resources/0/id").asText()).isEqualTo(resourceId);
        assertThat(patched.get("plannedDate")).isEqualTo(topic.get("plannedDate"));
        patched = update("/topics/" + topicId, json("resources", List.of(json("label", "Guide", "url", "https://example.com/guide"))));
        assertThat(patched.at("/resources/0/label").asText()).isEqualTo("Guide");
        assertThat(patched.at("/resources/0/id").asText()).isNotEqualTo(resourceId);
        patched = update("/topics/" + topicId, json("resources", List.of(), "plannedDate", "2026-11-09"));
        assertThat(patched.get("resources")).isEmpty();
        assertThat(patched.get("plannedStart").isNull()).isTrue();
        remove("/topics/" + topicId);
        assertThat(workspace().get("topics")).isEmpty();
    }

    @ParameterizedTest @ValueSource(strings={"/topics", "/topics/bulk"})
    void topicCreationPreservesExplicitLocalDateForTorontoEveningInUtc(String path) throws Exception {
        ObjectNode input = topicInput(id(course()));
        input.put("plannedDate", "2026-11-07");
        input.put("plannedStart", "2026-11-08T04:30:00Z");
        JsonNode result = create(path, path.endsWith("/bulk") ? json("topics", List.of(input)) : input);
        JsonNode topic = path.endsWith("/bulk") ? result.get(0) : result;
        assertThat(topic.get("plannedDate").asText()).isEqualTo("2026-11-07");
        assertThat(topic.get("plannedStart").asText()).isEqualTo("2026-11-08T04:30:00Z");
        assertThat(topic.get("plannedMinutes").asInt()).isEqualTo(60);
    }

    @ParameterizedTest @ValueSource(strings={"/topics", "/topics/bulk"})
    void topicCreationWithExplicitNullDateClearsTheWholePlan(String path) throws Exception {
        ObjectNode input = topicInput(id(course()));
        input.put("plannedStart", "2026-11-08T04:30:00Z");
        input.put("plannedMinutes", 45);
        JsonNode result = create(path, path.endsWith("/bulk") ? json("topics", List.of(input)) : input);
        JsonNode topic = path.endsWith("/bulk") ? result.get(0) : result;
        assertThat(topic.get("plannedDate").isNull()).isTrue();
        assertThat(topic.get("plannedStart").isNull()).isTrue();
        assertThat(topic.get("plannedMinutes").isNull()).isTrue();
    }

    @Test void topicPatchPreservesExplicitLocalDateForTorontoEveningInUtc() throws Exception {
        String path = "/topics/" + id(topic(id(course())));
        JsonNode topic = update(path, json("plannedDate", "2026-11-07", "plannedStart", "2026-11-08T04:30:00Z"));
        assertThat(topic.get("plannedDate").asText()).isEqualTo("2026-11-07");
        assertThat(topic.get("plannedStart").asText()).isEqualTo("2026-11-08T04:30:00Z");
        assertThat(topic.get("plannedMinutes").asInt()).isEqualTo(60);
        topic = update(path, json("notes", "Keep the local date"));
        assertThat(topic.get("plannedDate").asText()).isEqualTo("2026-11-07");
        assertThat(topic.get("plannedStart").asText()).isEqualTo("2026-11-08T04:30:00Z");
    }

    @Test void topicPatchDerivesDateOnlyWhenDateIsOmitted() throws Exception {
        String path = "/topics/" + id(topic(id(course())));
        update(path, json("plannedDate", "2026-11-01"));
        JsonNode topic = update(path, json("plannedStart", "2026-11-08T04:30:00Z"));
        assertThat(topic.get("plannedDate").asText()).isEqualTo("2026-11-08");
        topic = update(path, json("plannedStart", "2026-11-07T23:30:00-05:00"));
        assertThat(topic.get("plannedDate").asText()).isEqualTo("2026-11-07");
    }

    @Test void topicPatchWithNullDateClearsAllPlanningFieldsEvenWhenStartIsSupplied() throws Exception {
        String path = "/topics/" + id(topic(id(course())));
        for (ObjectNode patch : List.of(json("plannedDate", null),
                json("plannedDate", null, "plannedStart", "2026-11-08T04:30:00Z", "plannedMinutes", 90))) {
            update(path, json("plannedDate", "2026-11-07", "plannedStart", "2026-11-08T04:30:00Z", "plannedMinutes", 45));
            JsonNode topic = update(path, patch);
            assertThat(topic.get("plannedDate").isNull()).isTrue();
            assertThat(topic.get("plannedStart").isNull()).isTrue();
            assertThat(topic.get("plannedMinutes").isNull()).isTrue();
            topic = update(path, json("notes", "Still unplanned"));
            assertThat(topic.get("plannedStart").isNull()).isTrue();
            assertThat(topic.get("plannedMinutes").isNull()).isTrue();
        }
    }

    @Test void bulkTopicsAndAssessmentsReturnArrays() throws Exception {
        String course = id(course());
        JsonNode topics = create("/topics/bulk", json("topics", List.of(topicInput(course), topicInput(course))));
        assertThat(topics).hasSize(2);
        JsonNode assessments = create("/assessments/bulk", json("assessments", List.of(
                assessmentInput(course, List.of(id(topics.get(0)))), assessmentInput(null, List.of()))));
        assertThat(assessments).hasSize(2);
        assertThat(assessments.get(1).get("courseId").isNull()).isTrue();
    }

    @ParameterizedTest @ValueSource(strings={"topics", "assessments"})
    void bulkWritesRollBackWhenALaterReferenceIsNotOwned(String collection) throws Exception {
        String course = id(course());
        String foreignCourse = id(createAs(otherUsername, "/courses", courseInput()));
        ObjectNode valid = collection.equals("topics") ? topicInput(course) : assessmentInput(course, List.of());
        ObjectNode invalid = collection.equals("topics") ? topicInput(foreignCourse) : assessmentInput(foreignCourse, List.of());
        request("POST", "/" + collection + "/bulk", json(collection, List.of(valid, invalid)), username, 404);
        assertThat(workspace().get(collection)).isEmpty();
    }

    @Test void assessmentDoneAtTracksTransitionsAndLinksCanBeReplaced() throws Exception {
        String course = id(course());
        String topic = id(topic(course));
        JsonNode assessment = create("/assessments", assessmentInput(course, List.of(topic)));
        assertThat(assessment.get("doneAt").isNull()).isTrue();
        String path = "/assessments/" + id(assessment);
        JsonNode done = update(path, json("done", true, "dueTime", "23:59", "weight", 25.5));
        assertThat(done.get("doneAt").asText()).endsWith("Z");
        assertThat(done.get("dueTime").asText()).isEqualTo("23:59");
        assertThat(done.get("weight").asDouble()).isEqualTo(25.5);
        JsonNode edited = update(path, json("notes", "Read chapter 4"));
        assertThat(edited.get("doneAt")).isEqualTo(done.get("doneAt"));
        edited = update(path, json("done", false, "topicIds", List.of(), "courseId", null, "weight", null, "dueTime", null));
        assertThat(edited.get("doneAt").isNull()).isTrue();
        assertThat(edited.get("topicIds")).isEmpty();
        assertThat(edited.get("courseId").isNull()).isTrue();
        remove(path);
        assertThat(workspace().get("assessments")).isEmpty();
    }

    @Test void eventsUseMinuteTimesAndSupportNullClearingAndDeletion() throws Exception {
        JsonNode event = create("/events", eventInput());
        assertThat(event.get("startTime").asText()).isEqualTo("14:00");
        JsonNode updated = update("/events/" + id(event), json("startTime", null, "endTime", null, "done", true, "color", "orchid"));
        assertThat(updated.get("startTime").isNull()).isTrue();
        assertThat(updated.get("endTime").isNull()).isTrue();
        assertThat(updated.get("done").asBoolean()).isTrue();
        remove("/events/" + id(event));
        assertThat(workspace().get("events")).isEmpty();
    }

    @Test void sessionsMayBeUnlinkedAndCanBeDeleted() throws Exception {
        JsonNode session = create("/sessions", sessionInput(null, null));
        assertThat(session.get("courseId").isNull()).isTrue();
        assertThat(session.get("topicId").isNull()).isTrue();
        assertThat(Instant.parse(session.get("startedAt").asText())).isNotNull();
        remove("/sessions/" + id(session));
        assertThat(workspace().get("sessions")).isEmpty();
    }

    @Test void reviewUndoRestoresConfidenceAndPreviousTimestampAndRejectsOlderReview() throws Exception {
        String topic = id(topic(id(course())));
        update("/topics/" + topic, json("confidence", "shaky", "lastReviewedAt", "2026-10-01T10:00:00+02:00"));
        JsonNode first = create("/topics/" + topic + "/reviews", json("rating", "okay", "source", "review"));
        assertThat(first.at("/review/previous").asText()).isEqualTo("shaky");
        assertThat(first.at("/topic/confidence").asText()).isEqualTo("okay");
        assertThat(first.at("/topic/lastReviewedAt")).isEqualTo(first.at("/review/at"));
        JsonNode second = create("/topics/" + topic + "/reviews", json("rating", "solid", "source", "focus"));
        request("DELETE", "/reviews/" + first.at("/review/id").asText(), null, username, 409);
        JsonNode undo = request("DELETE", "/reviews/" + second.at("/review/id").asText(), null, username, 200);
        assertThat(undo.at("/topic/lastReviewedAt")).isEqualTo(first.at("/topic/lastReviewedAt"));
        assertThat(undo.at("/topic/confidence").asText()).isEqualTo("okay");
        undo = request("DELETE", "/reviews/" + first.at("/review/id").asText(), null, username, 200);
        assertThat(undo.at("/topic/confidence").asText()).isEqualTo("shaky");
        assertThat(undo.at("/topic/lastReviewedAt").asText()).isEqualTo("2026-10-01T08:00:00Z");
        request("DELETE", "/reviews/" + first.at("/review/id").asText(), null, username, 404);
    }

    @Test void undoFirstReviewRestoresNullLastReviewedAt() throws Exception {
        String topic = id(topic(id(course())));
        JsonNode rating = create("/topics/" + topic + "/reviews", json("rating", "shaky", "source", "topic"));
        JsonNode undo = request("DELETE", "/reviews/" + rating.at("/review/id").asText(), null, username, 200);
        assertThat(undo.at("/topic/lastReviewedAt").isNull()).isTrue();
        assertThat(undo.at("/topic/confidence").asText()).isEqualTo("unrated");
    }

    @ParameterizedTest @ValueSource(strings={"unrated", "retired"})
    void unratedAndRetiredLeaveLastReviewedAtUnchanged(String rating) throws Exception {
        String topic = id(topic(id(course())));
        update("/topics/" + topic, json("lastReviewedAt", "2026-10-02T10:00:00Z"));
        JsonNode result = create("/topics/" + topic + "/reviews", json("rating", rating, "source", "topic"));
        assertThat(result.at("/topic/lastReviewedAt").asText()).isEqualTo("2026-10-02T10:00:00Z");
        assertThat(result.at("/topic/confidence").asText()).isEqualTo(rating);
    }

    @Test void deletingTopicCascadesReviewsAndSessionsAndRemovesAssessmentLinks() throws Exception {
        String course = id(course());
        String topic = id(topic(course));
        create("/assessments", assessmentInput(course, List.of(topic)));
        create("/sessions", sessionInput(null, topic));
        create("/topics/" + topic + "/reviews", json("rating", "solid", "source", "topic"));
        remove("/topics/" + topic);
        JsonNode workspace = workspace();
        assertThat(workspace.get("reviews")).isEmpty();
        assertThat(workspace.get("sessions")).isEmpty();
        assertThat(workspace.at("/assessments/0/topicIds")).isEmpty();
    }

    @Test void workspaceReturnsExactContractWithoutNPlusOneAndOnlyRecentHistory() throws Exception {
        String course = id(course());
        String topic = id(topic(course));
        String otherTopic = id(topic(course));
        create("/assessments", assessmentInput(course, List.of(topic, otherTopic)));
        create("/events", eventInput());
        create("/sessions", sessionInput(course, topic));
        ObjectNode oldSession = sessionInput(course, topic);
        oldSession.put("startedAt", Instant.now().minusSeconds(121L * 86400).toString());
        create("/sessions", oldSession);
        JsonNode oldReview = create("/topics/" + topic + "/reviews", json("rating", "okay", "source", "review"));
        jdbc.update("UPDATE review_events SET at=CURRENT_TIMESTAMP-INTERVAL '121 days' WHERE id=?", UUID.fromString(oldReview.at("/review/id").asText()));
        create("/topics/" + otherTopic + "/reviews", json("rating", "solid", "source", "focus"));
        createAs(otherUsername, "/courses", courseInput());
        clearInvocations(namedJdbc);
        JsonNode workspace = workspace();
        verify(namedJdbc, times(6)).query(anyString(), anyMap(), any(RowMapper.class));
        verify(namedJdbc, times(2)).query(anyString(), anyMap(), any(RowCallbackHandler.class));
        assertKeys(workspace, "user", "courses", "topics", "assessments", "events", "sessions", "reviews", "generatedAt");
        assertKeys(workspace.get("user"), "id", "username", "createdAt");
        assertKeys(workspace.at("/courses/0"), "id","code","name","color","term","instructor","email","website","status","createdAt");
        assertKeys(workspace.at("/topics/0"), "id","courseId","title","details","notes","plannedDate","plannedStart","plannedMinutes","confidence","lastReviewedAt","position","resources","createdAt");
        assertKeys(workspace.at("/topics/0/resources/0"), "id","label","url");
        assertKeys(workspace.at("/assessments/0"), "id","courseId","title","kind","dueDate","dueTime","weight","done","doneAt","notes","topicIds","createdAt");
        assertKeys(workspace.at("/events/0"), "id","title","date","startTime","endTime","color","done");
        assertKeys(workspace.at("/sessions/0"), "id","topicId","courseId","startedAt","minutes","note");
        assertKeys(workspace.at("/reviews/0"), "id","topicId","rating","previous","at","source");
        assertThat(workspace.get("courses")).hasSize(1);
        assertThat(workspace.get("sessions")).hasSize(1);
        assertThat(workspace.get("reviews")).hasSize(1);
        assertThat(workspace.at("/assessments/0/topicIds")).hasSize(2);
        assertThat(Instant.parse(workspace.get("generatedAt").asText())).isNotNull();
    }

    @ParameterizedTest @CsvSource({"courses,PATCH", "courses,DELETE", "topics,PATCH", "topics,DELETE", "assessments,PATCH", "assessments,DELETE", "events,PATCH", "events,DELETE", "sessions,DELETE", "reviews,DELETE", "rating,POST"})
    void foreignEntityIdsReturn404ForEveryMutation(String entity, String method) throws Exception {
        String foreignCourse = id(createAs(otherUsername, "/courses", courseInput()));
        JsonNode foreignTopic = createAs(otherUsername, "/topics", topicInput(foreignCourse));
        String foreignId = switch(entity) {
            case "courses" -> foreignCourse;
            case "topics", "rating" -> id(foreignTopic);
            case "assessments" -> id(createAs(otherUsername, "/assessments", assessmentInput(foreignCourse, List.of())));
            case "events" -> id(createAs(otherUsername, "/events", eventInput()));
            case "sessions" -> id(createAs(otherUsername, "/sessions", sessionInput(foreignCourse, id(foreignTopic))));
            case "reviews" -> createAs(otherUsername, "/topics/" + id(foreignTopic) + "/reviews", json("rating", "solid", "source", "focus")).at("/review/id").asText();
            default -> throw new AssertionError(entity);
        };
        String path = entity.equals("rating") ? "/topics/" + foreignId + "/reviews" : "/" + entity + "/" + foreignId;
        request(method, path, entity.equals("rating") ? json("rating", "shaky", "source", "topic") : json(), username, 404);
    }

    @Test void foreignReferencesReturn404AndInconsistentOwnedSessionReturns400() throws Exception {
        String course = id(course());
        String topic = id(topic(course));
        String foreignCourse = id(createAs(otherUsername, "/courses", courseInput()));
        String foreignTopic = id(createAs(otherUsername, "/topics", topicInput(foreignCourse)));
        request("POST", "/topics", topicInput(foreignCourse), username, 404);
        request("POST", "/assessments", assessmentInput(foreignCourse, List.of()), username, 404);
        request("POST", "/assessments", assessmentInput(course, List.of(foreignTopic)), username, 404);
        JsonNode assessment = create("/assessments", assessmentInput(course, List.of()));
        request("PATCH", "/assessments/" + id(assessment), json("topicIds", List.of(foreignTopic)), username, 404);
        request("PATCH", "/assessments/" + id(assessment), json("courseId", foreignCourse), username, 404);
        request("POST", "/sessions", sessionInput(course, foreignTopic), username, 404);
        request("POST", "/sessions", sessionInput(foreignCourse, null), username, 404);
        request("POST", "/sessions", sessionInput(id(course()), topic), username, 400);
    }

    @ParameterizedTest @CsvSource({"courses,code", "topics,title", "assessments,dueDate", "events,date", "sessions,startedAt"})
    void requiredFieldsReturn400WithFieldName(String collection, String field) throws Exception {
        String course = id(course());
        ObjectNode input = switch(collection) {
            case "courses" -> courseInput();
            case "topics" -> topicInput(course);
            case "assessments" -> assessmentInput(course, List.of());
            case "events" -> eventInput();
            case "sessions" -> sessionInput(course, null);
            default -> throw new AssertionError(collection);
        };
        input.remove(field);
        JsonNode error = request("POST", "/" + collection, input, username, 400);
        assertThat(error.get("message").asText()).contains(field);
    }

    @ParameterizedTest @CsvSource({"courses,color,red", "courses,status,paused", "topics,confidence,mastered", "assessments,kind,midterm", "events,color,#ffffff", "events,startTime,9:30", "events,endTime,25:00", "assessments,dueTime,12:30:00"})
    void invalidEnumsColorsAndTimesReturn400(String entity, String field, String value) throws Exception {
        String course = id(course());
        JsonNode created = switch(entity) {
            case "courses" -> create("/courses", courseInput());
            case "topics" -> topic(course);
            case "assessments" -> create("/assessments", assessmentInput(course, List.of()));
            case "events" -> create("/events", eventInput());
            default -> throw new AssertionError(entity);
        };
        JsonNode error = request("PATCH", "/" + entity + "/" + id(created), json(field, value), username, 400);
        assertThat(error.get("message").asText()).contains(field);
    }

    @Test void lengthsRangesMalformedValuesAndImmutableFieldsReturn400() throws Exception {
        String course = id(course());
        String topic = id(topic(course));
        request("PATCH", "/courses/" + course, json("name", "x".repeat(201)), username, 400);
        request("PATCH", "/topics/" + topic, json("courseId", course), username, 400);
        request("PATCH", "/topics/" + topic, json("resources", null), username, 400);
        request("PATCH", "/topics/" + topic, json("resources", List.of(json("label", "Bad", "url", "javascript:alert(1)"))), username, 400);
        request("PATCH", "/topics/" + topic, json("plannedMinutes", 0), username, 400);
        request("PATCH", "/topics/" + topic, json("plannedStart", "2026-11-07T14:00:00"), username, 400);
        request("PATCH", "/topics/" + topic, json("plannedStart", 1794060000), username, 400);
        request("PATCH", "/topics/" + topic, json("lastReviewedAt", 1794060000), username, 400);
        request("PATCH", "/topics/" + topic, json("plannedDate", "2026-02-30"), username, 400);
        request("PATCH", "/topics/" + topic, json("plannedDate", "2026-11-07T14:00:00"), username, 400);
        request("POST", "/courses", json("code", "X", "name", "Name", "color", "sky", "status", "active", "ownerId", owner), username, 400);
        request("POST", "/topics/bulk", json("topics", List.of()), username, 400);
        request("POST", "/assessments/bulk", json("assessments", List.of()), username, 400);
        request("POST", "/topics/" + topic + "/reviews", json("rating", "Solid", "source", "topic"), username, 400);
        request("POST", "/topics/" + topic + "/reviews", json("rating", "solid", "source", "other"), username, 400);
        request("POST", "/topics/" + topic + "/reviews", json(), username, 400);
        ObjectNode assessment = assessmentInput(course, List.of(topic, topic));
        request("POST", "/assessments", assessment, username, 400);
        assessment.set("topicIds", mapper.valueToTree(List.of(topic)));
        assessment.put("weight", 101);
        request("POST", "/assessments", assessment, username, 400);
        ObjectNode event = eventInput();
        event.put("endTime", "13:00");
        request("POST", "/events", event, username, 400);
        ObjectNode session = sessionInput(null, null);
        session.put("minutes", 0);
        request("POST", "/sessions", session, username, 400);
        request("DELETE", "/topics/not-a-uuid", null, username, 400);
        mvc.perform(post("/api/courses").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON).content("{bad json"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").exists());
    }

    @ParameterizedTest @ValueSource(strings={"/tasks", "/calendar", "/dashboard", "/me/tasks", "/me/calendar", "/me/dashboard/due-soon"})
    void oldEndpointsAreRemoved(String path) throws Exception { request("GET", path, null, username, 404); }

    @Test void profilePasswordChangeAndAccountDeleteStillWork() throws Exception {
        request("GET", "/auth/me", null, username, 200);
        request("GET", "/me", null, username, 200);
        JsonNode course = course();
        topic(id(course));
        request("PATCH", "/me/password", json("currentPassword", "secret123", "password", "new-secret"), username, 200);
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(json("username", username, "password", "new-secret"))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.accessToken").isString());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(json("username", username, "password", "secret123"))))
                .andExpect(status().isUnauthorized());
        request("DELETE", "/me", null, username, 204);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM courses WHERE owner_id=?", Integer.class, owner)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM topics WHERE owner_id=?", Integer.class, owner)).isZero();
    }

    @Test void passwordChangeRejectsWrongCurrentPasswordAndPreservesTheHash() throws Exception {
        String oldHash = jdbc.queryForObject("SELECT password_hash FROM app_users WHERE id=?", String.class, owner);
        JsonNode error = request("PATCH", "/me/password", json("currentPassword", "wrong-password", "password", "new-secret"), username, 400);
        assertThat(error.get("message").asText()).isEqualTo("Your current password is wrong.");
        assertThat(jdbc.queryForObject("SELECT password_hash FROM app_users WHERE id=?", String.class, owner)).isEqualTo(oldHash);
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(json("username", username, "password", "secret123"))))
                .andExpect(status().isOk());
    }

    @Test void passwordChangeRequiresBothFieldsAndAnEightCharacterNewPassword() throws Exception {
        for (ObjectNode input : List.of(
                json("password", "new-secret"),
                json("currentPassword", "", "password", "new-secret"),
                json("currentPassword", "   ", "password", "new-secret"),
                json("currentPassword", "secret123"),
                json("currentPassword", "secret123", "password", ""),
                json("currentPassword", "secret123", "password", "short"))) {
            request("PATCH", "/me/password", input, username, 400);
        }
    }

    @Test void signupUsesTheSameMinimumPasswordLength() throws Exception {
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(json("username", "new-user", "password", "short", "repeatPassword", "short"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("password: Password must be at least 8 characters."));
    }

    @Test void deletedAccountTokenCannotAccessAReplacementWithTheSameUsername() throws Exception {
        remove("/me");
        String signup = mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(json("username", username, "password", "secret123", "repeatPassword", "secret123"))))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        JsonNode replacement = mapper.readTree(signup);
        String replacementToken = replacement.get("accessToken").asText();
        assertThat(replacement.at("/user/id").asText()).isNotEqualTo(owner.toString());
        requestWithToken("POST", "/courses", courseInput(), replacementToken, 201);

        for (String path : List.of("/workspace", "/me", "/auth/me")) {
            JsonNode error = requestWithToken("GET", path, null, token, 401);
            assertThat(error.get("message").asText()).isEqualTo("Authentication required.");
        }
        requestWithToken("POST", "/courses", courseInput(), token, 401);
        requestWithToken("PATCH", "/me/password", json("currentPassword", "secret123", "password", "new-secret"), token, 401);
        requestWithToken("DELETE", "/me", null, token, 401);
        JsonNode workspace = requestWithToken("GET", "/workspace", null, replacementToken, 200);
        assertThat(workspace.at("/user/id")).isEqualTo(replacement.at("/user/id"));
        assertThat(workspace.get("courses")).hasSize(1);
    }

    @ParameterizedTest @ValueSource(strings={"missing", "malformed", "unknown", "username-mismatch", "wrong-type"})
    void signedTokensMustIdentifyTheExistingAccountIdAndMatchingUsername(String fault) throws Exception {
        String bearer = switch (fault) {
            case "missing" -> token(null, username);
            case "malformed" -> token("invalid-uuid", username);
            case "unknown" -> token(UUID.randomUUID().toString(), username);
            case "username-mismatch" -> token(owner.toString(), otherUsername);
            case "wrong-type" -> token(123, username);
            default -> throw new AssertionError(fault);
        };
        JsonNode error = requestWithToken("GET", "/workspace", null, bearer, 401);
        assertThat(error.get("message").asText()).isEqualTo("Authentication required.");
    }

    @ParameterizedTest @ValueSource(strings={"ascii", "accented", "emoji"})
    void oversizedUtf8PasswordsReturn400ForSignupLoginAndPasswordChanges(String alphabet) throws Exception {
        String oversized = switch (alphabet) {
            case "ascii" -> "x".repeat(73);
            case "accented" -> "é".repeat(37);
            case "emoji" -> "🙂".repeat(19);
            default -> throw new AssertionError(alphabet);
        };
        assertThat(oversized.getBytes(java.nio.charset.StandardCharsets.UTF_8).length).isGreaterThan(72);
        for (String route : List.of("signup", "login")) {
            ObjectNode input = json("username", username, "password", oversized);
            if (route.equals("signup")) input.put("repeatPassword", oversized);
            mvc.perform(post("/api/auth/" + route).contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(input)))
                    .andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("at most 72 bytes in UTF-8")));
        }
        for (ObjectNode input : List.of(json("currentPassword", "secret123", "password", oversized),
                json("currentPassword", oversized, "password", "new-secret"))) {
            JsonNode error = request("PATCH", "/me/password", input, username, 400);
            assertThat(error.get("message").asText()).contains("at most 72 bytes in UTF-8");
        }
        mvc.perform(post("/api/auth/signup").contentType(MediaType.APPLICATION_JSON)
                .content(mapper.writeValueAsString(json("username", username, "password", "secret123", "repeatPassword", oversized))))
                .andExpect(status().isBadRequest());
        String hash = jdbc.queryForObject("SELECT password_hash FROM app_users WHERE id=?", String.class, owner);
        assertThat(passwords.matches("secret123", hash)).isTrue();
    }

    @Test void passwordsAtExactly72Utf8BytesCanBeChangedAndUsedToSignIn() throws Exception {
        String current = "secret123";
        for (String password : List.of("x".repeat(72), "é".repeat(36), "🙂".repeat(18))) {
            request("PATCH", "/me/password", json("currentPassword", current, "password", password), username, 200);
            mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                    .content(mapper.writeValueAsString(json("username", username, "password", password))))
                    .andExpect(status().isOk());
            current = password;
        }
    }

    @ParameterizedTest @ValueSource(strings={"topics", "assessments"})
    void bulkRequestsRejectMoreThan300ParentsBeforeWritingAnyRows(String collection) throws Exception {
        String course = id(course());
        ObjectNode item = collection.equals("topics") ? topicInput(course) : assessmentInput(course, List.of());
        JsonNode error = request("POST", "/" + collection + "/bulk", json(collection, Collections.nCopies(301, item)), username, 400);
        assertThat(error.get("message").asText()).contains("300");
        assertThat(workspace().get(collection)).isEmpty();
    }

    @Test void assessmentBulkCapsAggregateLinksAndBatchesTheAccepted2000Links() throws Exception {
        String course = id(course());
        List<String> topicIds = java.util.stream.IntStream.range(0, 250).mapToObj(i -> UUID.randomUUID().toString()).toList();
        List<Object[]> rows = topicIds.stream().map(id -> new Object[]{UUID.fromString(id), owner, UUID.fromString(course)}).toList();
        jdbc.batchUpdate("INSERT INTO topics(id,owner_id,course_id,title,notes,confidence,position,created_at) VALUES (?,?,?,'Topic','','unrated',0,CURRENT_TIMESTAMP)", rows);
        ObjectNode item = assessmentInput(course, topicIds);
        JsonNode error = request("POST", "/assessments/bulk", json("assessments", Collections.nCopies(9, item)), username, 400);
        assertThat(error.get("message").asText()).contains("at most 2000 topic links");
        assertThat(workspace().get("assessments")).isEmpty();
        clearInvocations(namedJdbc);
        JsonNode created = create("/assessments/bulk", json("assessments", Collections.nCopies(8, item)));
        assertThat(created).hasSize(8);
        assertThat(created.get(0).get("topicIds")).isEqualTo(mapper.valueToTree(topicIds));
        verify(namedJdbc, times(8)).batchUpdate(startsWith("INSERT INTO assessment_topics"), any(org.springframework.jdbc.core.namedparam.SqlParameterSource[].class));
        verify(namedJdbc, never()).update(startsWith("INSERT INTO assessment_topics"), anyMap());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM assessment_topics WHERE owner_id=?", Integer.class, owner)).isEqualTo(2000);
    }

    @Test void topicBulkCapsAggregateResourcesAndResourceWritesUseABatch() throws Exception {
        String course = id(course());
        ObjectNode item = topicInput(course);
        ObjectNode resource = json("label", "Notes", "url", "https://example.com/notes");
        item.set("resources", mapper.valueToTree(Collections.nCopies(100, resource)));
        JsonNode error = request("POST", "/topics/bulk", json("topics", Collections.nCopies(21, item)), username, 400);
        assertThat(error.get("message").asText()).contains("at most 2000 resources");
        assertThat(workspace().get("topics")).isEmpty();
        item.set("resources", mapper.valueToTree(List.of(resource, json("label", "Guide", "url", "https://example.com/guide"))));
        clearInvocations(namedJdbc);
        JsonNode created = create("/topics", item);
        assertThat(created.get("resources")).hasSize(2);
        assertThat(created.at("/resources/1/label").asText()).isEqualTo("Guide");
        verify(namedJdbc).batchUpdate(startsWith("INSERT INTO topic_resources"), any(org.springframework.jdbc.core.namedparam.SqlParameterSource[].class));
        verify(namedJdbc, never()).update(startsWith("INSERT INTO topic_resources"), anyMap());
    }

    @Test void migrationCopiesV1DataBeforeDroppingLegacyTables() {
        String schema = "migration_" + UUID.randomUUID().toString().replace("-", "");
        var flyway = org.flywaydb.core.Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema);
        try {
            flyway.target("1").load().migrate();
            UUID a = UUID.randomUUID(), b = UUID.randomUUID();
            UUID task = UUID.randomUUID(), event = UUID.randomUUID();
            jdbc.update("INSERT INTO " + schema + ".app_users(id,username,password_hash) VALUES (?, 'a', 'hash'), (?, 'b', 'hash')", a, b);
            jdbc.update("INSERT INTO " + schema + ".tasks(id,owner_id,title,description,course,type,due_date,completed,created_at,updated_at) "
                    + "VALUES (?,?,'Assignment 1','Keep these notes',' CSC369 ','Assignment',NULL,true,'2026-09-01 10:00:00','2026-09-02 12:00:00')", task, a);
            jdbc.update("INSERT INTO " + schema + ".tasks(id,owner_id,title,course,type,due_date) VALUES (?,?,'Exam','CSC369','Exam','2026-12-01')", UUID.randomUUID(), a);
            jdbc.update("INSERT INTO " + schema + ".tasks(id,owner_id,title,course,type,due_date) VALUES (?,?,'Other owner','CSC369','Quiz','2026-12-02')", UUID.randomUUID(), b);
            jdbc.update("INSERT INTO " + schema + ".tasks(id,owner_id,title,course,type) VALUES (?,?,'Personal task','   ','Unknown')", UUID.randomUUID(), a);
            jdbc.update("INSERT INTO " + schema + ".tasks(id,owner_id,title,course,type) VALUES (?,?,'No course',NULL,'Project')", UUID.randomUUID(), a);
            for (int i = 0; i < 9; i++) {
                jdbc.update("INSERT INTO " + schema + ".tasks(id,owner_id,title,course,type) VALUES (?,?,?,?,'Task')", UUID.randomUUID(), a, "Task " + i, "Course " + i);
            }
            jdbc.update("INSERT INTO " + schema + ".calendar_events(id,owner_id,name,event_date,color_hex,completed) VALUES (?,?,'Work shift','2026-11-07','#ff0000',true)", event, a);
            flyway.target("2").load().migrate();
            assertThat(jdbc.queryForObject("SELECT count(*) FROM " + schema + ".courses", Integer.class)).isEqualTo(11);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM " + schema + ".courses WHERE code='CSC369'", Integer.class)).isEqualTo(2);
            assertThat(jdbc.queryForList("SELECT color FROM " + schema + ".courses WHERE owner_id=? ORDER BY code", String.class, a))
                    .containsExactly("ember", "amber", "moss", "teal", "sky", "iris", "orchid", "slate", "ember", "amber");
            Map<String, Object> copied = jdbc.queryForMap("SELECT * FROM " + schema + ".assessments WHERE id=?", task);
            assertThat(copied.get("kind")).isEqualTo("assignment");
            assertThat(copied.get("due_date").toString()).isEqualTo("2026-09-01");
            assertThat(copied.get("done")).isEqualTo(true);
            assertThat(copied.get("notes")).isEqualTo("Keep these notes");
            assertThat(copied.get("done_at")).isNotNull();
            assertThat(copied.get("course_id")).isNotNull();
            assertThat(jdbc.queryForObject("SELECT kind FROM " + schema + ".assessments WHERE title='Personal task'", String.class)).isEqualTo("task");
            assertThat(jdbc.queryForObject("SELECT count(*) FROM " + schema + ".assessments WHERE course_id IS NULL", Integer.class)).isEqualTo(2);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM " + schema + ".assessments", Integer.class)).isEqualTo(14);
            Map<String, Object> copiedEvent = jdbc.queryForMap("SELECT * FROM " + schema + ".calendar_events WHERE id=?", event);
            assertThat(copiedEvent.get("color")).isEqualTo("slate");
            assertThat(copiedEvent.get("title")).isEqualTo("Work shift");
            assertThat(copiedEvent.get("done")).isEqualTo(true);
            assertThat(copiedEvent.get("date").toString()).isEqualTo("2026-11-07");
            assertThat(copiedEvent.get("start_time")).isNull();
            assertThat(jdbc.queryForObject("SELECT to_regclass(?) IS NULL", Boolean.class, schema + ".tasks")).isTrue();
            assertThat(jdbc.queryForObject("SELECT to_regclass(?) IS NULL", Boolean.class, schema + ".legacy_calendar_events")).isTrue();
            jdbc.update("DELETE FROM " + schema + ".app_users WHERE id=?", a);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM " + schema + ".assessments", Integer.class)).isEqualTo(1);
            assertThat(jdbc.queryForObject("SELECT count(*) FROM " + schema + ".calendar_events", Integer.class)).isZero();
        } finally {
            jdbc.execute("DROP SCHEMA IF EXISTS " + schema + " CASCADE");
        }
    }

    private JsonNode course() throws Exception { return create("/courses", courseInput()); }
    private JsonNode topic(String course) throws Exception { return create("/topics", topicInput(course)); }
    private JsonNode workspace() throws Exception { return request("GET", "/workspace", null, username, 200); }
    private JsonNode create(String path, Object body) throws Exception { return createAs(username, path, body); }
    private JsonNode createAs(String user, String path, Object body) throws Exception { return request("POST", path, body, user, 201); }
    private JsonNode update(String path, Object body) throws Exception { return request("PATCH", path, body, username, 200); }
    private void remove(String path) throws Exception { request("DELETE", path, null, username, 204); }
    private String id(JsonNode node) { return node.get("id").asText(); }
    private JsonNode request(String method, String path, Object body, String user, int expected) throws Exception {
        return requestWithToken(method, path, body, user.equals(username) ? token : otherToken, expected);
    }
    private JsonNode requestWithToken(String method, String path, Object body, String bearer, int expected) throws Exception {
        MockHttpServletRequestBuilder request = org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request(HttpMethod.valueOf(method), "/api" + path)
                .header("Authorization", "Bearer " + bearer);
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body));
        String result = mvc.perform(request).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString();
        return result.isBlank() ? null : mapper.readTree(result);
    }
    private String token(Object uid, String subject) {
        Instant now = Instant.now();
        var claims = org.springframework.security.oauth2.jwt.JwtClaimsSet.builder()
                .issuer("lockin-backend").subject(subject).issuedAt(now).expiresAt(now.plusSeconds(3600));
        if (uid != null) claims.claim("uid", uid);
        return jwtEncoder.encode(org.springframework.security.oauth2.jwt.JwtEncoderParameters.from(
                org.springframework.security.oauth2.jwt.JwsHeader.with(org.springframework.security.oauth2.jose.jws.MacAlgorithm.HS256).build(),
                claims.build())).getTokenValue();
    }
    private ObjectNode json(Object... pairs) {
        ObjectNode node = mapper.createObjectNode();
        for (int i = 0; i < pairs.length; i += 2) node.set((String)pairs[i], mapper.valueToTree(pairs[i+1]));
        return node;
    }
    private ObjectNode courseInput() { return json("code", "CSC369", "name", "Operating Systems", "color", "sky", "term", "Fall 2026", "instructor", null, "email", null, "website", null, "status", "active"); }
    private ObjectNode topicInput(String course) { return json("courseId", course, "title", "Scheduling", "details", "CPU time", "notes", "", "plannedDate", null, "plannedStart", null, "plannedMinutes", null, "confidence", "unrated", "position", 0, "resources", List.of(json("label", "Notes", "url", "https://example.com/notes"))); }
    private ObjectNode assessmentInput(String course, List<String> topics) { return json("courseId", course, "title", "Midterm", "kind", "exam", "dueDate", "2026-11-12", "dueTime", null, "weight", null, "done", false, "notes", "", "topicIds", topics); }
    private ObjectNode eventInput() { return json("title", "Work shift", "date", "2026-11-08", "startTime", "14:00", "endTime", "15:30", "color", "slate", "done", false); }
    private ObjectNode sessionInput(String course, String topic) { return json("courseId", course, "topicId", topic, "startedAt", Instant.now().toString(), "minutes", 25, "note", null); }
    private void assertKeys(JsonNode node, String... expected) {
        Set<String> fields = new HashSet<>();
        node.fieldNames().forEachRemaining(fields::add);
        assertThat(fields).containsExactlyInAnyOrder(expected);
    }
}
