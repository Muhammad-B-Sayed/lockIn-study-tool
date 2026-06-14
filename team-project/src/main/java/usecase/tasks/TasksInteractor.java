package usecase.tasks;

public class TasksInteractor implements TasksInputBoundary {

    private final TasksDataAccessInterface tasksDataAccess;
    private final TasksOutputBoundary tasksPresenter;

    public TasksInteractor(TasksDataAccessInterface tasksDataAccess, TasksOutputBoundary tasksPresenter) {
        this.tasksDataAccess = tasksDataAccess;
        this.tasksPresenter = tasksPresenter;
    }

    @Override
    public void execute(TasksInputData inputData) {
        try {
            var tasks = tasksDataAccess.getAllTasks();

            TasksOutputData outputData = new TasksOutputData(tasks);

            tasksPresenter.prepareSuccessView(outputData);

        } catch (Exception e) {
            tasksPresenter.prepareFailView("Failed to load tasks.");
        }
    }
}

