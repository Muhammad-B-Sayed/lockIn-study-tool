package com.lockin.backend.dto;

import com.lockin.backend.validation.PasswordBytes;
import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank(message = "Please enter your username.") String username,
        @NotBlank(message = "Please enter your password.") @PasswordBytes String password
) {
}
