package interfaceadapter.tasks.dto;

import java.util.List;

public class CourseDTO {

    private final String courseName;
    private final List<TaskDTO> tasks;

    public CourseDTO(String courseName, List<TaskDTO> tasks) {
        this.courseName = courseName;
        this.tasks = tasks;
    }

    public String getCourseName() {
        return courseName;
    }

    public List<TaskDTO> getTasks() {
        return tasks;
    }
}
