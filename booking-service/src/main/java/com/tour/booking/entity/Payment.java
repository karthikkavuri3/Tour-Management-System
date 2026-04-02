package com.tour.booking.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payments")
@Getter
@Setter
public class Payment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne
    @JoinColumn(name = "booking_id")
    private Booking booking;
    @Column(name = "payment_reference", unique = true, nullable = false)
    private String paymentReference;
    @Column(nullable = false)
    private BigDecimal amount;
    @Column(name = "payment_method")
    private String paymentMethod;
    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status")
    private BookingEnums.PaymentStatus paymentStatus;
    @Column(name = "transaction_type")
    private String transactionType = "MOCK";
    @Column(name = "paid_at")
    private LocalDateTime paidAt;
    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
}
