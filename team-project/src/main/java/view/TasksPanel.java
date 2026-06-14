package view;

import usecase.tasks.TasksDataAccessInterface;
import entity.Task;
import interfaceadapter.dashboard.DashboardController;
import interfaceadapter.dashboard.DashboardViewModel;

import javax.swing.*;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public class TasksPanel extends JPanel {

    private JTable taskTable;
    private DefaultTableModel tableModel;
    private JButton addTaskBtn, deleteTaskBtn;

    private final TasksDataAccessInterface tasksDataAccess;
    private List<Task> allTasks;
    private List<Task> originalOrder = new ArrayList<>();
    private String sortState = "NONE"; // "NONE", "DATE", "COURSE"

    private final DashboardViewModel dashboardViewModel;
    private final DashboardController dashboardController; // 1. Added Controller Dependency

    public static interfaceadapter.sync_task.SyncTaskToCalendarController syncController;

    public TasksPanel(DashboardViewModel dashboardViewModel,
                      DashboardController dashboardController,
                      TasksDataAccessInterface tasksDataAccess) {

        this.dashboardViewModel = dashboardViewModel;
        this.dashboardController = dashboardController;
        this.tasksDataAccess = tasksDataAccess;

        // Shared task list
        this.allTasks = tasksDataAccess.getAllTasks();

        // Colours
        Color panelDark       = new Color(0xFAF8F5);
        Color tableBackground = new Color(0xFFFFFF);
        Color tableHeader     = new Color(0xF0EBE4);
        Color textLight       = new Color(0x1C1917);
        Color textSec         = new Color(0x78716C);
        Color accent          = new Color(0x3B82F6);
        Color danger          = new Color(0xDC2626);
        Color dangerHover     = new Color(0xB91C1C);

        setLayout(new BorderLayout());
        setBackground(panelDark);

        // Titles
        JLabel title = new JLabel("Task Manager", SwingConstants.CENTER);
        title.setFont(new Font("Helvetica Neue",Font.BOLD, 30));
        title.setForeground(textLight);
        title.setBorder(BorderFactory.createEmptyBorder(15, 0, 15, 0));
        add(title, BorderLayout.NORTH);

        // Table
        String[] columnNames = {"Task", "Course", "Due Date", "Status"};

        tableModel = new DefaultTableModel(columnNames, 0) {
            @Override
            public boolean isCellEditable(int row, int col) {
                return false;
            }
        };

        taskTable = new JTable(tableModel);
        taskTable.setFillsViewportHeight(true);
        taskTable.setRowHeight(30);

        taskTable.setBackground(tableBackground);
        taskTable.setForeground(textLight);
        taskTable.setFont(new Font("Helvetica Neue",Font.PLAIN, 16));
        taskTable.setGridColor(panelDark);

        taskTable.getTableHeader().setFont(new Font("Helvetica Neue",Font.BOLD, 17));
        taskTable.getTableHeader().setBackground(tableHeader);
        taskTable.getTableHeader().setForeground(textLight);
        taskTable.getTableHeader().setReorderingAllowed(false);

        JScrollPane scrollPane = new JScrollPane(taskTable);
        scrollPane.getViewport().setBackground(panelDark);
        scrollPane.setBorder(null);
        add(scrollPane, BorderLayout.CENTER);

        // Add, delete, and sort buttons
        addTaskBtn = new JButton("+ Add Task");
        addTaskBtn.setFont(new Font("Helvetica Neue",Font.BOLD, 17));
        addTaskBtn.setForeground(Color.WHITE);
        addTaskBtn.setBackground(accent);
        addTaskBtn.setOpaque(true);
        addTaskBtn.setBorderPainted(false);
        addTaskBtn.setFocusPainted(false);

        deleteTaskBtn = new JButton("Delete Task");
        deleteTaskBtn.setFont(new Font("Helvetica Neue", Font.BOLD, 17));
        deleteTaskBtn.setForeground(Color.WHITE);
        deleteTaskBtn.setBackground(danger);
        deleteTaskBtn.setContentAreaFilled(true);
        deleteTaskBtn.setOpaque(true);
        deleteTaskBtn.setBorderPainted(false);
        deleteTaskBtn.setFocusPainted(false);
        deleteTaskBtn.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        deleteTaskBtn.addMouseListener(new MouseAdapter() {
            public void mouseEntered(MouseEvent e) { deleteTaskBtn.setBackground(dangerHover); }
            public void mouseExited(MouseEvent e)  { deleteTaskBtn.setBackground(danger); }
        });

        JButton sortByDateBtn = new JButton("Sort by Date");
        styleSortButton(sortByDateBtn, textSec);

        JButton sortByCourseBtn = new JButton("Sort by Course");
        styleSortButton(sortByCourseBtn, textSec);

        JPanel btnWrapper = new JPanel();
        btnWrapper.setBackground(panelDark);
        btnWrapper.add(addTaskBtn);
        btnWrapper.add(deleteTaskBtn);
        btnWrapper.add(sortByDateBtn);
        btnWrapper.add(sortByCourseBtn);
        add(btnWrapper, BorderLayout.SOUTH);

        // Actions

        // Add new task
        addTaskBtn.addActionListener(e -> openTaskPopup(null));

        // Delete selected task
        deleteTaskBtn.addActionListener(e -> deleteSelectedTask());

        // Sort by date — second click restores original order
        sortByDateBtn.addActionListener(e -> {
            if ("DATE".equals(sortState)) {
                allTasks = new ArrayList<>(originalOrder);
                sortState = "NONE";
            } else {
                allTasks.sort(Comparator.comparing(Task::getDate,
                        Comparator.nullsLast(Comparator.naturalOrder())));
                sortState = "DATE";
            }
            refreshTable(false);
        });

        // Sort by course — second click restores original order
        sortByCourseBtn.addActionListener(e -> {
            if ("COURSE".equals(sortState)) {
                allTasks = new ArrayList<>(originalOrder);
                sortState = "NONE";
            } else {
                allTasks.sort(Comparator.comparing(Task::getCourse,
                        Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)));
                sortState = "COURSE";
            }
            refreshTable(false);
        });

        // Double-click to edit
        taskTable.addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                if (e.getClickCount() == 2 && taskTable.getSelectedRow() != -1) {
                    openTaskPopup(allTasks.get(taskTable.getSelectedRow()));
                }
            }
        });


        refreshTable(true);
    }

    public void refresh() {
        refreshTable(true);
    }

    private void refreshTable(boolean reloadFromRepo) {
        tableModel.setRowCount(0);

        if (reloadFromRepo) {
            allTasks = tasksDataAccess.getAllTasks();
            originalOrder = new ArrayList<>(allTasks);
            sortState = "NONE";
        }

        for (Task t : allTasks) {
            tableModel.addRow(new Object[]{
                    t.getTitle(),
                    t.getCourse(),
                    t.getDate(),
                    t.isCompleted() ? "Done" : "Not started"
            });
        }
    }

    private void deleteSelectedTask() {
        int selectedRow = taskTable.getSelectedRow();
        if (selectedRow == -1) {
            JOptionPane.showMessageDialog(this, "Please select a task first.");
            return;
        }

        Task task = allTasks.get(selectedRow);
        tasksDataAccess.removeTask(task);


        refreshTable(true);

        dashboardController.execute();
    }

    private void openTaskPopup(Task taskToEdit) {
        boolean editing = (taskToEdit != null);

        JDialog popup = new JDialog((Frame) null,
                editing ? "Edit Task" : "Add New Task",
                true);
        popup.setSize(420, 450);
        popup.setLocationRelativeTo(null);
        popup.setLayout(new BorderLayout());

        Color panelDark = new Color(0xFAF8F5);
        Color fieldDark = new Color(0xFFFFFF);
        Color textLight = new Color(0x1C1917);

        JPanel form = new JPanel();
        form.setLayout(new BoxLayout(form, BoxLayout.Y_AXIS));
        form.setBackground(panelDark);
        form.setBorder(BorderFactory.createEmptyBorder(20, 20, 20, 20));

        Font labelFont = new Font("Helvetica Neue",Font.PLAIN, 18);
        Font fieldFont = new Font("Helvetica Neue",Font.PLAIN, 16);

        JLabel titleLabel = new JLabel("Task Name:");
        titleLabel.setForeground(textLight);
        titleLabel.setFont(labelFont);
        JTextField titleField = new JTextField();
        titleField.setMaximumSize(new Dimension(Integer.MAX_VALUE, 35));
        titleField.setBackground(fieldDark);
        titleField.setForeground(textLight);
        titleField.setFont(fieldFont);

        JLabel courseLabel = new JLabel("Course:");
        courseLabel.setForeground(textLight);
        courseLabel.setFont(labelFont);
        JTextField courseField = new JTextField();
        courseField.setMaximumSize(new Dimension(Integer.MAX_VALUE, 35));
        courseField.setBackground(fieldDark);
        courseField.setForeground(textLight);
        courseField.setFont(fieldFont);

        JLabel descLabel = new JLabel("Description:");
        descLabel.setForeground(textLight);
        descLabel.setFont(labelFont);
        JTextArea descArea = new JTextArea(4, 20);
        descArea.setLineWrap(true);
        descArea.setWrapStyleWord(true);
        descArea.setBackground(fieldDark);
        descArea.setForeground(textLight);
        descArea.setFont(fieldFont);
        JScrollPane descScroll = new JScrollPane(descArea);

        JLabel dateLabel = new JLabel("Due Date (YYYY-MM-DD):");
        dateLabel.setForeground(textLight);
        dateLabel.setFont(labelFont);
        JTextField dateField = new JTextField();
        dateField.setMaximumSize(new Dimension(Integer.MAX_VALUE, 35));
        dateField.setBackground(fieldDark);
        dateField.setForeground(textLight);
        dateField.setFont(fieldFont);

        JCheckBox completedCheck = new JCheckBox("Completed?");
        completedCheck.setForeground(textLight);
        completedCheck.setBackground(panelDark);
        completedCheck.setFont(labelFont);

        if (editing) {
            titleField.setText(taskToEdit.getTitle());
            courseField.setText(taskToEdit.getCourse());
            descArea.setText(taskToEdit.getDescription());
            dateField.setText(taskToEdit.getDate().toString());
            completedCheck.setSelected(taskToEdit.isCompleted());
        }

        form.add(titleLabel); form.add(titleField); form.add(Box.createVerticalStrut(10));
        form.add(courseLabel); form.add(courseField); form.add(Box.createVerticalStrut(10));
        form.add(descLabel); form.add(descScroll); form.add(Box.createVerticalStrut(10));
        form.add(dateLabel); form.add(dateField); form.add(Box.createVerticalStrut(10));
        form.add(completedCheck);

        popup.add(form, BorderLayout.CENTER);

        JButton saveBtn = new JButton(editing ? "Save Changes" : "Save Task");
        JButton cancelBtn = new JButton("Cancel");

        saveBtn.setFont(new Font("Helvetica Neue",Font.BOLD, 16));
        cancelBtn.setFont(new Font("Helvetica Neue",Font.BOLD, 16));

        JPanel buttons = new JPanel();
        buttons.setBackground(panelDark);
        buttons.add(saveBtn);
        buttons.add(cancelBtn);
        popup.add(buttons, BorderLayout.SOUTH);

        saveBtn.addActionListener(e -> {
            try {
                if (editing) {
                    taskToEdit.setTitle(titleField.getText());
                    taskToEdit.setCourse(courseField.getText());
                    taskToEdit.setDescription(descArea.getText());
                    taskToEdit.setDate(LocalDate.parse(dateField.getText()));
                    taskToEdit.setCompleted(completedCheck.isSelected());

                    tasksDataAccess.updateTask(taskToEdit);

                    if (completedCheck.isSelected() && CalendarPanel.sharedViewModel != null) {
                        CalendarPanel.sharedViewModel.markCompleted(
                                taskToEdit.getTitle(), taskToEdit.getDate());
                    }

                } else {
                    Task newTask = new Task(
                            Task.nextId(),
                            titleField.getText(),
                            descArea.getText(),
                            LocalDate.parse(dateField.getText()),
                            courseField.getText()
                    );
                    newTask.setCompleted(completedCheck.isSelected());

                    tasksDataAccess.addTask(newTask);

                    // sync to calendar if enabled
                    if (CalendarPanel.sharedCalendarController != null) {
                        CalendarPanel.sharedCalendarController.addEvent(
                                newTask.getTitle(),
                                newTask.getDate(),
                                Color.BLUE
                        );
                    }
                }

                allTasks = tasksDataAccess.getAllTasks();
                refreshTable(true);


                dashboardController.execute();

                popup.dispose();

            } catch (Exception ex) {
                JOptionPane.showMessageDialog(
                        popup,
                        "Invalid input — please check fields.",
                        "Error",
                        JOptionPane.ERROR_MESSAGE
                );
            }
        });


        cancelBtn.addActionListener(e -> popup.dispose());

        popup.setVisible(true);
    }

    private void styleSortButton(JButton btn, Color fg) {
        Color base  = new Color(0x3B82F6);
        Color hover = new Color(0x2563EB);
        btn.setFont(new Font("Helvetica Neue", Font.BOLD, 17));
        btn.setForeground(Color.WHITE);
        btn.setBackground(base);
        btn.setContentAreaFilled(true);
        btn.setOpaque(true);
        btn.setBorderPainted(false);
        btn.setFocusPainted(false);
        btn.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        btn.addMouseListener(new MouseAdapter() {
            public void mouseEntered(MouseEvent e) { btn.setBackground(hover); }
            public void mouseExited(MouseEvent e)  { btn.setBackground(base); }
        });
    }
}
