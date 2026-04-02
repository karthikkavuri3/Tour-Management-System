package com.tour.tour.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "tour_packages")
@Getter
@Setter
public class TourPackage {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private String title;
    @Column(columnDefinition = "TEXT")
    private String description;
    @Column(name = "image_url")
    private String imageUrl;
    @ManyToOne
    @JoinColumn(name = "destination_id")
    private Destination destination;
    @Column(nullable = false)
    private BigDecimal price;
    @Column(name = "duration_days", nullable = false)
    private Integer durationDays;
    @Column(name = "max_capacity", nullable = false)
    private Integer maxCapacity;
    @Column(name = "bookings_available", nullable = false)
    private Integer bookingsAvailable;
    @Column(name = "start_date")
    private java.time.LocalDate startDate;
    @Column(name = "end_date")
    private java.time.LocalDate endDate;
    @Column(name = "itinerary_highlights_json", columnDefinition = "TEXT")
    private String itineraryHighlightsJson;
    @Column(name = "whats_included_json", columnDefinition = "TEXT")
    private String whatsIncludedJson;
    @Enumerated(EnumType.STRING)
    private StatusEnums.GeneralStatus status = StatusEnums.GeneralStatus.ACTIVE;
    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
