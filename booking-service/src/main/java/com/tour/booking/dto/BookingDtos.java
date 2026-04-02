package com.tour.booking.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public class BookingDtos {
    public record TravelerRequest(
            @NotBlank String firstName,
            String lastName,
            @NotNull @Min(0) Integer age
    ) {}

    public record CreateBookingRequest(
            @NotNull Long userId,
            @NotNull Long tourPackageId,
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate,
            @NotNull BigDecimal totalAmount,
            String paymentMethod,
            Boolean mockPaymentSuccess,
            String customerEmail,
            @NotNull List<TravelerRequest> travelers,
            // Optional enrichment fields — used only for rich email notifications
            String customerName,
            String tourTitle,
            String destinationName,
            Integer durationDays,
            BigDecimal pricePerPerson
    ) {}

    public record UpdateBookingRequest(
            @NotNull Long scheduleId,
            @NotNull BigDecimal totalAmount,
            String customerEmail,
            @NotNull List<TravelerRequest> travelers,
            // Optional: if provided, a new schedule is created with these dates
            LocalDate newStartDate,
            LocalDate newEndDate
    ) {}

    public record CancelBookingRequest(
            String customerEmail,
            // Enrichment for rich cancellation email + refund PDF
            String customerName,
            String tourTitle,
            String destinationName,
            String travelStartDate,
            String travelEndDate,
            Integer durationDays,
            Integer numberOfTravelers,
            BigDecimal pricePerPerson
    ) {}

    public record AdminCreateBookingRequest(
            @NotNull Long userId,
            @NotNull Long tourPackageId,
            @NotNull LocalDate startDate,
            @NotNull LocalDate endDate,
            @NotNull BigDecimal totalAmount,
            String paymentMethod,
            Boolean mockPaymentSuccess,
            String customerEmail,
            @NotNull List<TravelerRequest> travelers,
            String customerName,
            String tourTitle,
            String destinationName,
            Integer durationDays,
            BigDecimal pricePerPerson
    ) {}

    public record BookingFilterRequest(
            Long userId,
            Long tourPackageId,
            String bookingStatus,
            String paymentStatus,
            LocalDateTime bookedFrom,
            LocalDateTime bookedTo,
            BigDecimal minAmount,
            BigDecimal maxAmount
    ) {}

    public record BookingResponse(
            Long id, String bookingReference, Long userId, Long tourPackageId, Long scheduleId,
            Integer numberOfPeople, BigDecimal totalAmount, String bookingStatus, String paymentStatus, LocalDateTime bookingDate,
            List<TravelerResponse> travelers
    ) {}

    public record PaymentResponse(String paymentReference, BigDecimal amount, String paymentMethod, String paymentStatus, LocalDateTime paidAt) {}

    public record InvoiceResponse(String invoiceNumber, LocalDateTime invoiceDate, BigDecimal amount, String remarks, String invoiceType) {}
    public record AllInvoicesResponse(List<InvoiceResponse> invoices) {}

    public record TravelerResponse(String firstName, String lastName, Integer age) {}
}
