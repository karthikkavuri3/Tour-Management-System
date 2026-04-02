package com.tour.notification.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;

public class NotificationDtos {

    public record EmailRequest(
            @Email @NotBlank String recipientEmail,
            String subject,
            @NotBlank String messageBody
    ) {}

    public record EmailResponse(String status, String message) {}

    public record PasswordResetCodeRequest(
            @Email @NotBlank String recipientEmail,
            String customerName,
            @NotBlank String resetCode,
            Integer expiresInMinutes
    ) {}

    /** Booking cancellation — generates HTML cancellation email + refund PDF invoice. */
    public record BookingCancellationRequest(
            @Email @NotBlank String recipientEmail,
            String customerName,
            @NotBlank String bookingReference,
            String invoiceNumber,
            String tourTitle,
            String destinationName,
            String travelStartDate,
            String travelEndDate,
            Integer durationDays,
            Integer numberOfTravelers,
            BigDecimal totalAmount,
            String cancellationDate
    ) {}

    /** Booking updated — rich HTML update email. */
    public record BookingUpdatedRequest(
            @Email @NotBlank String recipientEmail,
            String customerName,
            @NotBlank String bookingReference,
            String tourTitle,
            String destinationName,
            String travelStartDate,
            String travelEndDate,
            Integer durationDays,
            Integer numberOfTravelers,
            BigDecimal totalAmount,
            String updatedAt
    ) {}

    /** Rich booking confirmation — used to generate HTML email + PDF invoice attachment. */
    public record BookingConfirmationRequest(
            @Email @NotBlank String recipientEmail,
            String customerName,
            @NotBlank String bookingReference,
            String invoiceNumber,
            String tourTitle,
            String destinationName,
            String travelStartDate,      // "YYYY-MM-DD"
            String travelEndDate,        // "YYYY-MM-DD"
            Integer durationDays,
            Integer numberOfTravelers,
            BigDecimal pricePerPerson,
            BigDecimal totalAmount,      // subtotal (price × travelers)
            BigDecimal processingFee,    // 1 % of totalAmount
            BigDecimal grandTotal,       // totalAmount + processingFee
            String paymentMethod,
            String bookingDate           // display string
    ) {}
}
