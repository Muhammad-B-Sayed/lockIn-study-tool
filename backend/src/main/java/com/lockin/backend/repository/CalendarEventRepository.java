package com.lockin.backend.repository;

import com.lockin.backend.entity.CalendarEvent;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, UUID> {

    List<CalendarEvent> findAllByOwnerUsernameAndEventDateBetweenOrderByEventDateAsc(
            String username, LocalDate startDate, LocalDate endDate);

    Optional<CalendarEvent> findByIdAndOwnerUsername(UUID id, String username);
}
