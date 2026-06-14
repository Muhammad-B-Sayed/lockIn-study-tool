package usecase.calendar;

import java.awt.*;
import java.time.LocalDate;

public class AddEventInputData {
    public final String name;
    public final LocalDate date;
    public final Color color;

    public AddEventInputData(String name, LocalDate date, Color color) {
        this.name = name;
        this.date = date;
        this.color = color;
    }
}
