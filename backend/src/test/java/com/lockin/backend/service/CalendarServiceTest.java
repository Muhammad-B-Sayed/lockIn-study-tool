package com.lockin.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lockin.backend.entity.CalendarEvent;
import com.lockin.backend.entity.TaskItem;
import com.lockin.backend.repository.CalendarEventRepository;
import com.lockin.backend.repository.TaskItemRepository;
import com.lockin.backend.dto.CreateCalendarEventRequest;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class CalendarServiceTest {

    @Mock
    private CalendarEventRepository calendarEventRepository;

    @Mock
    private TaskItemRepository taskItemRepository;

    @Mock
    private UserService userService;

    @InjectMocks
    private CalendarService calendarService;

    @Test
    void getMonthMergesTasksAndEventsInDateOrder() {
        TaskItem task = new TaskItem();
        task.setTitle("CSC207 Assignment");
        task.setDueDate(LocalDate.of(2026, 6, 10));
        task.setCourse("CSC207");
        task.setType("Assignment");

        CalendarEvent event = new CalendarEvent();
        event.setName("Exam Review");
        event.setEventDate(LocalDate.of(2026, 6, 12));
        event.setColorHex("#ef4444");

        when(taskItemRepository.findAllByOwnerUsernameAndDueDateBetweenOrderByDueDateAsc(
                "muhammad", LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30)))
                .thenReturn(List.of(task));
        when(calendarEventRepository.findAllByOwnerUsernameAndEventDateBetweenOrderByEventDateAsc(
                "muhammad", LocalDate.of(2026, 6, 1), LocalDate.of(2026, 6, 30)))
                .thenReturn(List.of(event));

        var items = calendarService.getMonth("muhammad", YearMonth.of(2026, 6));

        assertEquals(2, items.size());
        assertEquals("TASK", items.get(0).kind());
        assertEquals("CSC207 Assignment", items.get(0).name());
        assertEquals("#d97706", items.get(0).colorHex());
        assertEquals("EVENT", items.get(1).kind());
        assertEquals("Exam Review", items.get(1).name());
    }

    @Test
    void updateEventRewritesEditableFields() {
        UUID eventId = UUID.fromString("44444444-4444-4444-4444-444444444444");
        CalendarEvent event = new CalendarEvent();
        event.setName("Old review block");
        event.setEventDate(LocalDate.of(2026, 6, 14));
        event.setColorHex("#ef4444");

        when(calendarEventRepository.findByIdAndOwnerUsername(eventId, "muhammad"))
                .thenReturn(java.util.Optional.of(event));

        var updated = calendarService.updateEvent(
                "muhammad",
                eventId,
                new CreateCalendarEventRequest("Updated review block", LocalDate.of(2026, 6, 18), "#0f766e"));

        assertEquals("Updated review block", updated.name());
        assertEquals(LocalDate.of(2026, 6, 18), updated.date());
        assertEquals("#0f766e", updated.colorHex());
    }

    @Test
    void deleteEventRemovesOwnedCalendarEvent() {
        UUID eventId = UUID.fromString("33333333-3333-3333-3333-333333333333");
        CalendarEvent event = new CalendarEvent();

        when(calendarEventRepository.findByIdAndOwnerUsername(eventId, "muhammad")).thenReturn(java.util.Optional.of(event));

        calendarService.deleteEvent("muhammad", eventId);

        verify(calendarEventRepository).delete(event);
    }
}
