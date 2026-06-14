package usecase.calendar;

public class ViewCalendarInteractor implements ViewCalendarInputBoundary {

    private final ViewCalendarOutputBoundary presenter;

    public ViewCalendarInteractor(ViewCalendarOutputBoundary presenter) {
        this.presenter = presenter;
    }

    @Override
    public void viewCalendar(ViewCalendarInputData inputData) {
        ViewCalendarOutputData outputData = new ViewCalendarOutputData();
        presenter.prepareSuccessView(outputData);
    }
}
