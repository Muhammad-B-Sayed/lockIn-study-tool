package interfaceadapter.tasks;

import entity.Task;
import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import java.util.List;

public class TasksViewModel {

    private final PropertyChangeSupport support = new PropertyChangeSupport(this);
    private List<Task> tasks;

    public List<Task> getTasks() {
        return tasks;
    }

    public void setTasks(List<Task> tasks) {
        this.tasks = tasks;
    }

    public void addPropertyChangeListener(PropertyChangeListener listener) {
        support.addPropertyChangeListener(listener);
    }

    public void firePropertyChanged() {
        support.firePropertyChange("tasks", null, tasks);
    }

    public void setError(String error) {

    }
}
