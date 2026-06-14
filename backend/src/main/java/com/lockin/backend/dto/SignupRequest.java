package com.lockin.backend.dto;

import jakarta.validation.constraints.NotBlank;

public record SignupRequest(
        @NotBlank(message = "Please choose a username.") String username,
        @NotBlank(message = "Please enter a password.") String password,
        @NotBlank(message = "Please repeat your password.") String repeatPassword
) {
}
