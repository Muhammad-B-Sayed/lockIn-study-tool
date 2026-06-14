package usecase.sync_task;

import entity.Task;
import interfaceadapter.calendar.CalendarController;

import java.awt.*;

public class SyncTaskToCalendarInteractor implements SyncTaskToCalendarInputBoundary {

    private final CalendarController calendarController;
    private final SyncTaskToCalendarOutputBoundary presenter;

    public SyncTaskToCalendarInteractor(CalendarController controller,
                                        SyncTaskToCalendarOutputBoundary presenter) {
        this.calendarController = controller;
        this.presenter = presenter;
    }

    @Override
    public void sync(Task task) {
        String name = task.getTitle();
        java.time.LocalDate date = task.getDate();
        Color color = Color.BLUE;

        calendarController.addEvent(name, date, color);

        presenter.present();
    }
}
