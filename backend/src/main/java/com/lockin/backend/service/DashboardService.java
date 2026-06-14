package com.lockin.backend.service;

import com.lockin.backend.dto.DashboardResponse;
import com.lockin.backend.dto.TaskResponse;
import com.lockin.backend.entity.TaskItem;
import com.lockin.backend.repository.TaskItemRepository;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class DashboardService {

    private final TaskItemRepository taskItemRepository;
    private final UserService userService;

    public DashboardService(TaskItemRepository taskItemRepository, UserService userService) {
        this.taskItemRepository = taskItemRepository;
        this.userService = userService;
    }

    public DashboardResponse dueSoon(String username) {
        userService.requireUser(username);
        List<TaskResponse> tasks = taskItemRepository
                .findTop3ByOwnerUsernameAndCompletedFalseAndDueDateIsNotNullOrderByDueDateAsc(username)
                .stream()
                .map(this::toResponse)
                .toList();
        return new DashboardResponse(tasks);
    }

    private TaskResponse toResponse(TaskItem task) {
        return new TaskResponse(
                task.getId(),
                task.getTitle(),
                task.getDescription(),
                task.getDueDate(),
                task.getCourse(),
                task.isCompleted(),
                task.getType());
    }
}
