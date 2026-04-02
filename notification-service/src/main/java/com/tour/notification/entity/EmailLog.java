package com.tour.notification.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "email_logs")
@Getter
@Setter
public class EmailLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "recipient_email", nullable = false)
    private String recipientEmail;
    private String subject;
    @Column(name = "message_body", columnDefinition = "TEXT")
    private String messageBody;
    private String status;
    @CreationTimestamp
    @Column(name = "sent_at")
    private LocalDateTime sentAt;
}
