package com.lockin.backend.controller;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.lockin.backend.config.SecurityConfig;
import com.lockin.backend.config.WebConfig;
import com.lockin.backend.dto.AuthResponse;
import com.lockin.backend.dto.LoginRequest;
import com.lockin.backend.dto.TaskResponse;
import com.lockin.backend.dto.UserResponse;
import com.lockin.backend.exception.ApiExceptionHandler;
import com.lockin.backend.service.TaskService;
import com.lockin.backend.service.UserService;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@WebMvcTest(controllers = {AuthController.class, TaskController.class})
@Import({SecurityConfig.class, WebConfig.class, ApiExceptionHandler.class, ApiSecurityTest.TestSecurityConfig.class})
class ApiSecurityTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private UserService userService;

    @MockitoBean
    private TaskService taskService;

    @Test
    void loginReturnsSessionTokenPayload() throws Exception {
        UserResponse user = new UserResponse(
                UUID.fromString("11111111-1111-1111-1111-111111111111"),
                "muhammad",
                Instant.parse("2026-06-14T05:00:00Z"));
        AuthResponse authResponse = new AuthResponse(
                "token-123",
                "Bearer",
                Instant.parse("2026-06-14T13:00:00Z"),
                user);

        when(userService.login(new LoginRequest("muhammad", "secret123"))).thenReturn(authResponse);

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new LoginRequest("muhammad", "secret123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").value("token-123"))
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.user.username").value("muhammad"));
    }

    @Test
    void protectedTasksEndpointRejectsAnonymousRequests() throws Exception {
        mockMvc.perform(get("/api/me/tasks"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Authentication required."));
    }

    @Test
    void protectedTasksEndpointUsesJwtSubjectForCurrentUser() throws Exception {
        TaskResponse task = new TaskResponse(
                UUID.fromString("22222222-2222-2222-2222-222222222222"),
                "Finish sprint notes",
                "Wrap up the planning summary",
                LocalDate.parse("2026-06-20"),
                "Ops",
                false,
                "Task");

        when(taskService.getTasks("muhammad")).thenReturn(List.of(task));

        mockMvc.perform(get("/api/me/tasks")
                        .with(jwt().jwt(jwt -> jwt.subject("muhammad"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Finish sprint notes"))
                .andExpect(jsonPath("$[0].course").value("Ops"));

        verify(taskService).getTasks("muhammad");
    }

    @Test
    void preflightAllowsInAppBrowserOrigin() throws Exception {
        mockMvc.perform(options("/api/auth/signup")
                        .header("Origin", "http://127.0.0.1:5173")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://127.0.0.1:5173"));
    }

    @Test
    void preflightAllowsLocalPreviewOrigin() throws Exception {
        mockMvc.perform(options("/api/auth/signup")
                        .header("Origin", "http://localhost:4173")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:4173"));
    }

    @Test
    void preflightAllowsAlternateLocalDevPort() throws Exception {
        mockMvc.perform(options("/api/auth/signup")
                        .header("Origin", "http://127.0.0.1:5174")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://127.0.0.1:5174"));
    }

    @TestConfiguration
    static class TestSecurityConfig {

        @Bean
        SecretKey jwtSecretKey() {
            return new SecretKeySpec(
                    "lockin-dev-secret-key-lockin-dev-secret-key".getBytes(StandardCharsets.UTF_8),
                    "HmacSHA256");
        }
    }
}
