package com.tour.booking.repository;

import com.tour.booking.entity.Invoice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {
    Optional<Invoice> findTopByBooking_IdOrderByInvoiceDateDesc(Long bookingId);
    List<Invoice> findByBooking_IdOrderByInvoiceDateAsc(Long bookingId);
}
