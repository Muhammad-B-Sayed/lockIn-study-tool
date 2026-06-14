package com.lockin.backend.controller;

import com.lockin.backend.dto.DashboardResponse;
import com.lockin.backend.service.DashboardService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.Authentication;

@RestController
@RequestMapping("/api/me/dashboard")
public class DashboardController {

    private final DashboardService dashboardService;

    public DashboardController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping("/due-soon")
    public DashboardResponse dueSoon(Authentication authentication) {
        return dashboardService.dueSoon(authentication.getName());
    }
}
