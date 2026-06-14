package com.lockin.backend.service;

import com.lockin.backend.dto.TaskRequest;
import com.lockin.backend.dto.TaskResponse;
import com.lockin.backend.entity.TaskItem;
import com.lockin.backend.repository.TaskItemRepository;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class TaskService {

    private final TaskItemRepository taskItemRepository;
    private final UserService userService;

    public TaskService(TaskItemRepository taskItemRepository, UserService userService) {
        this.taskItemRepository = taskItemRepository;
        this.userService = userService;
    }

    public List<TaskResponse> getTasks(String username) {
        userService.requireUser(username);
        return taskItemRepository.findAllByOwnerUsernameOrderByDueDateAsc(username).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public TaskResponse createTask(String username, TaskRequest request) {
        TaskItem task = new TaskItem();
        task.setOwner(userService.requireUser(username));
        applyRequest(task, request);
        return toResponse(taskItemRepository.save(task));
    }

    @Transactional
    public TaskResponse updateTask(String username, UUID taskId, TaskRequest request) {
        TaskItem task = taskItemRepository.findByIdAndOwnerUsername(taskId, username)
                .orElseThrow(() -> new com.lockin.backend.exception.NotFoundException("Task not found."));
        applyRequest(task, request);
        return toResponse(task);
    }

    @Transactional
    public void deleteTask(String username, UUID taskId) {
        TaskItem task = taskItemRepository.findByIdAndOwnerUsername(taskId, username)
                .orElseThrow(() -> new com.lockin.backend.exception.NotFoundException("Task not found."));
        taskItemRepository.delete(task);
    }

    private void applyRequest(TaskItem task, TaskRequest request) {
        task.setTitle(request.title().trim());
        task.setDescription(blankToNull(request.description()));
        task.setDueDate(request.dueDate());
        task.setCourse(blankToNull(request.course()));
        task.setCompleted(Boolean.TRUE.equals(request.completed()));
        task.setType(blankToDefault(request.type(), "Task"));
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

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private String blankToDefault(String value, String defaultValue) {
        return value == null || value.isBlank() ? defaultValue : value.trim();
    }
}
