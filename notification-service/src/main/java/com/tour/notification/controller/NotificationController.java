package com.tour.notification.controller;

import com.tour.notification.dto.NotificationDtos;
import com.tour.notification.service.EmailService;
import com.tour.notification.service.InvoicePdfService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final EmailService emailService;
    private final InvoicePdfService invoicePdfService;

    /** General-purpose email (plain text / simple HTML). */
    @PostMapping("/email")
    @ResponseStatus(HttpStatus.CREATED)
    public NotificationDtos.EmailResponse sendEmail(
            @RequestBody @Valid NotificationDtos.EmailRequest request) {
        return emailService.sendEmail(request);
    }

    /** Rich booking confirmation: professional HTML email + PDF invoice attachment. */
    @PostMapping("/booking-confirmation")
    @ResponseStatus(HttpStatus.CREATED)
    public NotificationDtos.EmailResponse sendBookingConfirmation(
            @RequestBody @Valid NotificationDtos.BookingConfirmationRequest request) {
        return emailService.sendBookingConfirmation(request);
    }

    @PostMapping("/password-reset-code")
    @ResponseStatus(HttpStatus.CREATED)
    public NotificationDtos.EmailResponse sendPasswordResetCode(
            @RequestBody @Valid NotificationDtos.PasswordResetCodeRequest request) {
        return emailService.sendPasswordResetCode(request);
    }

    /** Booking cancellation: professional HTML email + refund PDF attachment. */
    @PostMapping("/cancellation-confirmation")
    @ResponseStatus(HttpStatus.CREATED)
    public NotificationDtos.EmailResponse sendCancellationConfirmation(
            @RequestBody NotificationDtos.BookingCancellationRequest request) {
        return emailService.sendCancellationConfirmation(request);
    }

    @PostMapping("/booking-updated")
    @ResponseStatus(HttpStatus.CREATED)
    public NotificationDtos.EmailResponse sendBookingUpdated(
            @RequestBody @Valid NotificationDtos.BookingUpdatedRequest request) {
        return emailService.sendBookingUpdated(request);
    }

    /** Generate and download a payment PDF invoice directly (frontend Download button). */
    @PostMapping(value = "/invoice/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> downloadInvoicePdf(
            @RequestBody NotificationDtos.BookingConfirmationRequest request) throws Exception {
        byte[] pdf = invoicePdfService.generate(request);
        String filename = "Invoice-" +
                (request.invoiceNumber() != null && !request.invoiceNumber().isBlank()
                        ? request.invoiceNumber() : "WL") + ".pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    /** Generate and download a refund PDF invoice directly (frontend Download button). */
    @PostMapping(value = "/refund-invoice/pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    public ResponseEntity<byte[]> downloadRefundInvoicePdf(
            @RequestBody NotificationDtos.BookingCancellationRequest request) throws Exception {
        byte[] pdf = invoicePdfService.generateRefund(request);
        String filename = "Refund-Invoice-" +
                (request.invoiceNumber() != null && !request.invoiceNumber().isBlank()
                        ? request.invoiceNumber() : "WL") + ".pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }
}
