package com.lockin.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

import com.lockin.backend.entity.CalendarEvent;
import com.lockin.backend.entity.TaskItem;
import com.lockin.backend.repository.CalendarEventRepository;
import com.lockin.backend.repository.TaskItemRepository;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
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
        task.setType("Task");

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
        assertEquals("EVENT", items.get(1).kind());
        assertEquals("Exam Review", items.get(1).name());
    }
}
