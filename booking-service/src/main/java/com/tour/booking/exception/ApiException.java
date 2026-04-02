package com.tour.booking.exception;

public class ApiException extends RuntimeException {
    public ApiException(String message) {
        super(message);
    }
}
