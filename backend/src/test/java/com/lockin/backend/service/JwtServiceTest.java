package com.lockin.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.lockin.backend.entity.UserAccount;
import java.time.Duration;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import com.nimbusds.jose.jwk.source.ImmutableSecret;

class JwtServiceTest {

    @Test
    void createSessionBuildsTokenWithUsernameSubject() {
        var secretKey = new SecretKeySpec(
                "lockin-dev-secret-key-lockin-dev-secret-key".getBytes(),
                "HmacSHA256");
        JwtEncoder encoder = new NimbusJwtEncoder(new ImmutableSecret<>(secretKey));
        JwtDecoder decoder = NimbusJwtDecoder.withSecretKey(secretKey).build();
        JwtService jwtService = new JwtService(encoder, Duration.ofHours(8), "lockin-backend");

        UserAccount user = new UserAccount();
        user.setUsername("muhammad");

        var session = jwtService.createSession(user);
        var decoded = decoder.decode(session.accessToken());

        assertEquals("muhammad", decoded.getSubject());
        assertEquals("Bearer", session.tokenType());
        assertNotNull(session.expiresAt());
    }
}
