package com.lockin.backend.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDate;

public record TaskRequest(
        @NotBlank(message = "Please enter a task title.") String title,
        String description,
        LocalDate dueDate,
        String course,
        Boolean completed,
        String type
) {
}
