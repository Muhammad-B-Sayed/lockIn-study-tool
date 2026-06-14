package usecase.calendar;

import entity.Event;

public class AddEventInteractor implements AddEventInputBoundary {
    private final CalendarRepository repo;
    private final AddEventOutputBoundary presenter;

    public AddEventInteractor(CalendarRepository repo, AddEventOutputBoundary presenter) {
        this.repo = repo;
        this.presenter = presenter;
    }

    @Override
    public void add(AddEventInputData input) {
        if (input.name == null || input.name.isBlank()) {
            presenter.present(new AddEventOutputData(false, "Event name cannot be empty."));
            return;
        }
        repo.add(new Event(input.name, input.date, input.color));
        presenter.present(new AddEventOutputData(true, "Event added."));
    }
}
