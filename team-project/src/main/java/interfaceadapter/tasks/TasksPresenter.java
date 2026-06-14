package interfaceadapter.tasks;

import usecase.tasks.TasksOutputBoundary;
import usecase.tasks.TasksOutputData;

public class TasksPresenter implements TasksOutputBoundary {

    private final TasksViewModel viewModel;

    public TasksPresenter(TasksViewModel viewModel) {
        this.viewModel = viewModel;
    }

    @Override
    public void prepareSuccessView(TasksOutputData response) {
        viewModel.setTasks(response.getTasks());
    }

    @Override
    public void prepareFailView(String error) {
        viewModel.setError(error);
    }
}
