package com.lockin.backend.service;

import com.lockin.backend.dto.AuthResponse;
import com.lockin.backend.dto.UserResponse;
import com.lockin.backend.entity.UserAccount;
import java.time.Duration;
import java.time.Instant;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private final JwtEncoder jwtEncoder;
    private final Duration expiration;
    private final String issuer;

    public JwtService(
            JwtEncoder jwtEncoder,
            @Value("${app.security.jwt.expiration}") Duration expiration,
            @Value("${app.security.jwt.issuer}") String issuer) {
        this.jwtEncoder = jwtEncoder;
        this.expiration = expiration;
        this.issuer = issuer;
    }

    public AuthResponse createSession(UserAccount user) {
        Instant issuedAt = Instant.now();
        Instant expiresAt = issuedAt.plus(expiration);

        JwtClaimsSet.Builder claimsBuilder = JwtClaimsSet.builder()
                .issuer(issuer)
                .issuedAt(issuedAt)
                .expiresAt(expiresAt)
                .subject(user.getUsername());

        if (user.getId() != null) {
            claimsBuilder.claim("uid", user.getId().toString());
        }

        JwtClaimsSet claims = claimsBuilder.build();

        String accessToken = jwtEncoder.encode(
                JwtEncoderParameters.from(
                        JwsHeader.with(MacAlgorithm.HS256).build(),
                        claims))
                .getTokenValue();

        return new AuthResponse(accessToken, "Bearer", expiresAt, toUserResponse(user));
    }

    public UserResponse toUserResponse(UserAccount user) {
        return new UserResponse(user.getId(), user.getUsername(), user.getCreatedAt());
    }
}
