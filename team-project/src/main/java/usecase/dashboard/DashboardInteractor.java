package usecase.dashboard;

import entity.Task;
import java.util.List;

public class DashboardInteractor implements DashboardInputBoundary {

    private final DashboardDataAccessInterface dashboardDataAccessObject;
    private final DashboardOutputBoundary dashboardPresenter;

    public DashboardInteractor(DashboardDataAccessInterface dashboardDataAccessObject,
                               DashboardOutputBoundary dashboardPresenter) {
        this.dashboardDataAccessObject = dashboardDataAccessObject;
        this.dashboardPresenter = dashboardPresenter;
    }

    @Override
    public void execute() {
        List<Task> allTasks = dashboardDataAccessObject.getAllTasks();

        List<Task> sorted = allTasks.stream()
                .filter(t -> !t.isCompleted() && t.getDate() != null)
                .sorted((a, b) -> a.getDate().compareTo(b.getDate()))
                .toList();

        List<Task> top3 = sorted.size() > 3 ? sorted.subList(0, 3) : sorted;

        DashboardOutputData outputData = new DashboardOutputData(top3);
        dashboardPresenter.prepareSuccessView(outputData);
    }
}