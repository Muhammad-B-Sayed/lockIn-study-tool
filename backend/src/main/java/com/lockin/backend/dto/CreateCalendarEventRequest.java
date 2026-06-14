package com.lockin.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record CreateCalendarEventRequest(
        @NotBlank(message = "Please enter an event name.") String name,
        @NotNull(message = "Please choose a date.") LocalDate date,
        String colorHex
) {
}
