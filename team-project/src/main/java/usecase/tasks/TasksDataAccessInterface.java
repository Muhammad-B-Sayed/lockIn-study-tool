package usecase.tasks;

import entity.Task;
import java.util.List;

public interface TasksDataAccessInterface {
    List<Task> getAllTasks();

    void addTask(Task task);

    void updateTask(Task task);

    void removeTask(Task task);

    default void setCurrentUsername(String username) {}

    default void deleteAllTasksForUser(String username) {}
}
