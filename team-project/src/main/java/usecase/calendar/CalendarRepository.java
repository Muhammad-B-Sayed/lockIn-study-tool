package usecase.calendar;

import entity.Event;
import java.time.LocalDate;
import java.util.List;

public interface CalendarRepository {
    void add(Event e);
    List<Event> eventsOn(LocalDate date);
    void clear();
    void markCompleted(String name, LocalDate date);
}
