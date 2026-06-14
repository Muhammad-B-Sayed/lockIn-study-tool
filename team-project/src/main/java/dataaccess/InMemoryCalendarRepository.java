package dataaccess;

import entity.Event;
import usecase.calendar.CalendarRepository;

import java.time.LocalDate;
import java.util.*;

public class InMemoryCalendarRepository implements CalendarRepository {
    private final Map<LocalDate, List<Event>> byDay = new HashMap<>();

    @Override
    public void add(Event e) {
        byDay.computeIfAbsent(e.getDate(), k -> new ArrayList<>()).add(e);
    }

    @Override
    public List<Event> eventsOn(LocalDate date) {
        return Collections.unmodifiableList(byDay.getOrDefault(date, Collections.emptyList()));
    }

    @Override
    public void clear() {
        byDay.clear();
    }

    @Override
    public void markCompleted(String name, LocalDate date) {
        for (Event e : byDay.getOrDefault(date, Collections.emptyList())) {
            if (e.getName().equals(name)) {
                e.setCompleted(true);
            }
        }
    }
}
