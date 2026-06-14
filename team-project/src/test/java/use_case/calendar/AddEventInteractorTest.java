package use_case.calendar;

import entity.Event;
import org.junit.jupiter.api.Test;
import usecase.calendar.*;

import java.awt.*;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;

class AddEventInteractorTest {

    @Test
    void testAddEventSuccess() {
        TestRepo repo = new TestRepo();
        TestPresenter presenter = new TestPresenter();
        AddEventInteractor interactor = new AddEventInteractor(repo, presenter);

        AddEventInputData input = new AddEventInputData(
                "Example Event",
                LocalDate.of(2025, 3, 10),
                Color.BLUE
        );

        interactor.add(input);

        assertEquals(1, repo.added.size());
        assertTrue(presenter.success);
        assertEquals("Event added.", presenter.message);
    }

    @Test
    void testAddEventFailsWhenNameBlank() {
        TestRepo repo = new TestRepo();
        TestPresenter presenter = new TestPresenter();
        AddEventInteractor interactor = new AddEventInteractor(repo, presenter);

        AddEventInputData input = new AddEventInputData(
                "",
                LocalDate.of(2025, 3, 10),
                Color.BLUE
        );

        interactor.add(input);

        assertEquals(0, repo.added.size());
        assertFalse(presenter.success);
        assertEquals("Event name cannot be empty.", presenter.message);
    }


    static class TestRepo implements CalendarRepository {
        java.util.List<Event> added = new java.util.ArrayList<>();

        @Override
        public void add(Event event) {
            added.add(event);
        }

        @Override
        public java.util.List<Event> eventsOn(LocalDate date) {
            return added;
        }

        @Override
        public void clear() {
            added.clear();
        }

        @Override
        public void markCompleted(String name, LocalDate date) {
            // Not needed for these tests.
        }
    }

    static class TestPresenter implements AddEventOutputBoundary {
        boolean success;
        String message;

        @Override
        public void present(AddEventOutputData data) {
            this.success = data.success;
            this.message = data.message;
        }
    }
}
