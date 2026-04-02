package com.tour.auth.controller;

import com.tour.auth.dto.AuthDtos;
import com.tour.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/users")
@RequiredArgsConstructor
public class UserController {
    private final AuthService authService;

    @GetMapping("/me")
    public AuthDtos.UserResponse myProfile(@RequestHeader("X-User-Email") String email) {
        return authService.getUserByEmail(email);
    }

    @PutMapping("/me")
    public AuthDtos.UserResponse updateMyProfile(
            @RequestHeader("X-User-Email") String email,
            @RequestBody @Valid AuthDtos.UpdateProfileRequest request
    ) {
        return authService.updateMyProfile(email, request);
    }

    @PutMapping("/me/password")
    public AuthDtos.MessageResponse changePassword(
            @RequestHeader("X-User-Email") String email,
            @RequestBody @Valid AuthDtos.ChangePasswordRequest request
    ) {
        return authService.changeMyPassword(email, request);
    }

    @GetMapping
    public List<AuthDtos.UserResponse> allUsers() {
        return authService.getAllUsers();
    }

    @GetMapping("/{id}")
    public AuthDtos.UserResponse getById(@PathVariable Long id) {
        return authService.getUser(id);
    }

    @PutMapping("/{id}/roles")
    public AuthDtos.UserResponse updateRoles(@PathVariable Long id, @RequestBody AuthDtos.UpdateRolesRequest request) {
        return authService.updateRoles(id, request);
    }

    @PostMapping
    public AuthDtos.UserResponse createUser(@RequestBody @Valid AuthDtos.CreateUserRequest request) {
        return authService.createUser(request);
    }

    @PutMapping("/{id}")
    public AuthDtos.UserResponse updateUser(@PathVariable Long id, @RequestBody @Valid AuthDtos.UpdateUserRequest request) {
        return authService.updateUser(id, request);
    }

    @DeleteMapping("/{id}")
    public AuthDtos.MessageResponse deleteUser(@PathVariable Long id) {
        return authService.deleteUser(id);
    }
}
