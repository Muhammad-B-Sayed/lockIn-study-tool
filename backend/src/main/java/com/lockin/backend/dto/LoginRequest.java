package com.lockin.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank(message = "Please enter your username.") String username,
        @NotBlank(message = "Please enter your password.") String password
) {
}
