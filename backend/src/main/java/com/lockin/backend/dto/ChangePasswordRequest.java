package com.lockin.backend.dto;

import com.lockin.backend.validation.PasswordBytes;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        @NotBlank(message = "Please enter your current password.") @PasswordBytes String currentPassword,
        @NotBlank(message = "Please enter a new password.")
        @Size(min = 8, message = "Password must be at least 8 characters.") @PasswordBytes String password
) {
}
