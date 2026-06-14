package com.lockin.backend.controller;

import com.lockin.backend.dto.TaskRequest;
import com.lockin.backend.dto.TaskResponse;
import com.lockin.backend.service.TaskService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/me/tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    @GetMapping
    public List<TaskResponse> getTasks(Authentication authentication) {
        return taskService.getTasks(authentication.getName());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse createTask(Authentication authentication, @Valid @RequestBody TaskRequest request) {
        return taskService.createTask(authentication.getName(), request);
    }

    @PutMapping("/{taskId}")
    public TaskResponse updateTask(
            Authentication authentication,
            @PathVariable UUID taskId,
            @Valid @RequestBody TaskRequest request) {
        return taskService.updateTask(authentication.getName(), taskId, request);
    }

    @DeleteMapping("/{taskId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTask(Authentication authentication, @PathVariable UUID taskId) {
        taskService.deleteTask(authentication.getName(), taskId);
    }
}
