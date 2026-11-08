package com.lockin.backend.controller;

import com.lockin.backend.dto.StudyDtos.*;
import com.lockin.backend.service.StudyService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class StudyController {
    private final StudyService service;
    public StudyController(StudyService service) { this.service = service; }

    @GetMapping("/workspace")
    public Workspace workspace(Authentication auth) { return service.workspace(UUID.fromString(auth.getName())); }

    @PostMapping("/courses") @ResponseStatus(HttpStatus.CREATED)
    public Course createCourse(Authentication auth, @Valid @RequestBody CourseInput input) { return service.createCourse(UUID.fromString(auth.getName()), input); }
    @PatchMapping("/courses/{id}")
    public Course updateCourse(Authentication auth, @PathVariable UUID id, @RequestBody CoursePatch input) { return service.updateCourse(UUID.fromString(auth.getName()), id, input); }
    @DeleteMapping("/courses/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCourse(Authentication auth, @PathVariable UUID id) { service.deleteCourse(UUID.fromString(auth.getName()), id); }

    @PostMapping("/topics") @ResponseStatus(HttpStatus.CREATED)
    public Topic createTopic(Authentication auth, @Valid @RequestBody TopicInput input) { return service.createTopic(UUID.fromString(auth.getName()), input); }
    @PostMapping("/topics/bulk") @ResponseStatus(HttpStatus.CREATED)
    public List<Topic> createTopics(Authentication auth, @Valid @RequestBody BulkTopics input) { return service.createTopics(UUID.fromString(auth.getName()), input); }
    @PatchMapping("/topics/{id}")
    public Topic updateTopic(Authentication auth, @PathVariable UUID id, @RequestBody TopicPatch input) { return service.updateTopic(UUID.fromString(auth.getName()), id, input); }
    @DeleteMapping("/topics/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTopic(Authentication auth, @PathVariable UUID id) { service.deleteTopic(UUID.fromString(auth.getName()), id); }

    @PostMapping("/topics/{id}/reviews") @ResponseStatus(HttpStatus.CREATED)
    public RateResult rate(Authentication auth, @PathVariable UUID id, @Valid @RequestBody ReviewInput input) { return service.rate(UUID.fromString(auth.getName()), id, input); }
    @DeleteMapping("/reviews/{id}")
    public UndoResult undo(Authentication auth, @PathVariable UUID id) { return service.undo(UUID.fromString(auth.getName()), id); }

    @PostMapping("/assessments") @ResponseStatus(HttpStatus.CREATED)
    public Assessment createAssessment(Authentication auth, @Valid @RequestBody AssessmentInput input) { return service.createAssessment(UUID.fromString(auth.getName()), input); }
    @PostMapping("/assessments/bulk") @ResponseStatus(HttpStatus.CREATED)
    public List<Assessment> createAssessments(Authentication auth, @Valid @RequestBody BulkAssessments input) { return service.createAssessments(UUID.fromString(auth.getName()), input); }
    @PatchMapping("/assessments/{id}")
    public Assessment updateAssessment(Authentication auth, @PathVariable UUID id, @RequestBody AssessmentPatch input) { return service.updateAssessment(UUID.fromString(auth.getName()), id, input); }
    @DeleteMapping("/assessments/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAssessment(Authentication auth, @PathVariable UUID id) { service.deleteAssessment(UUID.fromString(auth.getName()), id); }

    @PostMapping("/events") @ResponseStatus(HttpStatus.CREATED)
    public CalendarEvent createEvent(Authentication auth, @Valid @RequestBody EventInput input) { return service.createEvent(UUID.fromString(auth.getName()), input); }
    @PatchMapping("/events/{id}")
    public CalendarEvent updateEvent(Authentication auth, @PathVariable UUID id, @RequestBody EventPatch input) { return service.updateEvent(UUID.fromString(auth.getName()), id, input); }
    @DeleteMapping("/events/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteEvent(Authentication auth, @PathVariable UUID id) { service.deleteEvent(UUID.fromString(auth.getName()), id); }

    @PostMapping("/sessions") @ResponseStatus(HttpStatus.CREATED)
    public StudySession createSession(Authentication auth, @Valid @RequestBody SessionInput input) { return service.createSession(UUID.fromString(auth.getName()), input); }
    @DeleteMapping("/sessions/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSession(Authentication auth, @PathVariable UUID id) { service.deleteSession(UUID.fromString(auth.getName()), id); }
}
