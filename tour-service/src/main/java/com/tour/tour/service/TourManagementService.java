package com.tour.tour.service;

import com.tour.tour.dto.TourDtos;
import com.tour.tour.entity.Destination;
import com.tour.tour.entity.StatusEnums;
import com.tour.tour.entity.TourPackage;
import com.tour.tour.entity.TourSchedule;
import com.tour.tour.exception.ApiException;
import com.tour.tour.repository.DestinationRepository;
import com.tour.tour.repository.TourPackageRepository;
import com.tour.tour.repository.TourScheduleRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TourManagementService {
    private final DestinationRepository destinationRepository;
    private final TourPackageRepository tourPackageRepository;
    private final TourScheduleRepository tourScheduleRepository;
    private final ObjectMapper objectMapper;

    public List<TourDtos.DestinationResponse> allDestinations() {
        return destinationRepository.findAll().stream().map(this::toDestination).toList();
    }

    @Transactional
    public TourDtos.DestinationResponse createDestination(TourDtos.DestinationRequest request) {
        Destination d = new Destination();
        d.setName(request.name());
        d.setCountry(request.country());
        d.setDescription(request.description());
        d.setImageUrl(request.imageUrl());
        return toDestination(destinationRepository.save(d));
    }

    @Transactional
    public TourDtos.DestinationResponse updateDestination(Long id, TourDtos.DestinationRequest request) {
        Destination d = destinationRepository.findById(id).orElseThrow(() -> new ApiException("Destination not found"));
        d.setName(request.name());
        d.setCountry(request.country());
        d.setDescription(request.description());
        d.setImageUrl(request.imageUrl());
        return toDestination(destinationRepository.save(d));
    }

    public void deleteDestination(Long id) {
        destinationRepository.deleteById(id);
    }

    public List<TourDtos.TourPackageResponse> allTours(
            String destination,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            Integer minDuration,
            Integer maxDuration,
            String status
    ) {
        Specification<TourPackage> spec = Specification.where(null);
        if (destination != null && !destination.isBlank()) {
            spec = spec.and((root, query, cb) -> cb.like(cb.lower(root.join("destination").get("name")), "%" + destination.toLowerCase() + "%"));
        }
        if (minPrice != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("price"), minPrice));
        }
        if (maxPrice != null) {
            spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("price"), maxPrice));
        }
        if (minDuration != null) {
            spec = spec.and((root, query, cb) -> cb.greaterThanOrEqualTo(root.get("durationDays"), minDuration));
        }
        if (maxDuration != null) {
            spec = spec.and((root, query, cb) -> cb.lessThanOrEqualTo(root.get("durationDays"), maxDuration));
        }
        if (status != null && !status.isBlank()) {
            StatusEnums.GeneralStatus parsed = StatusEnums.GeneralStatus.valueOf(status.toUpperCase());
            spec = spec.and((root, query, cb) -> cb.equal(root.get("status"), parsed));
        }
        return tourPackageRepository.findAll(spec).stream().map(this::toTour).toList();
    }

    public TourDtos.TourPackageResponse getTour(Long id) {
        return toTour(tourPackageRepository.findById(id).orElseThrow(() -> new ApiException("Tour package not found")));
    }

    @Transactional
    public TourDtos.TourPackageResponse createTour(TourDtos.TourPackageRequest request) {
        TourPackage tp = new TourPackage();
        fillTour(tp, request);
        return toTour(tourPackageRepository.save(tp));
    }

    @Transactional
    public TourDtos.TourPackageResponse updateTour(Long id, TourDtos.TourPackageRequest request) {
        TourPackage tp = tourPackageRepository.findById(id).orElseThrow(() -> new ApiException("Tour package not found"));
        fillTour(tp, request);
        return toTour(tourPackageRepository.save(tp));
    }

    public void deleteTour(Long id) {
        tourPackageRepository.deleteById(id);
    }

    public List<TourDtos.TourScheduleResponse> allSchedules() {
        return tourScheduleRepository.findAll().stream().map(this::toSchedule).toList();
    }

    public TourDtos.TourScheduleResponse getSchedule(Long id) {
        TourSchedule ts = tourScheduleRepository.findById(id)
                .orElseThrow(() -> new ApiException("Schedule not found"));
        return toSchedule(ts);
    }

    @Transactional
    public TourDtos.TourScheduleResponse createSchedule(TourDtos.TourScheduleRequest request) {
        TourSchedule ts = new TourSchedule();
        fillSchedule(ts, request);
        return toSchedule(tourScheduleRepository.save(ts));
    }

    @Transactional
    public TourDtos.TourScheduleResponse updateSchedule(Long id, TourDtos.TourScheduleRequest request) {
        TourSchedule ts = tourScheduleRepository.findById(id).orElseThrow(() -> new ApiException("Schedule not found"));
        fillSchedule(ts, request);
        return toSchedule(tourScheduleRepository.save(ts));
    }

    public void deleteSchedule(Long id) {
        tourScheduleRepository.deleteById(id);
    }

    @Transactional
    public TourDtos.TourPackageResponse reduceBookings(Long tourId, int count, boolean force) {
        TourPackage tp = tourPackageRepository.findById(tourId).orElseThrow(() -> new ApiException("Tour package not found"));
        if (!force && tp.getBookingsAvailable() < count) {
            throw new ApiException("Not enough bookings available");
        }
        tp.setBookingsAvailable(tp.getBookingsAvailable() - count);
        return toTour(tourPackageRepository.save(tp));
    }

    @Transactional
    public TourDtos.TourPackageResponse increaseBookings(Long tourId, int count, boolean force) {
        TourPackage tp = tourPackageRepository.findById(tourId).orElseThrow(() -> new ApiException("Tour package not found"));
        int updated = tp.getBookingsAvailable() + count;
        if (!force) {
            updated = Math.min(updated, tp.getMaxCapacity());
        }
        tp.setBookingsAvailable(updated);
        return toTour(tourPackageRepository.save(tp));
    }

    private void fillTour(TourPackage tp, TourDtos.TourPackageRequest request) {
        Destination destination = destinationRepository.findById(request.destinationId())
                .orElseThrow(() -> new ApiException("Destination not found"));
        tp.setTitle(request.title());
        tp.setDescription(request.description());
        tp.setImageUrl(request.imageUrl());
        tp.setDestination(destination);
        tp.setPrice(request.price());
        tp.setDurationDays(request.durationDays());
        tp.setMaxCapacity(request.maxCapacity());
        tp.setBookingsAvailable(request.bookingsAvailable());
        tp.setStartDate(request.startDate());
        tp.setEndDate(request.endDate());
        tp.setItineraryHighlightsJson(toJson(request.itineraryHighlights()));
        tp.setWhatsIncludedJson(toJson(request.whatsIncluded()));
    }

    private void fillSchedule(TourSchedule ts, TourDtos.TourScheduleRequest request) {
        TourPackage tp = tourPackageRepository.findById(request.tourPackageId())
                .orElseThrow(() -> new ApiException("Tour package not found"));
        // Validate the requested dates fall within the tour package's booking window
        if (tp.getStartDate() != null && request.startDate().isBefore(tp.getStartDate())) {
            throw new ApiException("Travel start date cannot be before the tour package opens (" + tp.getStartDate() + ")");
        }
        if (tp.getEndDate() != null && request.endDate().isAfter(tp.getEndDate())) {
            throw new ApiException("Travel end date cannot be after the tour package closes (" + tp.getEndDate() + ")");
        }
        ts.setTourPackage(tp);
        ts.setStartDate(request.startDate());
        ts.setEndDate(request.endDate());
        ts.setDepartureTime(request.departureTime());
        ts.setReturnTime(request.returnTime());
        ts.setMeetingPoint(request.meetingPoint());
    }

    private TourDtos.DestinationResponse toDestination(Destination d) {
        return new TourDtos.DestinationResponse(d.getId(), d.getName(), d.getCountry(), d.getDescription(), d.getImageUrl(), d.getStatus().name());
    }

    private TourDtos.TourPackageResponse toTour(TourPackage t) {
        return new TourDtos.TourPackageResponse(
                t.getId(), t.getTitle(), t.getDescription(), t.getDestination().getId(), t.getDestination().getName(),
                t.getImageUrl(), t.getPrice(), t.getDurationDays(), t.getMaxCapacity(),
                t.getBookingsAvailable(), t.getStartDate(), t.getEndDate(),
                parseItineraryHighlights(t.getItineraryHighlightsJson()),
                parseWhatsIncluded(t.getWhatsIncludedJson()),
                t.getStatus().name()
        );
    }

    private String toJson(Object value) {
        if (value == null) return null;
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            throw new ApiException("Failed to serialize tour details");
        }
    }

    private List<TourDtos.ItineraryItemResponse> parseItineraryHighlights(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        try {
            List<TourDtos.ItineraryItemRequest> items = objectMapper.readValue(
                    raw,
                    new TypeReference<List<TourDtos.ItineraryItemRequest>>() {}
            );
            return items.stream()
                    .map(i -> new TourDtos.ItineraryItemResponse(i.title(), i.details()))
                    .toList();
        } catch (Exception ex) {
            return List.of();
        }
    }

    private List<String> parseWhatsIncluded(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        try {
            return objectMapper.readValue(raw, new TypeReference<List<String>>() {});
        } catch (Exception ex) {
            return List.of();
        }
    }

    private TourDtos.TourScheduleResponse toSchedule(TourSchedule s) {
        return new TourDtos.TourScheduleResponse(
                s.getId(), s.getTourPackage().getId(), s.getTourPackage().getTitle(),
                s.getStartDate(), s.getEndDate(), s.getDepartureTime(), s.getReturnTime(), s.getMeetingPoint(), s.getStatus().name()
        );
    }
}
