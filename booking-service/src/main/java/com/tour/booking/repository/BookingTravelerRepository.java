package com.tour.booking.repository;

import com.tour.booking.entity.BookingTraveler;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookingTravelerRepository extends JpaRepository<BookingTraveler, Long> {
}
