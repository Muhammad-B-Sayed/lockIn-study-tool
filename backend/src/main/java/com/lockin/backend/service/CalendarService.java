package com.lockin.backend.service;

import com.lockin.backend.dto.CalendarItemResponse;
import com.lockin.backend.dto.CreateCalendarEventRequest;
import com.lockin.backend.entity.CalendarEvent;
import com.lockin.backend.entity.TaskItem;
import com.lockin.backend.repository.CalendarEventRepository;
import com.lockin.backend.repository.TaskItemRepository;
import jakarta.transaction.Transactional;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class CalendarService {

    private final CalendarEventRepository calendarEventRepository;
    private final TaskItemRepository taskItemRepository;
    private final UserService userService;

    public CalendarService(
            CalendarEventRepository calendarEventRepository,
            TaskItemRepository taskItemRepository,
            UserService userService) {
        this.calendarEventRepository = calendarEventRepository;
        this.taskItemRepository = taskItemRepository;
        this.userService = userService;
    }

    public List<CalendarItemResponse> getMonth(String username, YearMonth month) {
        userService.requireUser(username);

        List<CalendarItemResponse> items = new ArrayList<>();
        var start = month.atDay(1);
        var end = month.atEndOfMonth();

        taskItemRepository.findAllByOwnerUsernameAndDueDateBetweenOrderByDueDateAsc(username, start, end)
                .stream()
                .map(this::toTaskCalendarItem)
                .forEach(items::add);

        calendarEventRepository.findAllByOwnerUsernameAndEventDateBetweenOrderByEventDateAsc(username, start, end)
                .stream()
                .map(this::toEventCalendarItem)
                .forEach(items::add);

        items.sort(Comparator.comparing(CalendarItemResponse::date).thenComparing(CalendarItemResponse::name));
        return items;
    }

    @Transactional
    public CalendarItemResponse createEvent(String username, CreateCalendarEventRequest request) {
        CalendarEvent event = new CalendarEvent();
        event.setOwner(userService.requireUser(username));
        event.setName(request.name().trim());
        event.setEventDate(request.date());
        event.setColorHex(normalizeColor(request.colorHex()));
        event.setCompleted(false);

        return toEventCalendarItem(calendarEventRepository.save(event));
    }

    @Transactional
    public CalendarItemResponse updateEvent(String username, UUID eventId, CreateCalendarEventRequest request) {
        CalendarEvent event = calendarEventRepository.findByIdAndOwnerUsername(eventId, username)
                .orElseThrow(() -> new com.lockin.backend.exception.NotFoundException("Calendar event not found."));
        event.setName(request.name().trim());
        event.setEventDate(request.date());
        event.setColorHex(normalizeColor(request.colorHex()));
        return toEventCalendarItem(event);
    }

    @Transactional
    public CalendarItemResponse markEventCompleted(String username, UUID eventId) {
        CalendarEvent event = calendarEventRepository.findByIdAndOwnerUsername(eventId, username)
                .orElseThrow(() -> new com.lockin.backend.exception.NotFoundException("Calendar event not found."));
        event.setCompleted(true);
        return toEventCalendarItem(event);
    }

    @Transactional
    public void deleteEvent(String username, UUID eventId) {
        CalendarEvent event = calendarEventRepository.findByIdAndOwnerUsername(eventId, username)
                .orElseThrow(() -> new com.lockin.backend.exception.NotFoundException("Calendar event not found."));
        calendarEventRepository.delete(event);
    }

    private CalendarItemResponse toTaskCalendarItem(TaskItem task) {
        return new CalendarItemResponse(
                task.getId(),
                "TASK",
                task.getTitle(),
                task.getDueDate(),
                taskColor(task.getType()),
                task.isCompleted(),
                task.getId(),
                task.getCourse());
    }

    private CalendarItemResponse toEventCalendarItem(CalendarEvent event) {
        return new CalendarItemResponse(
                event.getId(),
                "EVENT",
                event.getName(),
                event.getEventDate(),
                event.getColorHex(),
                event.isCompleted(),
                null,
                null);
    }

    private String taskColor(String taskType) {
        if (taskType == null) {
            return "#2563eb";
        }

        return switch (taskType.trim().toLowerCase()) {
            case "assignment" -> "#d97706";
            case "exam" -> "#dc2626";
            case "project" -> "#0f766e";
            default -> "#2563eb";
        };
    }

    private String normalizeColor(String colorHex) {
        return colorHex == null || colorHex.isBlank() ? "#2563eb" : colorHex.trim();
    }
}
