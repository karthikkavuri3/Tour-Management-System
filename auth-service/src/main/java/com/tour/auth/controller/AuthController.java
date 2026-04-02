package com.tour.auth.controller;

import com.tour.auth.dto.AuthDtos;
import com.tour.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthDtos.UserResponse register(@RequestBody @Valid AuthDtos.RegisterRequest request) {
        return authService.register(request);
    }

    @PostMapping("/login")
    public AuthDtos.AuthResponse login(@RequestBody @Valid AuthDtos.LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/logout")
    public AuthDtos.MessageResponse logout() {
        return authService.logout();
    }

    @PostMapping("/forgot-password/send-code")
    public AuthDtos.MessageResponse sendForgotPasswordCode(
            @RequestBody @Valid AuthDtos.ForgotPasswordCodeRequest request
    ) {
        return authService.sendForgotPasswordCode(request);
    }

    @PostMapping("/forgot-password/verify-code")
    public AuthDtos.MessageResponse verifyForgotPasswordCode(
            @RequestBody @Valid AuthDtos.VerifyResetCodeRequest request
    ) {
        return authService.verifyForgotPasswordCode(request);
    }

    @PostMapping("/forgot-password/reset")
    public AuthDtos.MessageResponse resetPasswordWithCode(
            @RequestBody @Valid AuthDtos.ResetPasswordWithCodeRequest request
    ) {
        return authService.resetPasswordWithCode(request);
    }
}
