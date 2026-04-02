package com.tour.auth.dto;

import com.tour.auth.entity.RoleName;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Set;

public class AuthDtos {
    public record RegisterRequest(
            @NotBlank String fullName,
            @Email @NotBlank String email,
            String phone,
            @NotBlank @Size(min = 6) String password
    ) {}

    public record LoginRequest(
            @Email @NotBlank String email,
            @NotBlank String password
    ) {}

    public record ForgotPasswordCodeRequest(
            @Email @NotBlank String email
    ) {}

    public record VerifyResetCodeRequest(
            @Email @NotBlank String email,
            @NotBlank String code
    ) {}

    public record ResetPasswordWithCodeRequest(
            @Email @NotBlank String email,
            @NotBlank String code,
            @NotBlank @Size(min = 6) String newPassword
    ) {}

    public record AuthResponse(
            String token,
            Long userId,
            String fullName,
            String email,
            Set<String> roles
    ) {}

    public record MessageResponse(String message) {}

    public record UserResponse(
            Long id,
            String fullName,
            String email,
            String phone,
            boolean enabled,
            Set<String> roles
    ) {}

    public record UpdateProfileRequest(
            @NotBlank String fullName,
            String phone
    ) {}

    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank @Size(min = 6) String newPassword
    ) {}

    public record CreateUserRequest(
            @NotBlank String fullName,
            @Email @NotBlank String email,
            String phone,
            @NotBlank @Size(min = 6) String password,
            Boolean enabled,
            Set<RoleName> roles
    ) {}

    public record UpdateUserRequest(
            @NotBlank String fullName,
            String phone,
            Boolean enabled,
            Set<RoleName> roles,
            @Size(min = 6) String password
    ) {}

    public record UpdateRolesRequest(Set<RoleName> roles) {}
}
