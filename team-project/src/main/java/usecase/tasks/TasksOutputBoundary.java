package usecase.tasks;

public interface TasksOutputBoundary {

    void prepareSuccessView(TasksOutputData response);

    void prepareFailView(String errorMessage);
}
