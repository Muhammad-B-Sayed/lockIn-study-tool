package use_case.sync_task;

import entity.Task;
import interfaceadapter.calendar.CalendarController;
import org.junit.jupiter.api.Test;
import usecase.sync_task.SyncTaskToCalendarInteractor;
import usecase.sync_task.SyncTaskToCalendarOutputBoundary;

import java.awt.*;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class SyncTaskToCalendarInteractorTest {

    @Test
    void testSyncTaskCreatesCorrectEvent() {
        TestCalendarController controller = new TestCalendarController();
        TestPresenter presenter = new TestPresenter();

        SyncTaskToCalendarInteractor interactor =
                new SyncTaskToCalendarInteractor(controller, presenter);

        Task task = new Task(
                1,
                "Math Assignment",
                "Do chapter 4",
                LocalDate.of(2025, 3, 15),
                "assignment"
        );

        interactor.sync(task);

        assertTrue(controller.called, "CalendarController.addEvent must be called.");
        assertEquals("Math Assignment", controller.name);
        assertEquals(LocalDate.of(2025, 3, 15), controller.date);
        assertEquals(Color.BLUE, controller.color);  // assignment → BLUE

        assertTrue(presenter.called, "presenter.present() must be called.");
    }

    private static class TestCalendarController extends CalendarController {
        boolean called = false;
        String name;
        LocalDate date;
        Color color;

        public TestCalendarController() {
            super(null, null); // not used in test
        }

        @Override
        public void addEvent(String name, LocalDate date, Color color) {
            this.called = true;
            this.name = name;
            this.date = date;
            this.color = color;
        }
    }

    private static class TestPresenter implements SyncTaskToCalendarOutputBoundary {
        boolean called = false;

        @Override
        public void present() {
            called = true;
        }
    }
}
