package view;

import entity.Task;

import javax.swing.*;
import java.awt.*;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.util.List;

import usecase.tasks.TasksDataAccessInterface;
import dataaccess.QuoteApiClient;

import interfaceadapter.dashboard.DashboardController;
import interfaceadapter.dashboard.DashboardViewModel;
import interfaceadapter.delete_account.DeleteAccountController;
import interfaceadapter.logged_in.ChangePasswordController;
import interfaceadapter.logout.LogoutController;
import interfaceadapter.tasks.TasksController;
import interfaceadapter.tasks.TasksPresenter;
import interfaceadapter.tasks.TasksViewModel;

import interfaceadapter.quote.QuoteController;
import interfaceadapter.quote.QuotePresenter;
import interfaceadapter.quote.QuoteViewModel;

import usecase.tasks.TasksInteractor;
import usecase.quote.QuoteGateway;
import usecase.quote.QuoteInputBoundary;
import usecase.quote.QuoteInteractor;
import usecase.quote.QuoteOutputBoundary;

public class DashboardView extends JPanel {

    private static final String HOME_CARD = "Dashboard";
    private static final String TASK_MANAGER_CARD = "Task Manager";
    private static final String CALENDAR_CARD = "Calendar";

    private final JFrame frame;
    private final CardLayout cardLayout;
    private final JPanel cardPanel;

    private final JLabel mainHeaderLabel;

    private JButton currentSelectedButton = null;

    private final HomePanel homePanel;
    private final TasksPanel tasksPanel;
    private final CalendarPanel calendarPanel;

    private final DashboardViewModel dashboardViewModel;
    private final DashboardController dashboardController;

    private final QuoteViewModel quoteViewModel;
    private final QuoteController quoteController;

    private final TasksDataAccessInterface tasksDataAccess;

    private ChangePasswordController changePasswordController = null;
    private LogoutController logoutController = null;
    private TasksController tasksController;
    private DeleteAccountController deleteAccountController = null;

    private final Color BG_BLACK      = new Color(0xFAF8F5);
    private final Color PANEL_DARK    = new Color(0xF0EBE4);
    private final Color ACCENT_HOVER  = new Color(0x3B82F6);
    private final Color SIDEBAR_HOVER = new Color(0xEDE8E3);
    private final Color TEXT_LIGHT    = new Color(0x1C1917);
    private final Color BUTTON_BASE   = new Color(0xF0EBE4);

    /**
     * Updated constructor to accept Controller and DAO.
     */
    public DashboardView(JFrame frame,
                         DashboardViewModel dashboardViewModel,
                         DashboardController dashboardController,
                         TasksDataAccessInterface tasksDataAccess) {

        this.frame = frame;
        this.dashboardViewModel = dashboardViewModel;
        this.dashboardController = dashboardController;
        this.tasksDataAccess = tasksDataAccess;

        this.cardLayout = new CardLayout();
        this.cardPanel = new JPanel(cardLayout);

        // ---------- TASKS USE CASE WIRING ----------
        TasksViewModel tasksViewModel = new TasksViewModel();
        TasksPresenter tasksPresenter = new TasksPresenter(tasksViewModel);
        TasksInteractor tasksInteractor = new TasksInteractor(tasksDataAccess, tasksPresenter);
        this.tasksController = new TasksController(tasksInteractor);

        // ---------- QUOTE USE CASE WIRING ----------
        this.quoteViewModel = new QuoteViewModel();
        QuoteGateway quoteGateway = new QuoteApiClient();
        QuoteOutputBoundary quotePresenter = new QuotePresenter(quoteViewModel);
        QuoteInputBoundary quoteInteractor = new QuoteInteractor(quoteGateway, quotePresenter);
        this.quoteController = new QuoteController(quoteInteractor);

        // ---------- PANELS ----------
        this.homePanel = new HomePanel(this.dashboardViewModel, this.quoteViewModel, this.quoteController);
        this.tasksPanel = new TasksPanel(this.dashboardViewModel, this.dashboardController, tasksDataAccess);
        this.calendarPanel = new CalendarPanel();

        this.mainHeaderLabel = new JLabel("LockIn Dashboard", SwingConstants.CENTER);

        initUI();
    }

    private void initUI() {
        setLayout(new BorderLayout(10, 10));

        // ----- Header (title only) -----
        mainHeaderLabel.setFont(new Font("Helvetica Neue",Font.BOLD, 34));
        mainHeaderLabel.setOpaque(true);
        mainHeaderLabel.setBackground(PANEL_DARK);
        mainHeaderLabel.setForeground(TEXT_LIGHT);
        mainHeaderLabel.setPreferredSize(new Dimension(0, 80));
        add(mainHeaderLabel, BorderLayout.NORTH);

        // ----- Center cards -----
        cardPanel.setBackground(BG_BLACK);
        cardPanel.add(homePanel, HOME_CARD);
        cardPanel.add(tasksPanel, TASK_MANAGER_CARD);
        cardPanel.add(calendarPanel, CALENDAR_CARD);
        add(cardPanel, BorderLayout.CENTER);

        // ----- Sidebar -----
        JPanel sidebar = new JPanel(new BorderLayout());
        sidebar.setBackground(BG_BLACK);
        sidebar.setPreferredSize(new Dimension(220, 0));

        JPanel navPanel = new JPanel(new GridLayout(4, 1, 0, 0));
        navPanel.setBackground(BG_BLACK);

        String[] buttons = {HOME_CARD, CALENDAR_CARD, TASK_MANAGER_CARD, "Logout"};

        for (String text : buttons) {
            JButton btn = new JButton(text);
            btn.setFont(new Font("Helvetica Neue",Font.PLAIN, 20));
            btn.setForeground(TEXT_LIGHT);
            btn.setBackground(BUTTON_BASE);
            btn.setOpaque(true);
            btn.setFocusPainted(false);
            btn.setBorderPainted(false);
            btn.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));

            if (text.equals(HOME_CARD)) {
                btn.setBackground(ACCENT_HOVER);
                btn.setForeground(Color.WHITE);
                currentSelectedButton = btn;
            }

            btn.addMouseListener(new MouseAdapter() {
                @Override
                public void mouseEntered(MouseEvent e) {
                    if (btn != currentSelectedButton) {
                        btn.setBackground(SIDEBAR_HOVER);
                    }
                }

                @Override
                public void mouseExited(MouseEvent e) {
                    if (btn != currentSelectedButton) {
                        btn.setBackground(BUTTON_BASE);
                    }
                }
            });

            btn.addActionListener(e -> {
                if (currentSelectedButton != null && currentSelectedButton != btn) {
                    currentSelectedButton.setBackground(BUTTON_BASE);
                    currentSelectedButton.setForeground(TEXT_LIGHT);
                }
                currentSelectedButton = btn;
                btn.setBackground(ACCENT_HOVER);
                btn.setForeground(Color.WHITE);

                switch (text) {
                    case HOME_CARD:
                        // Refresh dashboard aggregates when user comes Home
                        dashboardController.execute();
                        cardLayout.show(cardPanel, HOME_CARD);
                        mainHeaderLabel.setText("LockIn Dashboard");
                        break;
                    case TASK_MANAGER_CARD:
                        if (tasksController != null) {
                            tasksController.loadTasks();
                        }
                        cardLayout.show(cardPanel, TASK_MANAGER_CARD);
                        mainHeaderLabel.setText(TASK_MANAGER_CARD);
                        break;
                    case CALENDAR_CARD:
                        cardLayout.show(cardPanel, CALENDAR_CARD);
                        mainHeaderLabel.setText(CALENDAR_CARD);
                        break;
                    case "Logout":
                        if (logoutController != null) {
                            logoutController.execute();
                        } else {
                            currentSelectedButton.setBackground(BUTTON_BASE);
                            currentSelectedButton = null;
                            JOptionPane.showMessageDialog(
                                    frame,
                                    "LogoutController not set.",
                                    "Error",
                                    JOptionPane.ERROR_MESSAGE
                            );
                        }
                        break;
                }
            });

            JPanel buttonWrapper = new JPanel(new BorderLayout());
            buttonWrapper.setOpaque(false);
            buttonWrapper.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
            buttonWrapper.add(btn, BorderLayout.CENTER);
            navPanel.add(buttonWrapper);
        }

        // ----- Delete Account button pinned to bottom of sidebar -----
        Color danger      = new Color(0xDC2626);

        JButton deleteAccountBtn = new JButton("Delete Account");
        deleteAccountBtn.setFont(new Font("Helvetica Neue", Font.BOLD, 15));
        deleteAccountBtn.setForeground(danger);
        deleteAccountBtn.setBackground(BUTTON_BASE);
        deleteAccountBtn.setContentAreaFilled(true);
        deleteAccountBtn.setOpaque(true);
        deleteAccountBtn.setBorderPainted(false);
        deleteAccountBtn.setFocusPainted(false);
        deleteAccountBtn.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        deleteAccountBtn.addMouseListener(new MouseAdapter() {
            public void mouseEntered(MouseEvent e) { deleteAccountBtn.setBackground(SIDEBAR_HOVER); }
            public void mouseExited(MouseEvent e)  { deleteAccountBtn.setBackground(BUTTON_BASE); }
        });
        deleteAccountBtn.addActionListener(e -> {
            int confirm = JOptionPane.showConfirmDialog(frame,
                    "This will permanently delete your account and all tasks. Continue?",
                    "Delete Account", JOptionPane.YES_NO_OPTION, JOptionPane.WARNING_MESSAGE);
            if (confirm == JOptionPane.YES_OPTION && deleteAccountController != null) {
                deleteAccountController.execute();
            }
        });

        JPanel deleteWrapper = new JPanel(new BorderLayout());
        deleteWrapper.setOpaque(false);
        deleteWrapper.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
        deleteWrapper.add(deleteAccountBtn, BorderLayout.CENTER);

        sidebar.add(navPanel, BorderLayout.CENTER);
        sidebar.add(deleteWrapper, BorderLayout.SOUTH);

        add(sidebar, BorderLayout.WEST);

        cardLayout.show(cardPanel, HOME_CARD);
        this.setBackground(BG_BLACK);

        // Initial data load
        dashboardController.execute();

        // Initial quote load via use case
        quoteController.loadQuote();
    }

    public void onLogin() {
        // Reload task manager from file
        tasksPanel.refresh();

        // Clear stale calendar events, then re-sync all persisted tasks
        if (CalendarPanel.sharedViewModel != null) {
            CalendarPanel.sharedViewModel.clearAll();
        }
        if (CalendarPanel.sharedCalendarController != null) {
            List<Task> tasks = tasksDataAccess.getAllTasks();
            for (Task task : tasks) {
                CalendarPanel.sharedCalendarController.addEvent(task.getTitle(), task.getDate(), Color.BLUE);
            }
        }

        // Refresh the dashboard home panel
        dashboardController.execute();
    }

    public void updateUsername(String username) {
        this.homePanel.setUsername(username);
    }

    public void setChangePasswordController(ChangePasswordController changePasswordController) {
        this.changePasswordController = changePasswordController;
    }

    public void setLogoutController(LogoutController logoutController) {
        this.logoutController = logoutController;
    }

    public void setTasksController(TasksController tasksController) {
        this.tasksController = tasksController;
    }

    public void setDeleteAccountController(DeleteAccountController deleteAccountController) {
        this.deleteAccountController = deleteAccountController;
    }
}
