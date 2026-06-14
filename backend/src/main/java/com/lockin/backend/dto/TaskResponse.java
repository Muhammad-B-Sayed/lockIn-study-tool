package com.lockin.backend.dto;

import java.time.LocalDate;
import java.util.UUID;

public record TaskResponse(
        UUID id,
        String title,
        String description,
        LocalDate dueDate,
        String course,
        boolean completed,
        String type
) {
}
