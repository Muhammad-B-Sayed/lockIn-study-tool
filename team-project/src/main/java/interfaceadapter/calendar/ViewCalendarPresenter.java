package interfaceadapter.calendar;

import usecase.calendar.ViewCalendarOutputBoundary;
import usecase.calendar.ViewCalendarOutputData;

public class ViewCalendarPresenter implements ViewCalendarOutputBoundary {

    private final CalendarViewModel viewModel;

    public ViewCalendarPresenter(CalendarViewModel vm) {
        this.viewModel = vm;
    }

    @Override
    public void prepareSuccessView(ViewCalendarOutputData data) {
        viewModel.fireViewCalendar();
    }
}
