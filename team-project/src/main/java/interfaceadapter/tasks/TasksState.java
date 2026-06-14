package interfaceadapter.tasks;

import interfaceadapter.tasks.dto.CourseDTO;

import java.util.ArrayList;
import java.util.List;

public class TasksState {

    private List<CourseDTO> courses = new ArrayList<>();

    public List<CourseDTO> getCourses() {
        return courses;
    }

    public void setCourses(List<CourseDTO> courses) {
        this.courses = courses;
    }
}
