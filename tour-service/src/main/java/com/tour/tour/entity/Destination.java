package com.tour.tour.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "destinations")
@Getter
@Setter
public class Destination {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false)
    private String name;
    private String country;
    @Column(columnDefinition = "TEXT")
    private String description;
    @Column(name = "image_url")
    private String imageUrl;
    @Enumerated(EnumType.STRING)
    private StatusEnums.GeneralStatus status = StatusEnums.GeneralStatus.ACTIVE;
    @CreationTimestamp
    @Column(name = "created_at")
    private LocalDateTime createdAt;
    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
