package com.lockin.backend.dto;

import java.util.List;

public record DashboardResponse(List<TaskResponse> tasks) {
}
