package com.tour.booking.repository;

import com.tour.booking.entity.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findTopByBooking_IdOrderByCreatedAtDesc(Long bookingId);
}
