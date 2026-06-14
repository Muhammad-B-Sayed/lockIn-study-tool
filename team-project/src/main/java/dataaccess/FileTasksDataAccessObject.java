package dataaccess;

import entity.Task;
import usecase.dashboard.DashboardDataAccessInterface;
import usecase.tasks.TasksDataAccessInterface;

import java.io.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class FileTasksDataAccessObject implements TasksDataAccessInterface, DashboardDataAccessInterface {

    private static final String HEADER = "id|title|description|date|course|completed|type|username";
    private static final String DELIMITER = "|";
    private static final String SPLIT_REGEX = "\\|";

    private final File dataFile;
    private String currentUsername = "";

    public FileTasksDataAccessObject(String filePath) {
        dataFile = new File(filePath);
        if (!dataFile.exists() || dataFile.length() == 0) {
            writeHeader();
        }
    }

    @Override
    public void setCurrentUsername(String username) {
        this.currentUsername = username;
    }

    @Override
    public List<Task> getAllTasks() {
        List<Task> result = new ArrayList<>();
        if (currentUsername.isEmpty()) return result;

        try (BufferedReader reader = new BufferedReader(new FileReader(dataFile))) {
            reader.readLine(); // skip header
            String row;
            while ((row = reader.readLine()) != null) {
                if (row.trim().isEmpty()) continue;
                String[] cols = row.split(SPLIT_REGEX, 8);
                if (cols.length < 8 || !cols[7].equals(currentUsername)) continue;

                Task task = new Task(
                        Integer.parseInt(cols[0]),
                        cols[1],
                        cols[2],
                        LocalDate.parse(cols[3]),
                        cols[4]
                );
                task.setCompleted(Boolean.parseBoolean(cols[5]));
                task.setType(cols[6]);
                result.add(task);
            }
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }
        return result;
    }

    @Override
    public void addTask(Task task) {
        try (BufferedWriter writer = new BufferedWriter(new FileWriter(dataFile, true))) {
            writer.write(toRow(task));
            writer.newLine();
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }
    }

    @Override
    public void removeTask(Task task) {
        rewriteExcluding(task.getId());
    }

    @Override
    public void updateTask(Task task) {
        rewriteExcluding(task.getId());
        addTask(task);
    }

    @Override
    public void deleteAllTasksForUser(String username) {
        List<String> lines = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new FileReader(dataFile))) {
            lines.add(reader.readLine()); // keep header
            String row;
            while ((row = reader.readLine()) != null) {
                if (row.trim().isEmpty()) continue;
                String[] cols = row.split(SPLIT_REGEX, 8);
                if (cols.length >= 8 && cols[7].equals(username)) continue;
                lines.add(row);
            }
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }
        try (BufferedWriter writer = new BufferedWriter(new FileWriter(dataFile))) {
            for (String line : lines) {
                writer.write(line);
                writer.newLine();
            }
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }
    }

    private void rewriteExcluding(int excludeId) {
        List<String> lines = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new FileReader(dataFile))) {
            lines.add(reader.readLine()); // keep header
            String row;
            while ((row = reader.readLine()) != null) {
                if (row.trim().isEmpty()) continue;
                String[] cols = row.split(SPLIT_REGEX, 2);
                if (cols.length < 1 || cols[0].equals(String.valueOf(excludeId))) continue;
                lines.add(row);
            }
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }

        try (BufferedWriter writer = new BufferedWriter(new FileWriter(dataFile))) {
            for (String line : lines) {
                writer.write(line);
                writer.newLine();
            }
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }
    }

    private String toRow(Task task) {
        return String.join(DELIMITER,
                String.valueOf(task.getId()),
                sanitize(task.getTitle()),
                sanitize(task.getDescription()),
                task.getDate().toString(),
                sanitize(task.getCourse()),
                String.valueOf(task.isCompleted()),
                sanitize(task.getType()),
                sanitize(currentUsername)
        );
    }

    private String sanitize(String value) {
        return value == null ? "" : value.replace("|", " ");
    }

    private void writeHeader() {
        try (BufferedWriter writer = new BufferedWriter(new FileWriter(dataFile))) {
            writer.write(HEADER);
            writer.newLine();
        } catch (IOException ex) {
            throw new RuntimeException(ex);
        }
    }
}
