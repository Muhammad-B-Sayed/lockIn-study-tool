package com.lockin.backend.dto;

import java.time.Instant;
import java.util.UUID;

public record UserResponse(
        UUID id,
        String username,
        Instant createdAt
) {
}
