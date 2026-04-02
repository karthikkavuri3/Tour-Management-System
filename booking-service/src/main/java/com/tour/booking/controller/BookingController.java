package com.tour.booking.controller;

import com.tour.booking.dto.BookingDtos;
import com.tour.booking.service.BookingService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class BookingController {
    private final BookingService bookingService;

    @PostMapping("/bookings")
    @ResponseStatus(HttpStatus.CREATED)
    public BookingDtos.BookingResponse createBooking(@RequestBody @Valid BookingDtos.CreateBookingRequest request) {
        return bookingService.createBooking(request, false);
    }

    @PutMapping("/bookings/{id}")
    public BookingDtos.BookingResponse updateBooking(@PathVariable Long id, @RequestBody @Valid BookingDtos.UpdateBookingRequest request) {
        return bookingService.updateBooking(id, request, false);
    }

    @GetMapping("/bookings/my")
    public List<BookingDtos.BookingResponse> myBookings(@RequestParam Long userId) {
        return bookingService.myBookings(userId);
    }

    @GetMapping("/bookings")
    public List<BookingDtos.BookingResponse> allBookings() {
        return bookingService.allBookings();
    }

    @PostMapping("/admin/bookings/search")
    public List<BookingDtos.BookingResponse> filterBookings(@RequestBody BookingDtos.BookingFilterRequest request) {
        return bookingService.filterBookings(request);
    }

    @PostMapping("/admin/bookings")
    @ResponseStatus(HttpStatus.CREATED)
    public BookingDtos.BookingResponse adminCreateBooking(@RequestBody @Valid BookingDtos.AdminCreateBookingRequest request) {
        BookingDtos.CreateBookingRequest createRequest = new BookingDtos.CreateBookingRequest(
                request.userId(),
                request.tourPackageId(),
                request.startDate(),
                request.endDate(),
                request.totalAmount(),
                request.paymentMethod(),
                request.mockPaymentSuccess(),
                request.customerEmail(),
                request.travelers(),
                request.customerName(),
                request.tourTitle(),
                request.destinationName(),
                request.durationDays(),
                request.pricePerPerson()
        );
        return bookingService.createBooking(createRequest, true);
    }

    @PutMapping("/admin/bookings/{id}")
    public BookingDtos.BookingResponse adminUpdateBooking(@PathVariable Long id, @RequestBody @Valid BookingDtos.UpdateBookingRequest request) {
        return bookingService.updateBooking(id, request, true);
    }

    @PutMapping("/bookings/{id}/cancel")
    public BookingDtos.BookingResponse cancel(
            @PathVariable Long id,
            @RequestBody(required = false) BookingDtos.CancelBookingRequest request
    ) {
        return bookingService.cancelBooking(id, request, false);
    }

    @PutMapping("/admin/bookings/{id}/cancel")
    public BookingDtos.BookingResponse adminCancel(
            @PathVariable Long id,
            @RequestBody(required = false) BookingDtos.CancelBookingRequest request
    ) {
        return bookingService.cancelBooking(id, request, true);
    }

    @PutMapping("/admin/bookings/{id}/complete")
    public BookingDtos.BookingResponse adminMarkCompleted(@PathVariable Long id) {
        return bookingService.markBookingCompleted(id);
    }

    @GetMapping("/invoices/{bookingId}/all")
    public List<BookingDtos.InvoiceResponse> allInvoices(@PathVariable Long bookingId) {
        return bookingService.allInvoicesByBooking(bookingId);
    }

    @GetMapping("/payments/{bookingId}")
    public BookingDtos.PaymentResponse payment(@PathVariable Long bookingId) {
        return bookingService.paymentByBooking(bookingId);
    }

    @GetMapping("/invoices/{bookingId}")
    public BookingDtos.InvoiceResponse invoice(@PathVariable Long bookingId) {
        return bookingService.invoiceByBooking(bookingId);
    }
}
