package usecase.tasks;

import entity.Task;
import java.util.List;

public class TasksOutputData {

    private final List<Task> tasks;

    public TasksOutputData(List<Task> tasks) {
        this.tasks = tasks;
    }

    public List<Task> getTasks() {
        return tasks;
    }
}
