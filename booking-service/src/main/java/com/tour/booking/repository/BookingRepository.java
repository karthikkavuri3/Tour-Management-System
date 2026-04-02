package com.tour.booking.repository;

import com.tour.booking.entity.Booking;
import com.tour.booking.entity.BookingEnums;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long>, JpaSpecificationExecutor<Booking> {
    List<Booking> findByUserId(Long userId);
    List<Booking> findByBookingStatusIn(List<BookingEnums.BookingStatus> statuses);
}
