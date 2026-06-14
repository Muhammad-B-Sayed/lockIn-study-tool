package usecase.dashboard;

import entity.Task;
import java.util.List;

public interface DashboardDataAccessInterface {
    List<Task> getAllTasks();
}