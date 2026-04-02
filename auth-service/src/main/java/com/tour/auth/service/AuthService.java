package com.tour.auth.service;

import com.tour.auth.dto.AuthDtos;
import com.tour.auth.entity.Role;
import com.tour.auth.entity.RoleName;
import com.tour.auth.entity.User;
import com.tour.auth.exception.ApiException;
import com.tour.auth.repository.RoleRepository;
import com.tour.auth.repository.UserRepository;
import com.tour.auth.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RestTemplate restTemplate;

    @Value("${app.notification.base-url:http://localhost:8084}")
    private String notificationBaseUrl;

    @Value("${app.password-reset.code-expiry-minutes:10}")
    private int resetCodeExpiryMinutes;

    @Transactional
    public AuthDtos.UserResponse register(AuthDtos.RegisterRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new ApiException("Email already exists");
        }
        User user = new User();
        user.setFullName(request.fullName());
        user.setEmail(request.email());
        user.setPhone(request.phone());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.getRoles().add(requireRole(RoleName.CUSTOMER));
        return toResponse(userRepository.save(user));
    }

    public AuthDtos.AuthResponse login(AuthDtos.LoginRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new ApiException("Invalid credentials"));
        if (!passwordEncoder.matches(request.password(), user.getPassword())) {
            throw new ApiException("Invalid credentials");
        }
        String token = jwtService.generateToken(user);
        return new AuthDtos.AuthResponse(
                token,
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getRoles().stream().map(r -> r.getName().name()).collect(Collectors.toSet())
        );
    }

    public AuthDtos.MessageResponse logout() {
        return new AuthDtos.MessageResponse("Logged out successfully");
    }

    @Transactional
    public AuthDtos.MessageResponse sendForgotPasswordCode(AuthDtos.ForgotPasswordCodeRequest request) {
        User user = userRepository.findByEmail(request.email()).orElse(null);
        // Avoid email-enumeration attacks: always return success message.
        if (user == null) {
            return new AuthDtos.MessageResponse("A verification code has been sent to your email.");
        }

        String code = String.format("%06d", new Random().nextInt(1_000_000));
        user.setPasswordResetCodeHash(passwordEncoder.encode(code));
        user.setPasswordResetCodeExpiresAt(LocalDateTime.now().plusMinutes(Math.max(1, resetCodeExpiryMinutes)));
        user.setPasswordResetVerified(false);
        userRepository.save(user);

        sendResetCodeEmail(user, code);
        return new AuthDtos.MessageResponse("A verification code has been sent to your email.");
    }

    @Transactional
    public AuthDtos.MessageResponse verifyForgotPasswordCode(AuthDtos.VerifyResetCodeRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new ApiException("Invalid or expired verification code"));

        validateResetCode(user, request.code());
        user.setPasswordResetVerified(true);
        userRepository.save(user);
        return new AuthDtos.MessageResponse("Passcode verified successfully");
    }

    @Transactional
    public AuthDtos.MessageResponse resetPasswordWithCode(AuthDtos.ResetPasswordWithCodeRequest request) {
        User user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> new ApiException("Invalid reset request"));
        validateResetCode(user, request.code());
        if (!user.isPasswordResetVerified()) {
            throw new ApiException("Please verify the passcode before resetting password");
        }

        user.setPassword(passwordEncoder.encode(request.newPassword()));
        user.setPasswordResetCodeHash(null);
        user.setPasswordResetCodeExpiresAt(null);
        user.setPasswordResetVerified(false);
        userRepository.save(user);
        return new AuthDtos.MessageResponse("Password reset successful");
    }

    public List<AuthDtos.UserResponse> getAllUsers() {
        return userRepository.findAll().stream().map(this::toResponse).toList();
    }

    public AuthDtos.UserResponse getUser(Long id) {
        return toResponse(userRepository.findById(id).orElseThrow(() -> new ApiException("User not found")));
    }

    public AuthDtos.UserResponse getUserByEmail(String email) {
        return toResponse(userRepository.findByEmail(email).orElseThrow(() -> new ApiException("User not found")));
    }

    @Transactional
    public AuthDtos.UserResponse updateMyProfile(String email, AuthDtos.UpdateProfileRequest request) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> new ApiException("User not found"));
        user.setFullName(request.fullName());
        user.setPhone(request.phone());
        return toResponse(userRepository.save(user));
    }

    @Transactional
    public AuthDtos.MessageResponse changeMyPassword(String email, AuthDtos.ChangePasswordRequest request) {
        User user = userRepository.findByEmail(email).orElseThrow(() -> new ApiException("User not found"));
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            throw new ApiException("Current password is incorrect");
        }
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
        return new AuthDtos.MessageResponse("Password updated successfully");
    }

    @Transactional
    public AuthDtos.UserResponse createUser(AuthDtos.CreateUserRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new ApiException("Email already exists");
        }
        User user = new User();
        user.setFullName(request.fullName());
        user.setEmail(request.email());
        user.setPhone(request.phone());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setEnabled(request.enabled() == null || request.enabled());

        Set<RoleName> requestedRoles = request.roles() == null || request.roles().isEmpty()
                ? Set.of(RoleName.CUSTOMER)
                : request.roles();
        user.setRoles(requestedRoles.stream().map(this::requireRole).collect(Collectors.toSet()));
        return toResponse(userRepository.save(user));
    }

    @Transactional
    public AuthDtos.UserResponse updateUser(Long id, AuthDtos.UpdateUserRequest request) {
        User user = userRepository.findById(id).orElseThrow(() -> new ApiException("User not found"));
        user.setFullName(request.fullName());
        user.setPhone(request.phone());
        if (request.enabled() != null) {
            user.setEnabled(request.enabled());
        }
        if (request.roles() != null && !request.roles().isEmpty()) {
            user.setRoles(request.roles().stream().map(this::requireRole).collect(Collectors.toSet()));
        }
        if (request.password() != null && !request.password().isBlank()) {
            user.setPassword(passwordEncoder.encode(request.password()));
        }
        return toResponse(userRepository.save(user));
    }

    @Transactional
    public AuthDtos.MessageResponse deleteUser(Long id) {
        User user = userRepository.findById(id).orElseThrow(() -> new ApiException("User not found"));
        userRepository.delete(user);
        return new AuthDtos.MessageResponse("User deleted successfully");
    }

    @Transactional
    public AuthDtos.UserResponse updateRoles(Long id, AuthDtos.UpdateRolesRequest request) {
        User user = userRepository.findById(id).orElseThrow(() -> new ApiException("User not found"));
        Set<Role> roles = request.roles().stream().map(this::requireRole).collect(Collectors.toSet());
        user.setRoles(roles);
        return toResponse(userRepository.save(user));
    }

    private Role requireRole(RoleName roleName) {
        return roleRepository.findByName(roleName).orElseThrow(() -> new ApiException("Role missing: " + roleName));
    }

    private AuthDtos.UserResponse toResponse(User user) {
        return new AuthDtos.UserResponse(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.isEnabled(),
                user.getRoles().stream().map(r -> r.getName().name()).collect(Collectors.toSet())
        );
    }

    private void validateResetCode(User user, String code) {
        if (user.getPasswordResetCodeHash() == null || user.getPasswordResetCodeExpiresAt() == null) {
            throw new ApiException("Invalid or expired verification code");
        }
        if (LocalDateTime.now().isAfter(user.getPasswordResetCodeExpiresAt())) {
            throw new ApiException("Verification code expired. Please request a new one.");
        }
        if (!passwordEncoder.matches(code, user.getPasswordResetCodeHash())) {
            throw new ApiException("Invalid verification code");
        }
    }

    private void sendResetCodeEmail(User user, String code) {
        try {
            restTemplate.postForEntity(
                    notificationBaseUrl + "/notifications/password-reset-code",
                    new PasswordResetCodeEmailRequest(
                            user.getEmail(),
                            user.getFullName(),
                            code,
                            Math.max(1, resetCodeExpiryMinutes)
                    ),
                    Object.class
            );
        } catch (Exception ignored) {
            // Do not fail password-reset flow if email provider is temporarily unavailable.
        }
    }

    private record PasswordResetCodeEmailRequest(
            String recipientEmail,
            String customerName,
            String resetCode,
            Integer expiresInMinutes
    ) {}
}
