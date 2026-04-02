package com.tour.tour.repository;

import com.tour.tour.entity.TourSchedule;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TourScheduleRepository extends JpaRepository<TourSchedule, Long> {
}
