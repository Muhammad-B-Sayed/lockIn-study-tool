package use_case.dashboard;

import entity.Task;
import org.junit.jupiter.api.Test;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import usecase.dashboard.DashboardInteractor;
import usecase.dashboard.DashboardOutputBoundary;
import usecase.dashboard.DashboardDataAccessInterface;
import usecase.dashboard.DashboardOutputData;

import static org.junit.jupiter.api.Assertions.*;

class DashboardInteractorTest {

    private static class MockDataAccessStub implements DashboardDataAccessInterface {
        private final List<Task> tasks;

        public MockDataAccessStub(List<Task> tasks) {
            this.tasks = tasks;
        }

        @Override
        public List<Task> getAllTasks() {
            return tasks;
        }
    }

    private static class PresenterSpy implements DashboardOutputBoundary {
        DashboardOutputData receivedData = null;

        @Override
        public void prepareSuccessView(DashboardOutputData data) {
            receivedData = data;
        }
    }

    @Test
    void testExecute_BusinessLogic_FiltersSortsAndLimits() {
        LocalDate today = LocalDate.now();

        Task taskA = new Task(1, "A", "Desc", today, "CSC207");

        Task taskB = new Task(2, "B", "Desc", today.plusDays(1), "CSC207");

        Task taskC = new Task(3, "C", "Desc", today.plusDays(2), "CSC207");

        Task taskD = new Task(4, "D", "Desc", today.plusDays(3), "CSC207");

        Task taskCompleted = new Task(5, "Completed", "Desc", today.minusDays(1), "CSC207");
        taskCompleted.setCompleted(true);

        Task taskNoDate = new Task(6, "NoDate", "Desc", null, "CSC207");

        List<Task> rawTasks = Arrays.asList(taskD, taskCompleted, taskA, taskNoDate, taskC, taskB);

        MockDataAccessStub dao = new MockDataAccessStub(rawTasks);
        PresenterSpy presenter = new PresenterSpy();
        DashboardInteractor interactor = new DashboardInteractor(dao, presenter);

        interactor.execute();

        assertNotNull(presenter.receivedData, "Presenter should have received data");
        List<Task> results = presenter.receivedData.getTasks();

        assertEquals(3, results.size(), "Should limit results to exactly 3 tasks");

        assertEquals(taskA, results.get(0), "1st task should be Task A (Earliest)");
        assertEquals(taskB, results.get(1), "2nd task should be Task B");
        assertEquals(taskC, results.get(2), "3rd task should be Task C");

        assertFalse(results.contains(taskCompleted), "Should not show completed tasks");
        assertFalse(results.contains(taskNoDate), "Should not show tasks with no due date");
        assertFalse(results.contains(taskD), "Should not show the 4th task (Limit reached)");
    }

    @Test
    void testExecute_EmptyData() {
        MockDataAccessStub dao = new MockDataAccessStub(new ArrayList<>());
        PresenterSpy presenter = new PresenterSpy();
        DashboardInteractor interactor = new DashboardInteractor(dao, presenter);

        interactor.execute();

        assertNotNull(presenter.receivedData);
        assertTrue(presenter.receivedData.getTasks().isEmpty(), "Result should be empty list if DB is empty");
    }

    @Test
    void testExecute_LessThanLimit() {
        Task task1 = new Task(1, "1", "Desc", LocalDate.now(), "C");
        Task task2 = new Task(2, "2", "Desc", LocalDate.now().plusDays(1), "C");

        MockDataAccessStub dao = new MockDataAccessStub(List.of(task2, task1));
        PresenterSpy presenter = new PresenterSpy();
        DashboardInteractor interactor = new DashboardInteractor(dao, presenter);

        interactor.execute();

        List<Task> results = presenter.receivedData.getTasks();
        assertEquals(2, results.size(), "Should return all tasks if count < 3");
        assertEquals(task1, results.get(0), "Should still sort them correctly");
        assertEquals(task2, results.get(1));
    }
}