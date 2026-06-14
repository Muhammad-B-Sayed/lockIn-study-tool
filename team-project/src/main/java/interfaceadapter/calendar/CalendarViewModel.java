package interfaceadapter.calendar;

import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import java.time.LocalDate;
import java.util.List;

import entity.Event;
import usecase.calendar.CalendarRepository;

public class CalendarViewModel {
    public static final String EVENTS_CHANGED = "eventsChanged";

    private final PropertyChangeSupport pcs = new PropertyChangeSupport(this);
    private final CalendarRepository repo;

    public CalendarViewModel(CalendarRepository repo) {
        this.repo = repo;
    }

    public List<Event> eventsOn(LocalDate date) { return repo.eventsOn(date); }

    public void markCompleted(String name, LocalDate date) {
        repo.markCompleted(name, date);
        fireEventsChanged();
    }

    public void fireEventsChanged() {
        pcs.firePropertyChange(EVENTS_CHANGED, null, null);
    }

    public void clearAll() {
        repo.clear();
        fireEventsChanged();
    }

    public void addPropertyChangeListener(PropertyChangeListener l) {
        pcs.addPropertyChangeListener(l);
    }

    public static final String VIEW_CALENDAR = "viewCalendar";

    public void fireViewCalendar() {
        pcs.firePropertyChange(VIEW_CALENDAR, null, null);
    }

}
