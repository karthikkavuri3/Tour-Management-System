package com.tour.booking.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "invoices")
@Getter
@Setter
public class Invoice {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne
    @JoinColumn(name = "booking_id")
    private Booking booking;
    @Column(name = "invoice_number", unique = true, nullable = false)
    private String invoiceNumber;
    @Column(name = "invoice_date")
    private LocalDateTime invoiceDate;
    @Column(nullable = false)
    private BigDecimal amount;
    private String remarks;
}
