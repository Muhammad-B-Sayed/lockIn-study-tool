package com.lockin.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lockin.backend.dto.AuthResponse;
import com.lockin.backend.dto.LoginRequest;
import com.lockin.backend.dto.SignupRequest;
import com.lockin.backend.dto.UserResponse;
import com.lockin.backend.entity.UserAccount;
import com.lockin.backend.exception.ConflictException;
import com.lockin.backend.exception.UnauthorizedException;
import com.lockin.backend.repository.UserAccountRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserAccountRepository userAccountRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @InjectMocks
    private UserService userService;

    @Test
    void signupEncodesPasswordAndSavesUser() {
        SignupRequest request = new SignupRequest("muhammad", "secret123", "secret123");
        UserAccount saved = new UserAccount();
        saved.setUsername("muhammad");
        saved.setPasswordHash("encoded-secret");

        when(userAccountRepository.existsByUsername("muhammad")).thenReturn(false);
        when(passwordEncoder.encode("secret123")).thenReturn("encoded-secret");
        when(userAccountRepository.save(any(UserAccount.class))).thenReturn(saved);
        when(jwtService.createSession(saved)).thenReturn(new AuthResponse(
                "token-value",
                "Bearer",
                null,
                new UserResponse(null, "muhammad", null)));

        var response = userService.signup(request);

        assertEquals("muhammad", response.user().username());
        verify(passwordEncoder).encode("secret123");
        verify(userAccountRepository).save(any(UserAccount.class));
    }

    @Test
    void signupRejectsDuplicateUsername() {
        when(userAccountRepository.existsByUsername("muhammad")).thenReturn(true);

        assertThrows(ConflictException.class,
                () -> userService.signup(new SignupRequest("muhammad", "a", "a")));
    }

    @Test
    void loginRejectsWrongPassword() {
        UserAccount user = new UserAccount();
        user.setUsername("muhammad");
        user.setPasswordHash("encoded-secret");

        when(userAccountRepository.findByUsername("muhammad")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", "encoded-secret")).thenReturn(false);

        assertThrows(UnauthorizedException.class,
                () -> userService.login(new LoginRequest("muhammad", "wrong-password")));
    }

    @Test
    void loginReturnsJwtSessionOnSuccess() {
        UserAccount user = new UserAccount();
        user.setUsername("muhammad");
        user.setPasswordHash("encoded-secret");

        AuthResponse session = new AuthResponse("token-value", "Bearer", null,
                new UserResponse(null, "muhammad", null));

        when(userAccountRepository.findByUsername("muhammad")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("secret123", "encoded-secret")).thenReturn(true);
        when(jwtService.createSession(user)).thenReturn(session);

        var response = userService.login(new LoginRequest("muhammad", "secret123"));

        assertEquals("token-value", response.accessToken());
        assertEquals("muhammad", response.user().username());
    }
}
