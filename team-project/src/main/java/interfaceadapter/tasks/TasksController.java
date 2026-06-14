package interfaceadapter.tasks;

import usecase.tasks.TasksInputBoundary;
import usecase.tasks.TasksInputData;

public class TasksController {

    private final TasksInputBoundary interactor;

    public TasksController(TasksInputBoundary interactor) {
        this.interactor = interactor;
    }

    public void loadTasks() {
        interactor.execute(new TasksInputData());
    }
}
