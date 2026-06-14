package interfaceadapter.calendar;

import java.awt.Color;
import java.time.LocalDate;

import usecase.calendar.AddEventInputBoundary;
import usecase.calendar.AddEventInputData;
import usecase.calendar.ViewCalendarInputBoundary;
import usecase.calendar.ViewCalendarInputData;

public class CalendarController {

    private final AddEventInputBoundary addEventUseCase;
    private final ViewCalendarInputBoundary viewCalendarUseCase;

    public CalendarController(AddEventInputBoundary addEventUseCase,
                              ViewCalendarInputBoundary viewCalendarUseCase) {
        this.addEventUseCase = addEventUseCase;
        this.viewCalendarUseCase = viewCalendarUseCase;
    }

    public void addEvent(String name, LocalDate date, Color color) {
        AddEventInputData data = new AddEventInputData(name, date, color);
        addEventUseCase.add(data);
    }

    public void viewCalendar() {
        ViewCalendarInputData data = new ViewCalendarInputData();
        viewCalendarUseCase.viewCalendar(data);
    }
}
