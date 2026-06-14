package interfaceadapter.dashboard;

import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import java.util.List;

import interfaceadapter.tasks.dto.TaskDTO;

public class DashboardViewModel {

    private final PropertyChangeSupport support = new PropertyChangeSupport(this);

    // State 1: Due Soon Tasks
    private List<TaskDTO> dueSoonTaskDTOs;

    // State 2: Stopwatch Text
    private String stopwatchText = "00:00:00";

    public void setDueSoonTasks(List<TaskDTO> taskDTOs) {
        List<TaskDTO> oldDTOs = this.dueSoonTaskDTOs;
        this.dueSoonTaskDTOs = taskDTOs;
        support.firePropertyChange("dueSoonTasks", oldDTOs, taskDTOs);
    }

    public List<TaskDTO> getDueSoonTasks() {
        return dueSoonTaskDTOs;
    }

    public void setStopwatchText(String stopwatchText) {
        String oldText = this.stopwatchText;
        this.stopwatchText = stopwatchText;
        support.firePropertyChange("stopwatchText", oldText, stopwatchText);
    }

    public String getStopwatchText() {
        return stopwatchText;
    }

    public void addPropertyChangeListener(PropertyChangeListener listener) {
        support.addPropertyChangeListener(listener);
    }

    public void removePropertyChangeListener(PropertyChangeListener listener) {
        support.removePropertyChangeListener(listener);
    }
}
