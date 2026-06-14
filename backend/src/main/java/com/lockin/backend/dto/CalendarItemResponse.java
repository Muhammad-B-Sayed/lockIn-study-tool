package com.lockin.backend.dto;

import java.time.LocalDate;
import java.util.UUID;

public record CalendarItemResponse(
        UUID id,
        String kind,
        String name,
        LocalDate date,
        String colorHex,
        boolean completed,
        UUID taskId,
        String course
) {
}
