package com.tour.booking.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "bookings")
@Getter
@Setter
public class Booking {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "booking_reference", unique = true, nullable = false)
    private String bookingReference;
    @Column(name = "user_id", nullable = false)
    private Long userId;
    @Column(name = "tour_package_id", nullable = false)
    private Long tourPackageId;
    @Column(name = "schedule_id", nullable = false)
    private Long scheduleId;
    @Column(name = "number_of_people", nullable = false)
    private Integer numberOfPeople;
    @Column(name = "total_amount", nullable = false)
    private BigDecimal totalAmount;
    @Enumerated(EnumType.STRING)
    @Column(name = "booking_status", nullable = false)
    private BookingEnums.BookingStatus bookingStatus = BookingEnums.BookingStatus.PENDING;
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false)
    private BookingEnums.PaymentStatus paymentStatus = BookingEnums.PaymentStatus.PENDING;
    @Column(name = "booking_date")
    private LocalDateTime bookingDate;

    @OneToMany(mappedBy = "booking", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<BookingTraveler> travelers = new ArrayList<>();
    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
