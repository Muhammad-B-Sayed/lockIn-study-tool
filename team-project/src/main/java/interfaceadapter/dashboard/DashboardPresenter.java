package interfaceadapter.dashboard;

import interfaceadapter.tasks.dto.TaskDTO;
import usecase.dashboard.DashboardOutputBoundary;
import usecase.dashboard.DashboardOutputData;

import java.util.List;

public class DashboardPresenter implements DashboardOutputBoundary {

    private final DashboardViewModel dashboardViewModel;

    public DashboardPresenter(DashboardViewModel dashboardViewModel) {
        this.dashboardViewModel = dashboardViewModel;
    }

    @Override
    public void prepareSuccessView(DashboardOutputData response) {
        List<TaskDTO> dtos = response.getTasks().stream()
                .map(t -> new TaskDTO(
                        t.getTitle(),
                        t.getCourse(),
                        t.getDescription(),
                        t.getDate(),
                        t.isCompleted()
                ))
                .toList();

        dashboardViewModel.setDueSoonTasks(dtos);
    }
}