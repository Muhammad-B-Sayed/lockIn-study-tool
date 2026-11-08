package com.lockin.backend.dto;

import com.lockin.backend.validation.PasswordBytes;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank(message = "Please choose a username.") String username,
        @NotBlank(message = "Please enter a password.")
        @Size(min = 8, message = "Password must be at least 8 characters.") @PasswordBytes String password,
        @NotBlank(message = "Please repeat your password.") @PasswordBytes String repeatPassword
) {
}
