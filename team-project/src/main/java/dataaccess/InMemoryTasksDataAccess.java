package dataaccess;

import entity.Task;
import usecase.dashboard.DashboardDataAccessInterface;
import usecase.tasks.TasksDataAccessInterface;

import java.util.ArrayList;
import java.util.List;

public class InMemoryTasksDataAccess implements TasksDataAccessInterface, DashboardDataAccessInterface {

    private final List<Task> tasks = new ArrayList<>();

    @Override
    public void setCurrentUsername(String username) {}

    @Override
    public List<Task> getAllTasks() {
        return new ArrayList<>(tasks);
    }

    // Extra helpers for the UI (TasksPanel):

    public void addTask(Task task) {
        tasks.add(task);
    }

    public void removeTask(Task task) {
        tasks.remove(task);
    }

    public void updateTask(Task updatedTask) {
        for (int i = 0; i < tasks.size(); i++) {
            if (tasks.get(i).getId() == updatedTask.getId()) {
                tasks.set(i, updatedTask);
                return;
            }
        }
    }
}
