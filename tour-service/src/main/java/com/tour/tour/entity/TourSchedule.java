package com.tour.tour.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

@Entity
@Table(name = "tour_schedules")
@Getter
@Setter
public class TourSchedule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @ManyToOne
    @JoinColumn(name = "tour_package_id")
    private TourPackage tourPackage;
    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;
    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;
    @Column(name = "departure_time")
    private LocalTime departureTime;
    @Column(name = "return_time")
    private LocalTime returnTime;
    @Column(name = "meeting_point")
    private String meetingPoint;
    @Enumerated(EnumType.STRING)
    private StatusEnums.ScheduleStatus status = StatusEnums.ScheduleStatus.SCHEDULED;
    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
