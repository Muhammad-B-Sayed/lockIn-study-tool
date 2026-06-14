package com.lockin.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record ChangePasswordRequest(
        @NotBlank(message = "Please enter a new password.") String password
) {
}
