package usecase.dashboard;

import entity.Task;
import java.util.List;

public class DashboardOutputData {
    private final List<Task> tasks;

    public DashboardOutputData(List<Task> tasks) {
        this.tasks = tasks;
    }

    public List<Task> getTasks() {
        return tasks;
    }
}