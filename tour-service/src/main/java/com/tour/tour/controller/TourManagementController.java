package com.tour.tour.controller;

import com.tour.tour.dto.TourDtos;
import com.tour.tour.service.TourManagementService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequiredArgsConstructor
public class TourManagementController {
    private final TourManagementService service;

    @GetMapping("/destinations")
    public List<TourDtos.DestinationResponse> destinations() {
        return service.allDestinations();
    }

    @PostMapping("/destinations")
    @ResponseStatus(HttpStatus.CREATED)
    public TourDtos.DestinationResponse createDestination(@RequestBody @Valid TourDtos.DestinationRequest request) {
        return service.createDestination(request);
    }

    @PutMapping("/destinations/{id}")
    public TourDtos.DestinationResponse updateDestination(@PathVariable Long id, @RequestBody @Valid TourDtos.DestinationRequest request) {
        return service.updateDestination(id, request);
    }

    @DeleteMapping("/destinations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDestination(@PathVariable Long id) {
        service.deleteDestination(id);
    }

    @GetMapping("/tours")
    public List<TourDtos.TourPackageResponse> tours(
            @RequestParam(required = false) String destination,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false) Integer minDuration,
            @RequestParam(required = false) Integer maxDuration,
            @RequestParam(required = false) String status
    ) {
        return service.allTours(destination, minPrice, maxPrice, minDuration, maxDuration, status);
    }

    @GetMapping("/tours/{id}")
    public TourDtos.TourPackageResponse tour(@PathVariable Long id) {
        return service.getTour(id);
    }

    @PostMapping("/tours")
    @ResponseStatus(HttpStatus.CREATED)
    public TourDtos.TourPackageResponse createTour(@RequestBody @Valid TourDtos.TourPackageRequest request) {
        return service.createTour(request);
    }

    @PutMapping("/tours/{id}")
    public TourDtos.TourPackageResponse updateTour(@PathVariable Long id, @RequestBody @Valid TourDtos.TourPackageRequest request) {
        return service.updateTour(id, request);
    }

    @DeleteMapping("/tours/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTour(@PathVariable Long id) {
        service.deleteTour(id);
    }

    @GetMapping("/schedules")
    public List<TourDtos.TourScheduleResponse> schedules() {
        return service.allSchedules();
    }

    @GetMapping("/schedules/{id}")
    public TourDtos.TourScheduleResponse schedule(@PathVariable Long id) {
        return service.getSchedule(id);
    }

    @PostMapping("/schedules")
    @ResponseStatus(HttpStatus.CREATED)
    public TourDtos.TourScheduleResponse createSchedule(@RequestBody @Valid TourDtos.TourScheduleRequest request) {
        return service.createSchedule(request);
    }

    @PutMapping("/schedules/{id}")
    public TourDtos.TourScheduleResponse updateSchedule(@PathVariable Long id, @RequestBody @Valid TourDtos.TourScheduleRequest request) {
        return service.updateSchedule(id, request);
    }

    @DeleteMapping("/schedules/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSchedule(@PathVariable Long id) {
        service.deleteSchedule(id);
    }

    @PutMapping("/tours/{id}/bookings/reduce")
    public TourDtos.TourPackageResponse reduceBookings(@PathVariable Long id, @RequestBody @Valid TourDtos.SeatUpdateRequest request) {
        return service.reduceBookings(id, request.seats(), request.force() != null && request.force());
    }

    @PutMapping("/tours/{id}/bookings/increase")
    public TourDtos.TourPackageResponse increaseBookings(@PathVariable Long id, @RequestBody @Valid TourDtos.SeatUpdateRequest request) {
        return service.increaseBookings(id, request.seats(), request.force() != null && request.force());
    }
}
