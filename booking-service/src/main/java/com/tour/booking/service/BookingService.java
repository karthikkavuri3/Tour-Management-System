package com.tour.booking.service;

import com.tour.booking.dto.BookingDtos;
import com.tour.booking.entity.Booking;
import com.tour.booking.entity.BookingTraveler;
import com.tour.booking.entity.BookingEnums;
import com.tour.booking.entity.Invoice;
import com.tour.booking.entity.Payment;
import com.tour.booking.exception.ApiException;
import com.tour.booking.repository.BookingRepository;
import com.tour.booking.repository.InvoiceRepository;
import com.tour.booking.repository.PaymentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class BookingService {
    private final BookingRepository bookingRepository;
    private final PaymentRepository paymentRepository;
    private final InvoiceRepository invoiceRepository;
    private final RestTemplate restTemplate;

    @Value("${services.tour-base-url}")
    private String tourServiceBaseUrl;
    @Value("${services.notification-base-url}")
    private String notificationServiceBaseUrl;

    @Transactional
    public BookingDtos.BookingResponse createBooking(BookingDtos.CreateBookingRequest request, boolean adminOverride) {
        validateTravelers(request.travelers(), adminOverride);
        int numberOfPeople = request.travelers().size();
        reduceBookings(request.tourPackageId(), numberOfPeople, adminOverride);

        // Create a tour schedule record for the user-chosen travel dates
        Long scheduleId = createScheduleForBooking(request.tourPackageId(), request.startDate(), request.endDate());

        Booking booking = new Booking();
        booking.setBookingReference("BKG-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        booking.setUserId(request.userId());
        booking.setTourPackageId(request.tourPackageId());
        booking.setScheduleId(scheduleId);
        booking.setNumberOfPeople(numberOfPeople);
        booking.setTotalAmount(request.totalAmount());
        booking.setBookingDate(LocalDateTime.now());

        boolean success = request.mockPaymentSuccess() == null || request.mockPaymentSuccess();
        booking.setPaymentStatus(success ? BookingEnums.PaymentStatus.SUCCESS : BookingEnums.PaymentStatus.FAILED);
        booking.setBookingStatus(success ? BookingEnums.BookingStatus.CONFIRMED : BookingEnums.BookingStatus.CANCELLED);
        mapTravelers(booking, request.travelers());
        Booking saved = bookingRepository.save(booking);

        createPayment(saved, request.paymentMethod(), saved.getPaymentStatus(), "PAYMENT");
        Invoice invoice = createInvoice(saved, success ? "Booking payment successful" : "Booking payment failed");

        if (request.customerEmail() != null) {
            if (success) {
                sendBookingConfirmation(request, saved, invoice);
            } else {
                sendEmail(
                        request.customerEmail(),
                        "Booking Payment Failed",
                        "Payment failed for booking " + saved.getBookingReference() + ". Booking is not confirmed."
                );
            }
        }
        return toBookingResponse(saved);
    }

    @Transactional
    public BookingDtos.BookingResponse updateBooking(Long bookingId, BookingDtos.UpdateBookingRequest request, boolean adminOverride) {
        Booking booking = bookingRepository.findById(bookingId).orElseThrow(() -> new ApiException("Booking not found"));
        if (booking.getBookingStatus() == BookingEnums.BookingStatus.CANCELLED) {
            throw new ApiException("Cancelled booking cannot be modified");
        }

        validateTravelers(request.travelers(), adminOverride);
        int newTravelers = request.travelers().size();
        int diff = newTravelers - booking.getNumberOfPeople();
        if (diff > 0) {
            reduceBookings(booking.getTourPackageId(), diff, adminOverride);
        } else if (diff < 0) {
            increaseBookings(booking.getTourPackageId(), Math.abs(diff));
        }

        // If new travel dates provided, create a fresh schedule
        Long newScheduleId = request.newStartDate() != null && request.newEndDate() != null
                ? createScheduleForBooking(booking.getTourPackageId(), request.newStartDate(), request.newEndDate())
                : request.scheduleId();

        booking.setScheduleId(newScheduleId);
        booking.setTotalAmount(request.totalAmount());
        booking.setNumberOfPeople(newTravelers);
        mapTravelers(booking, request.travelers());
        Booking saved = bookingRepository.save(booking);

        if (request.customerEmail() != null) {
            sendBookingUpdatedConfirmation(request, saved);
        }
        return toBookingResponse(saved);
    }

    @Transactional
    public BookingDtos.BookingResponse cancelBooking(Long bookingId,
                                                     BookingDtos.CancelBookingRequest request,
                                                     boolean adminOverride) {
        Booking booking = bookingRepository.findById(bookingId).orElseThrow(() -> new ApiException("Booking not found"));
        if (booking.getBookingStatus() == BookingEnums.BookingStatus.CANCELLED) {
            return toBookingResponse(booking);
        }
        booking.setBookingStatus(BookingEnums.BookingStatus.CANCELLED);
        booking.setPaymentStatus(BookingEnums.PaymentStatus.REFUNDED);

        createPayment(booking, "MOCK_REFUND", BookingEnums.PaymentStatus.REFUNDED, "REFUND");
        Invoice refundInvoice = createInvoice(booking, "Booking cancelled and refund initiated");
        if (!adminOverride) {
            increaseBookings(booking.getTourPackageId(), booking.getNumberOfPeople());
        }

        Booking saved = bookingRepository.save(booking);
        String email = request != null ? request.customerEmail() : null;
        if (email != null) {
            sendCancellationConfirmation(enrichCancelRequest(request, saved), saved, refundInvoice);
        }
        return toBookingResponse(saved);
    }

    @Transactional
    public BookingDtos.BookingResponse markBookingCompleted(Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId).orElseThrow(() -> new ApiException("Booking not found"));
        if (booking.getBookingStatus() == BookingEnums.BookingStatus.CANCELLED) {
            throw new ApiException("Cancelled booking cannot be marked as completed");
        }
        if (booking.getBookingStatus() == BookingEnums.BookingStatus.COMPLETED) {
            return toBookingResponse(booking);
        }
        if (booking.getBookingStatus() != BookingEnums.BookingStatus.CONFIRMED) {
            throw new ApiException("Only confirmed bookings can be marked as completed");
        }
        booking.setBookingStatus(BookingEnums.BookingStatus.COMPLETED);
        return toBookingResponse(bookingRepository.save(booking));
    }

    public List<BookingDtos.InvoiceResponse> allInvoicesByBooking(Long bookingId) {
        return invoiceRepository.findByBooking_IdOrderByInvoiceDateAsc(bookingId).stream()
                .map(inv -> {
                    String type = inv.getRemarks() != null && inv.getRemarks().contains("cancelled") ? "REFUND" : "PAYMENT";
                    return new BookingDtos.InvoiceResponse(
                            inv.getInvoiceNumber(), inv.getInvoiceDate(), inv.getAmount(), inv.getRemarks(), type);
                }).toList();
    }

    public List<BookingDtos.BookingResponse> myBookings(Long userId) {
        reconcileCompletedBookings();
        return bookingRepository.findByUserId(userId).stream().map(this::toBookingResponse).toList();
    }

    public List<BookingDtos.BookingResponse> allBookings() {
        reconcileCompletedBookings();
        return bookingRepository.findAll().stream().map(this::toBookingResponse).toList();
    }

    public List<BookingDtos.BookingResponse> filterBookings(BookingDtos.BookingFilterRequest request) {
        reconcileCompletedBookings();
        Specification<Booking> spec = Specification.where(null);
        if (request.userId() != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("userId"), request.userId()));
        }
        if (request.tourPackageId() != null) {
            spec = spec.and((root, query, cb) -> cb.equal(root.get("tourPackageId"), request.tourPackageId()));
        }
        if (request.bookingStatus() != null && !request.bookingStatus().isBlank()) {
            BookingEnums.BookingStatus status = BookingEnums.BookingStatus.valueOf(request.bookingStatus().toUpperCase());
            spec = spec.and((root, query, cb) -> cb.equal(root.get("bookingStatus"), status));
        }
        if (request.paymentStatus() != null && !request.paymentStatus().isBlank()) {
            BookingEnums.PaymentStatus status = BookingEnums.PaymentStatus.valueOf(request.paymentStatus().toUpperCase());
            spec = spec.and((root, query, cb) -> cb.equal(root.get("paymentStatus"), status));
        }
        if (request.bookedFrom() != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("bookingDate"), request.bookedFrom()));
        }
        if (request.bookedTo() != null) {
            spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("bookingDate"), request.bookedTo()));
        }
        if (request.minAmount() != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("totalAmount"), request.minAmount()));
        }
        if (request.maxAmount() != null) {
            spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("totalAmount"), request.maxAmount()));
        }

        return bookingRepository.findAll(spec).stream().map(this::toBookingResponse).toList();
    }

    @Transactional
    protected void reconcileCompletedBookings() {
        LocalDate today = LocalDate.now();
        List<Booking> activeBookings = bookingRepository.findByBookingStatusIn(
                List.of(BookingEnums.BookingStatus.PENDING, BookingEnums.BookingStatus.CONFIRMED)
        );
        if (activeBookings.isEmpty()) return;

        Map<Long, LocalDate> endDateBySchedule = new HashMap<>();
        List<Booking> changed = new ArrayList<>();

        for (Booking booking : activeBookings) {
            Long scheduleId = booking.getScheduleId();
            if (scheduleId == null) continue;

            LocalDate endDate = endDateBySchedule.get(scheduleId);
            if (endDate == null) {
                endDate = fetchScheduleEndDate(scheduleId);
                if (endDate != null) endDateBySchedule.put(scheduleId, endDate);
            }
            if (endDate != null && endDate.isBefore(today)) {
                booking.setBookingStatus(BookingEnums.BookingStatus.COMPLETED);
                changed.add(booking);
            }
        }
        if (!changed.isEmpty()) {
            bookingRepository.saveAll(changed);
        }
    }

    @SuppressWarnings("unchecked")
    private LocalDate fetchScheduleEndDate(Long scheduleId) {
        String url = tourServiceBaseUrl + "/schedules/" + scheduleId;
        try {
            var response = restTemplate.getForEntity(url, Map.class);
            Map<String, Object> body = response.getBody();
            if (body == null || body.get("endDate") == null) return null;
            return LocalDate.parse(String.valueOf(body.get("endDate")));
        } catch (Exception ignored) {
            return null;
        }
    }

    public BookingDtos.PaymentResponse paymentByBooking(Long bookingId) {
        Payment payment = paymentRepository.findTopByBooking_IdOrderByCreatedAtDesc(bookingId)
                .orElseThrow(() -> new ApiException("Payment not found"));
        return new BookingDtos.PaymentResponse(
                payment.getPaymentReference(), payment.getAmount(), payment.getPaymentMethod(),
                payment.getPaymentStatus().name(), payment.getPaidAt()
        );
    }

    public BookingDtos.InvoiceResponse invoiceByBooking(Long bookingId) {
        Invoice invoice = invoiceRepository.findTopByBooking_IdOrderByInvoiceDateDesc(bookingId)
                .orElseThrow(() -> new ApiException("Invoice not found"));
        String type = invoice.getRemarks() != null && invoice.getRemarks().contains("cancelled") ? "REFUND" : "PAYMENT";
        return new BookingDtos.InvoiceResponse(invoice.getInvoiceNumber(), invoice.getInvoiceDate(), invoice.getAmount(), invoice.getRemarks(), type);
    }

    private void reduceBookings(Long tourPackageId, Integer count, boolean force) {
        String url = tourServiceBaseUrl + "/tours/" + tourPackageId + "/bookings/reduce";
        Map<String, Object> body = Map.of("seats", count, "force", force);
        try {
            restTemplate.exchange(url, HttpMethod.PUT, new HttpEntity<>(body), Object.class);
        } catch (Exception ex) {
            throw new ApiException("Unable to reserve booking slot: " + ex.getMessage());
        }
    }

    private void increaseBookings(Long tourPackageId, Integer count) {
        String url = tourServiceBaseUrl + "/tours/" + tourPackageId + "/bookings/increase";
        Map<String, Object> body = Map.of("seats", count, "force", true);
        try {
            restTemplate.exchange(url, HttpMethod.PUT, new HttpEntity<>(body), Object.class);
        } catch (Exception ex) {
            throw new ApiException("Unable to release booking slot: " + ex.getMessage());
        }
    }

    private Long createScheduleForBooking(Long tourPackageId, LocalDate startDate, LocalDate endDate) {
        String url = tourServiceBaseUrl + "/schedules";
        Map<String, Object> body = Map.of(
                "tourPackageId", tourPackageId,
                "startDate", startDate.toString(),
                "endDate", endDate.toString()
        );
        try {
            var response = restTemplate.postForEntity(url, body, Map.class);
            if (response.getBody() == null || response.getBody().get("id") == null) {
                throw new ApiException("Failed to create tour schedule");
            }
            return ((Number) response.getBody().get("id")).longValue();
        } catch (ApiException e) {
            throw e;
        } catch (Exception ex) {
            throw new ApiException("Unable to create tour schedule: " + ex.getMessage());
        }
    }

    private void sendEmail(String to, String subject, String body) {
        String url = notificationServiceBaseUrl + "/notifications/email";
        Map<String, Object> payload = Map.of("recipientEmail", to, "subject", subject, "messageBody", body);
        try {
            restTemplate.postForEntity(url, payload, Object.class);
        } catch (Exception ignored) {
            // keep booking flow resilient even when notification service is unavailable
        }
    }

    private void sendBookingConfirmation(BookingDtos.CreateBookingRequest req,
                                         Booking booking, Invoice invoice) {
        String url = notificationServiceBaseUrl + "/notifications/booking-confirmation";
        BigDecimal subtotal    = booking.getTotalAmount();
        BigDecimal fee         = subtotal.multiply(BigDecimal.valueOf(0.01))
                                         .setScale(2, java.math.RoundingMode.HALF_UP);
        BigDecimal grandTotal  = subtotal.add(fee);

        String bookingDateStr  = booking.getBookingDate() != null
                ? booking.getBookingDate().format(DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm")) : "";

        Map<String, Object> payload = new HashMap<>();
        payload.put("recipientEmail",   req.customerEmail());
        payload.put("customerName",     req.customerName()     != null ? req.customerName()     : "");
        payload.put("bookingReference", booking.getBookingReference());
        payload.put("invoiceNumber",    invoice.getInvoiceNumber());
        payload.put("tourTitle",        req.tourTitle()        != null ? req.tourTitle()        : "");
        payload.put("destinationName",  req.destinationName()  != null ? req.destinationName()  : "");
        payload.put("travelStartDate",  req.startDate().toString());
        payload.put("travelEndDate",    req.endDate().toString());
        payload.put("durationDays",     req.durationDays()     != null ? req.durationDays()     : 0);
        payload.put("numberOfTravelers", booking.getNumberOfPeople());
        payload.put("pricePerPerson",   req.pricePerPerson()   != null ? req.pricePerPerson()   : BigDecimal.ZERO);
        payload.put("totalAmount",      subtotal);
        payload.put("processingFee",    fee);
        payload.put("grandTotal",       grandTotal);
        payload.put("paymentMethod",    req.paymentMethod()    != null ? req.paymentMethod()    : "CREDIT_CARD");
        payload.put("bookingDate",      bookingDateStr);

        try {
            restTemplate.postForEntity(url, payload, Object.class);
        } catch (Exception ex) {
            // fall back to plain email so the booking flow never breaks
            sendEmail(req.customerEmail(),
                    "Booking Confirmed: " + booking.getBookingReference(),
                    "Booking " + booking.getBookingReference() + " confirmed. Total: $" + grandTotal);
        }
    }

    private void sendCancellationConfirmation(BookingDtos.CancelBookingRequest req,
                                               Booking booking, Invoice refundInvoice) {
        String url = notificationServiceBaseUrl + "/notifications/cancellation-confirmation";
        String cancelDate = LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy"));

        Map<String, Object> payload = new HashMap<>();
        payload.put("recipientEmail",    req.customerEmail());
        payload.put("customerName",      req.customerName()      != null ? req.customerName()      : "");
        payload.put("bookingReference",  booking.getBookingReference());
        payload.put("invoiceNumber",     refundInvoice.getInvoiceNumber());
        payload.put("tourTitle",         req.tourTitle()         != null ? req.tourTitle()         : "");
        payload.put("destinationName",   req.destinationName()   != null ? req.destinationName()   : "");
        payload.put("travelStartDate",   req.travelStartDate()   != null ? req.travelStartDate()   : "");
        payload.put("travelEndDate",     req.travelEndDate()     != null ? req.travelEndDate()      : "");
        payload.put("durationDays",      req.durationDays()      != null ? req.durationDays()      : 0);
        payload.put("numberOfTravelers", req.numberOfTravelers() != null ? req.numberOfTravelers() : booking.getNumberOfPeople());
        payload.put("totalAmount",       booking.getTotalAmount());
        payload.put("cancellationDate",  cancelDate);
        try {
            restTemplate.postForEntity(url, payload, Object.class);
        } catch (Exception ex) {
            sendEmail(req.customerEmail(),
                    "Booking Cancelled: " + booking.getBookingReference(),
                    "Your booking " + booking.getBookingReference() + " has been cancelled. Refund: $" + booking.getTotalAmount());
        }
    }

    private BookingDtos.CancelBookingRequest enrichCancelRequest(BookingDtos.CancelBookingRequest req, Booking booking) {
        BookingDtos.CancelBookingRequest safeReq = req == null
                ? new BookingDtos.CancelBookingRequest(null, null, null, null, null, null, null, null, null)
                : req;
        Map<String, Object> schedule = fetchScheduleDetails(booking.getScheduleId());
        Map<String, Object> tour = fetchTourDetails(booking.getTourPackageId());
        String startDate = safeReq.travelStartDate() != null && !safeReq.travelStartDate().isBlank()
                ? safeReq.travelStartDate()
                : asString(schedule.get("startDate"));
        String endDate = safeReq.travelEndDate() != null && !safeReq.travelEndDate().isBlank()
                ? safeReq.travelEndDate()
                : asString(schedule.get("endDate"));
        Integer durationDays = safeReq.durationDays() != null && safeReq.durationDays() > 0
                ? safeReq.durationDays()
                : deriveDuration(startDate, endDate);
        return new BookingDtos.CancelBookingRequest(
                safeReq.customerEmail(),
                safeReq.customerName(),
                safeReq.tourTitle() != null && !safeReq.tourTitle().isBlank() ? safeReq.tourTitle() : asString(tour.get("title")),
                safeReq.destinationName() != null && !safeReq.destinationName().isBlank() ? safeReq.destinationName() : asString(tour.get("destinationName")),
                startDate,
                endDate,
                durationDays,
                safeReq.numberOfTravelers() != null ? safeReq.numberOfTravelers() : booking.getNumberOfPeople(),
                safeReq.pricePerPerson()
        );
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchScheduleDetails(Long scheduleId) {
        if (scheduleId == null) return Map.of();
        String url = tourServiceBaseUrl + "/schedules/" + scheduleId;
        try {
            var response = restTemplate.getForEntity(url, Map.class);
            return response.getBody() != null ? response.getBody() : Map.of();
        } catch (Exception ignored) {
            return Map.of();
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fetchTourDetails(Long tourId) {
        if (tourId == null) return Map.of();
        String url = tourServiceBaseUrl + "/tours/" + tourId;
        try {
            var response = restTemplate.getForEntity(url, Map.class);
            return response.getBody() != null ? response.getBody() : Map.of();
        } catch (Exception ignored) {
            return Map.of();
        }
    }

    private void sendBookingUpdatedConfirmation(BookingDtos.UpdateBookingRequest req, Booking booking) {
        String url = notificationServiceBaseUrl + "/notifications/booking-updated";
        Map<String, Object> schedule = fetchScheduleDetails(booking.getScheduleId());
        Map<String, Object> tour = fetchTourDetails(booking.getTourPackageId());
        String startDate = asString(schedule.get("startDate"));
        String endDate = asString(schedule.get("endDate"));
        Map<String, Object> payload = new HashMap<>();
        payload.put("recipientEmail", req.customerEmail());
        payload.put("customerName", "");
        payload.put("bookingReference", booking.getBookingReference());
        payload.put("tourTitle", asString(tour.get("title")));
        payload.put("destinationName", asString(tour.get("destinationName")));
        payload.put("travelStartDate", startDate);
        payload.put("travelEndDate", endDate);
        payload.put("durationDays", deriveDuration(startDate, endDate));
        payload.put("numberOfTravelers", booking.getNumberOfPeople());
        payload.put("totalAmount", booking.getTotalAmount());
        payload.put("updatedAt", LocalDate.now().format(DateTimeFormatter.ofPattern("dd MMM yyyy")));
        try {
            restTemplate.postForEntity(url, payload, Object.class);
        } catch (Exception ex) {
            sendEmail(req.customerEmail(), "Booking Updated",
                    "Your booking " + booking.getBookingReference() + " has been updated.");
        }
    }

    private String asString(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    private Integer deriveDuration(String startDate, String endDate) {
        try {
            if (startDate != null && !startDate.isBlank() && endDate != null && !endDate.isBlank()) {
                long days = java.time.temporal.ChronoUnit.DAYS.between(LocalDate.parse(startDate), LocalDate.parse(endDate)) + 1;
                if (days > 0) return (int) days;
            }
        } catch (Exception ignored) {}
        return 0;
    }

    private void validateTravelers(List<BookingDtos.TravelerRequest> travelers, boolean adminOverride) {
        if (travelers == null || travelers.isEmpty()) {
            throw new ApiException("At least one traveler is required");
        }
        if (!adminOverride && travelers.size() > 6) {
            throw new ApiException("Maximum 6 travelers allowed per booking");
        }
    }

    private void mapTravelers(Booking booking, List<BookingDtos.TravelerRequest> travelers) {
        List<BookingTraveler> mapped = new ArrayList<>();
        for (BookingDtos.TravelerRequest traveler : travelers) {
            BookingTraveler bt = new BookingTraveler();
            bt.setBooking(booking);
            bt.setFirstName(traveler.firstName());
            bt.setLastName(traveler.lastName());
            bt.setAge(traveler.age());
            mapped.add(bt);
        }
        booking.getTravelers().clear();
        booking.getTravelers().addAll(mapped);
    }

    private void createPayment(Booking booking, String paymentMethod, BookingEnums.PaymentStatus status, String transactionType) {
        Payment payment = new Payment();
        payment.setBooking(booking);
        payment.setPaymentReference("PAY-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        payment.setAmount(booking.getTotalAmount());
        payment.setPaymentMethod(paymentMethod == null ? "MOCK_CARD" : paymentMethod);
        payment.setPaymentStatus(status);
        payment.setTransactionType(transactionType);
        payment.setPaidAt(LocalDateTime.now());
        paymentRepository.save(payment);
    }

    private Invoice createInvoice(Booking booking, String remarks) {
        Invoice invoice = new Invoice();
        invoice.setBooking(booking);
        invoice.setInvoiceNumber("INV-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        invoice.setInvoiceDate(LocalDateTime.now());
        invoice.setAmount(booking.getTotalAmount());
        invoice.setRemarks(remarks);
        return invoiceRepository.save(invoice);
    }

    private BookingDtos.BookingResponse toBookingResponse(Booking booking) {
        List<BookingDtos.TravelerResponse> travelers = booking.getTravelers().stream()
                .map(t -> new BookingDtos.TravelerResponse(t.getFirstName(), t.getLastName(), t.getAge()))
                .toList();
        return new BookingDtos.BookingResponse(
                booking.getId(), booking.getBookingReference(), booking.getUserId(), booking.getTourPackageId(),
                booking.getScheduleId(), booking.getNumberOfPeople(), booking.getTotalAmount(),
                booking.getBookingStatus().name(), booking.getPaymentStatus().name(), booking.getBookingDate(), travelers
        );
    }
}
