package com.lockin.backend.service;

import com.lockin.backend.dto.AuthResponse;
import com.lockin.backend.dto.ChangePasswordRequest;
import com.lockin.backend.dto.LoginRequest;
import com.lockin.backend.dto.SignupRequest;
import com.lockin.backend.dto.UserResponse;
import com.lockin.backend.entity.UserAccount;
import com.lockin.backend.exception.ConflictException;
import com.lockin.backend.exception.BadRequestException;
import com.lockin.backend.exception.NotFoundException;
import com.lockin.backend.exception.UnauthorizedException;
import com.lockin.backend.repository.UserAccountRepository;
import jakarta.transaction.Transactional;
import java.util.UUID;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserAccountRepository userAccountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public UserService(
            UserAccountRepository userAccountRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService) {
        this.userAccountRepository = userAccountRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    @Transactional
    public AuthResponse signup(SignupRequest request) {
        if (userAccountRepository.existsByUsername(request.username())) {
            throw new ConflictException("User already exists.");
        }
        if (!request.password().equals(request.repeatPassword())) {
            throw new ConflictException("Passwords don't match.");
        }

        UserAccount user = new UserAccount();
        user.setUsername(request.username().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));

        return jwtService.createSession(userAccountRepository.save(user));
    }

    public AuthResponse login(LoginRequest request) {
        UserAccount user = requireUser(request.username());
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new UnauthorizedException("Incorrect password.");
        }
        return jwtService.createSession(user);
    }

    public UserResponse getProfile(UUID accountId) {
        return jwtService.toUserResponse(requireUser(accountId));
    }

    @Transactional
    public UserResponse changePassword(UUID accountId, ChangePasswordRequest request) {
        UserAccount user = requireUser(accountId);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BadRequestException("Your current password is wrong.");
        }
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        return jwtService.toUserResponse(user);
    }

    @Transactional
    public void deleteAccount(UUID accountId) {
        userAccountRepository.delete(requireUser(accountId));
    }

    public UserAccount requireUser(UUID accountId) {
        return userAccountRepository.findById(accountId)
                .orElseThrow(() -> new UnauthorizedException("Your account no longer exists."));
    }

    private UserAccount requireUser(String username) {
        return userAccountRepository.findByUsername(username)
                .orElseThrow(() -> new NotFoundException("User not found: " + username));
    }
}
