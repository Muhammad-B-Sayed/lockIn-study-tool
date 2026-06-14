package com.lockin.backend.controller;

import com.lockin.backend.dto.CalendarItemResponse;
import com.lockin.backend.dto.CreateCalendarEventRequest;
import com.lockin.backend.service.CalendarService;
import jakarta.validation.Valid;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me/calendar")
public class CalendarController {

    private final CalendarService calendarService;

    public CalendarController(CalendarService calendarService) {
        this.calendarService = calendarService;
    }

    @GetMapping
    public List<CalendarItemResponse> getMonth(
            Authentication authentication,
            @RequestParam @DateTimeFormat(pattern = "yyyy-MM") YearMonth month) {
        return calendarService.getMonth(authentication.getName(), month);
    }

    @PostMapping("/events")
    @ResponseStatus(HttpStatus.CREATED)
    public CalendarItemResponse createEvent(
            Authentication authentication,
            @Valid @RequestBody CreateCalendarEventRequest request) {
        return calendarService.createEvent(authentication.getName(), request);
    }

    @PatchMapping("/events/{eventId}/complete")
    public CalendarItemResponse markComplete(Authentication authentication, @PathVariable UUID eventId) {
        return calendarService.markEventCompleted(authentication.getName(), eventId);
    }
}
