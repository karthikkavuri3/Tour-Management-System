package com.tour.tour.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public class TourDtos {
    public record DestinationRequest(@NotBlank String name, String country, String description, String imageUrl) {}
    public record DestinationResponse(Long id, String name, String country, String description, String imageUrl, String status) {}

    public record TourPackageRequest(
            @NotBlank String title,
            String description,
            String imageUrl,
            @NotNull Long destinationId,
            @NotNull BigDecimal price,
            @NotNull @Min(1) Integer durationDays,
            @NotNull @Min(1) Integer maxCapacity,
            @NotNull @Min(0) Integer bookingsAvailable,
            LocalDate startDate,
            LocalDate endDate,
            List<ItineraryItemRequest> itineraryHighlights,
            List<String> whatsIncluded
    ) {}
    public record ItineraryItemRequest(
            @NotBlank String title,
            String details
    ) {}
    public record ItineraryItemResponse(
            String title,
            String details
    ) {}
    public record TourPackageResponse(
            Long id, String title, String description, Long destinationId, String destinationName,
            String imageUrl, BigDecimal price, Integer durationDays, Integer maxCapacity,
            Integer bookingsAvailable, LocalDate startDate, LocalDate endDate,
            List<ItineraryItemResponse> itineraryHighlights, List<String> whatsIncluded, String status
    ) {}

    public record TourScheduleRequest(
            @NotNull Long tourPackageId, @NotNull LocalDate startDate, @NotNull LocalDate endDate,
            LocalTime departureTime, LocalTime returnTime, String meetingPoint
    ) {}
    public record TourScheduleResponse(
            Long id, Long tourPackageId, String tourTitle, LocalDate startDate, LocalDate endDate,
            LocalTime departureTime, LocalTime returnTime, String meetingPoint, String status
    ) {}

    public record SeatUpdateRequest(@NotNull @Min(1) Integer seats, Boolean force) {}
}
