package interfaceadapter.calendar;

import usecase.calendar.AddEventOutputBoundary;
import usecase.calendar.AddEventOutputData;

public class AddEventPresenter implements AddEventOutputBoundary {
    private final CalendarViewModel viewModel;

    public AddEventPresenter(CalendarViewModel viewModel) {
        this.viewModel = viewModel;
    }

    @Override
    public void present(AddEventOutputData output) {
        viewModel.fireEventsChanged();
    }
}
