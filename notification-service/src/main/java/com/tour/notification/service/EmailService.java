package com.tour.notification.service;

import com.tour.notification.dto.NotificationDtos;
import com.tour.notification.entity.EmailLog;
import com.tour.notification.repository.EmailLogRepository;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;
    private final EmailLogRepository emailLogRepository;
    private final EmailTemplateService emailTemplateService;
    private final InvoicePdfService invoicePdfService;

    @Value("${app.mail.from-name:Wanderlust Tours}")
    private String fromName;

    @Value("${app.mail.from-address:noreply@wanderlust.tours}")
    private String fromAddress;

    // ── Simple text/HTML email (for cancellations, reminders, etc.) ───────────

    public NotificationDtos.EmailResponse sendEmail(NotificationDtos.EmailRequest request) {
        String status  = "SENT";
        String message = "Email sent successfully";
        try {
            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, false, "UTF-8");
            helper.setFrom(fromAddress, fromName);
            helper.setTo(request.recipientEmail());
            helper.setSubject(request.subject() == null ? "Tour Notification" : request.subject());
            helper.setText(request.messageBody(), false);
            mailSender.send(mime);
        } catch (Exception ex) {
            status  = "LOGGED";
            message = "SMTP unavailable, email logged instead";
            log.warn("Could not send email to {}: {}", request.recipientEmail(), ex.getMessage());
        }
        persist(request.recipientEmail(), request.subject(), request.messageBody(), status);
        return new NotificationDtos.EmailResponse(status, message);
    }

    // ── Rich booking confirmation: HTML email + PDF invoice attachment ─────────

    public NotificationDtos.EmailResponse sendBookingConfirmation(
            NotificationDtos.BookingConfirmationRequest request) {

        String status  = "SENT";
        String message = "Booking confirmation email sent successfully";
        String subject = "Booking Confirmed: " + request.bookingReference() + " \u2013 Wanderlust Tours";

        try {
            String htmlBody  = emailTemplateService.bookingConfirmation(request);
            byte[] pdfBytes  = invoicePdfService.generate(request);
            String pdfName   = "Invoice-" + (request.invoiceNumber() != null ? request.invoiceNumber() : "WL") + ".pdf";

            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            helper.setFrom(fromAddress, fromName);
            helper.setTo(request.recipientEmail());
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            helper.addAttachment(pdfName, new ByteArrayResource(pdfBytes), "application/pdf");

            mailSender.send(mime);
            log.info("Booking confirmation sent to {} [ref={}]",
                    request.recipientEmail(), request.bookingReference());

        } catch (Exception ex) {
            status  = "LOGGED";
            message = "SMTP unavailable, booking confirmation logged";
            log.warn("Could not send booking confirmation to {} [ref={}]: {}",
                    request.recipientEmail(), request.bookingReference(), ex.getMessage());
        }

        persist(request.recipientEmail(), subject,
                "Booking confirmation for " + request.bookingReference(), status);
        return new NotificationDtos.EmailResponse(status, message);
    }

    public NotificationDtos.EmailResponse sendPasswordResetCode(
            NotificationDtos.PasswordResetCodeRequest request) {
        String status = "SENT";
        String message = "Password reset code email sent successfully";
        String subject = "Your Password Reset Code - Wanderlust Tours";
        try {
            String htmlBody = emailTemplateService.passwordResetCode(request);
            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            helper.setFrom(fromAddress, fromName);
            helper.setTo(request.recipientEmail());
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            mailSender.send(mime);
        } catch (Exception ex) {
            status = "LOGGED";
            message = "SMTP unavailable, password reset email logged";
            log.warn("Could not send password reset email to {}: {}", request.recipientEmail(), ex.getMessage());
        }
        persist(request.recipientEmail(), subject, "Password reset verification code sent", status);
        return new NotificationDtos.EmailResponse(status, message);
    }

    public NotificationDtos.EmailResponse sendBookingUpdated(
            NotificationDtos.BookingUpdatedRequest request) {
        String status  = "SENT";
        String message = "Booking update email sent successfully";
        String subject = "Booking Updated: " + request.bookingReference() + " – Wanderlust Tours";
        try {
            String htmlBody = emailTemplateService.bookingUpdated(request);
            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            helper.setFrom(fromAddress, fromName);
            helper.setTo(request.recipientEmail());
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            mailSender.send(mime);
        } catch (Exception ex) {
            status  = "LOGGED";
            message = "SMTP unavailable, booking update logged";
            log.warn("Could not send booking update to {} [ref={}]: {}",
                    request.recipientEmail(), request.bookingReference(), ex.getMessage());
        }
        persist(request.recipientEmail(), subject, "Booking updated " + request.bookingReference(), status);
        return new NotificationDtos.EmailResponse(status, message);
    }

    // ── Booking cancellation: HTML email + refund PDF attachment ─────────────

    public NotificationDtos.EmailResponse sendCancellationConfirmation(
            NotificationDtos.BookingCancellationRequest request) {

        String status  = "SENT";
        String message = "Cancellation confirmation email sent successfully";
        String subject = "Booking Cancelled: " + request.bookingReference() + " \u2013 Wanderlust Tours";

        try {
            String htmlBody  = emailTemplateService.cancellationConfirmation(request);
            byte[] pdfBytes  = invoicePdfService.generateRefund(request);
            String pdfName   = "Refund-Invoice-" + (request.invoiceNumber() != null ? request.invoiceNumber() : "WL") + ".pdf";

            MimeMessage mime = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mime, true, "UTF-8");
            helper.setFrom(fromAddress, fromName);
            helper.setTo(request.recipientEmail());
            helper.setSubject(subject);
            helper.setText(htmlBody, true);
            helper.addAttachment(pdfName, new ByteArrayResource(pdfBytes), "application/pdf");

            mailSender.send(mime);
            log.info("Cancellation confirmation sent to {} [ref={}]",
                    request.recipientEmail(), request.bookingReference());

        } catch (Exception ex) {
            status  = "LOGGED";
            message = "SMTP unavailable, cancellation logged";
            log.warn("Could not send cancellation confirmation to {} [ref={}]: {}",
                    request.recipientEmail(), request.bookingReference(), ex.getMessage());
        }

        persist(request.recipientEmail(), subject,
                "Cancellation for " + request.bookingReference(), status);
        return new NotificationDtos.EmailResponse(status, message);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private void persist(String to, String subject, String body, String status) {
        try {
            EmailLog log = new EmailLog();
            log.setRecipientEmail(to);
            log.setSubject(subject);
            log.setMessageBody(body);
            log.setStatus(status);
            emailLogRepository.save(log);
        } catch (Exception ex) {
            // never let logging failure break the flow
        }
    }
}
