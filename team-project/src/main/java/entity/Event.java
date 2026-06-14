package entity;

import java.awt.*;
import java.time.LocalDate;

public class Event {
    private final String name;
    private final LocalDate date;
    private final Color color;
    private boolean completed;

    public Event(String name, LocalDate date, Color color) {
        this.name = name;
        this.date = date;
        this.color = color;
        this.completed = false;
    }

    public String getName() { return name; }
    public LocalDate getDate() { return date; }
    public Color getColor() { return color; }
    public boolean isCompleted() { return completed; }
    public void setCompleted(boolean completed) { this.completed = completed; }
}
