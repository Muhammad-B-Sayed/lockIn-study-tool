package usecase.sync_task;

import entity.Task;

public interface SyncTaskToCalendarInputBoundary {
    void sync(Task task);
}
