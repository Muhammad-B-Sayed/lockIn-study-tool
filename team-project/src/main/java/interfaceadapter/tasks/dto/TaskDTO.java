package interfaceadapter.tasks.dto;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

public class TaskDTO {

    private final String taskName;
    private final String course;
    private final String description;
    private final String formattedDueDate;
    private final String dueInText;
    private final boolean completed;

    /**
     * Constructs a TaskDTO for the UI.
     *
     * @param taskName         Name/title of the task
     * @param course           Course name
     * @param description      Task description
     * @param dueDate          Task due date (can be null)
     * @param completed        Completion status
     */
    public TaskDTO(String taskName, String course, String description, LocalDate dueDate, boolean completed) {
        this.taskName = taskName;
        this.course = course;
        this.description = description;
        this.completed = completed;

        if (dueDate != null) {
            this.formattedDueDate = dueDate.format(java.time.format.DateTimeFormatter.ofPattern("MMM dd"));
            long daysLeft = ChronoUnit.DAYS.between(LocalDate.now(), dueDate);
            if (daysLeft < 0) {
                this.dueInText = "Overdue";
            } else if (daysLeft == 0) {
                this.dueInText = "Due Today";
            } else if (daysLeft == 1) {
                this.dueInText = "Due in 1 day";
            } else {
                this.dueInText = "Due in " + daysLeft + " days";
            }
        } else {
            this.formattedDueDate = "No date";
            this.dueInText = "No due date";
        }
    }

    public String getTaskName() {
        return taskName;
    }

    public String getCourse() {
        return course;
    }

    public String getDescription() {
        return description;
    }

    public String getFormattedDueDate() {
        return formattedDueDate;
    }

    public String getDueInText() {
        return dueInText;
    }

    public boolean isCompleted() {
        return completed;
    }
}
