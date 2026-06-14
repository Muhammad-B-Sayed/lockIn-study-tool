package use_case.tasks;

import entity.Task;
import org.junit.jupiter.api.Test;
import usecase.tasks.TasksDataAccessInterface;
import usecase.tasks.TasksInteractor;
import usecase.tasks.TasksOutputBoundary;
import usecase.tasks.TasksOutputData;
import usecase.tasks.TasksInputData;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class TasksInteractorTest {

    // Mock Data Access that behaves normally
    private static class MockSuccessDataAccess implements TasksDataAccessInterface {
        @Override
        public List<Task> getAllTasks() {
            return List.of(new Task(1, "Test", "Desc", LocalDate.now(), "CSC"));
        }
        @Override public void addTask(Task task) {}
        @Override public void updateTask(Task task) {}
        @Override public void removeTask(Task task) {}
    }

    // Mock Data Access that throws an error
    private static class MockFailDataAccess implements TasksDataAccessInterface {
        @Override
        public List<Task> getAllTasks() {
            throw new RuntimeException("Error");
        }
        @Override
        public void addTask(Task task) {}
        @Override
        public void updateTask(Task task) {}
        @Override
        public void removeTask(Task task) {}
    }

    // Presenter spy to record what was called
    private static class PresenterSpy implements TasksOutputBoundary {
        boolean successCalled = false;
        boolean failCalled = false;
        TasksOutputData receivedData = null;
        String errorMessage = null;

        @Override
        public void prepareSuccessView(TasksOutputData outputData) {
            successCalled = true;
            receivedData = outputData;
        }

        @Override
        public void prepareFailView(String error) {
            failCalled = true;
            errorMessage = error;
        }
    }

    @Test
    void testInteractorSuccess() {
        PresenterSpy presenter = new PresenterSpy();
        TasksInteractor interactor =
                new TasksInteractor(new MockSuccessDataAccess(), presenter);

        interactor.execute(new TasksInputData());

        assertTrue(presenter.successCalled);
        assertNotNull(presenter.receivedData);
        assertFalse(presenter.failCalled);
    }

    @Test
    void testInteractorFailure() {
        PresenterSpy presenter = new PresenterSpy();
        TasksInteractor interactor =
                new TasksInteractor(new MockFailDataAccess(), presenter);

        interactor.execute(new TasksInputData());

        assertTrue(presenter.failCalled);
        assertFalse(presenter.successCalled);
        assertEquals("Failed to load tasks.", presenter.errorMessage);
    }
}
