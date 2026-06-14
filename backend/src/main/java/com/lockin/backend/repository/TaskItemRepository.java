package com.lockin.backend.repository;

import com.lockin.backend.entity.TaskItem;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TaskItemRepository extends JpaRepository<TaskItem, UUID> {

    List<TaskItem> findAllByOwnerUsernameOrderByDueDateAsc(String username);

    List<TaskItem> findTop3ByOwnerUsernameAndCompletedFalseAndDueDateIsNotNullOrderByDueDateAsc(String username);

    List<TaskItem> findAllByOwnerUsernameAndDueDateBetweenOrderByDueDateAsc(
            String username, LocalDate startDate, LocalDate endDate);

    Optional<TaskItem> findByIdAndOwnerUsername(UUID id, String username);
}
