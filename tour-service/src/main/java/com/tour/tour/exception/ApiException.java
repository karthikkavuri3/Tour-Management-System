package com.tour.tour.exception;

public class ApiException extends RuntimeException {
    public ApiException(String message) {
        super(message);
    }
}
