package interfaceadapter.dashboard;

import usecase.dashboard.DashboardInputBoundary;

public class DashboardController {

    private final DashboardInputBoundary dashboardInteractor;

    public DashboardController(DashboardInputBoundary dashboardInteractor) {
        this.dashboardInteractor = dashboardInteractor;
    }

    /**
     * Triggers the dashboard to refresh its data.
     * Call this when the HomePanel loads or when a task is modified.
     */
    public void execute() {
        dashboardInteractor.execute();
    }
}