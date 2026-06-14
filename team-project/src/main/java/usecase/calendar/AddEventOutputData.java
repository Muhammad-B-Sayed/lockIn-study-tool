package usecase.calendar;

public class AddEventOutputData {
    public final boolean success;
    public final String message;

    public AddEventOutputData(boolean success, String message) {
        this.success = success;
        this.message = message;
    }
}
