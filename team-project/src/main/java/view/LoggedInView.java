package view;

import usecase.tasks.TasksDataAccessInterface;
import interfaceadapter.dashboard.DashboardController;
import interfaceadapter.dashboard.DashboardViewModel;
import interfaceadapter.delete_account.DeleteAccountController;
import interfaceadapter.logged_in.ChangePasswordController;
import interfaceadapter.logged_in.LoggedInState;
import interfaceadapter.logged_in.LoggedInViewModel;
import interfaceadapter.logout.LogoutController;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;

/**
 * The View for when the user is logged into the program.
 * It acts as the container for the full Dashboard interface.
 */
public class LoggedInView extends JPanel implements ActionListener, PropertyChangeListener {

    public final String viewName = "logged in";
    private final LoggedInViewModel loggedInViewModel;
    private final DashboardViewModel dashboardViewModel;

    // 1. Add fields for the dependencies needed by DashboardView
    private final DashboardController dashboardController;
    private final TasksDataAccessInterface tasksDataAccess;

    private DashboardView dashboard = null;
    private JFrame applicationFrame = null;

    private ChangePasswordController changePasswordController = null;
    private LogoutController logoutController = null;
    private DeleteAccountController deleteAccountController = null;

    /**
     * Updated Constructor to accept all dependencies required to build the Dashboard.
     */
    public LoggedInView(LoggedInViewModel loggedInViewModel,
                        DashboardViewModel dashboardViewModel,
                        DashboardController dashboardController,
                        TasksDataAccessInterface tasksDataAccess) {

        this.loggedInViewModel = loggedInViewModel;
        this.dashboardViewModel = dashboardViewModel;
        this.dashboardController = dashboardController;
        this.tasksDataAccess = tasksDataAccess;

        this.loggedInViewModel.addPropertyChangeListener(this);
        this.setLayout(new BorderLayout());
        this.add(new JLabel("Loading Dashboard...", SwingConstants.CENTER), BorderLayout.CENTER);
    }

    /**
     * Injects the main application frame and finalizes the view setup
     * by creating and displaying the DashboardView.
     */
    public void setApplicationFrame(JFrame applicationFrame) {
        if (this.dashboard != null) {
            return;
        }

        this.applicationFrame = applicationFrame;
        this.dashboard = new DashboardView(
                this.applicationFrame,
                this.dashboardViewModel,
                this.dashboardController,
                this.tasksDataAccess
        );

        this.removeAll();
        this.add(dashboard, BorderLayout.CENTER);
        this.revalidate();
        this.repaint();

        if (changePasswordController != null) {
            dashboard.setChangePasswordController(changePasswordController);
        }
        if (logoutController != null) {
            dashboard.setLogoutController(logoutController);
        }
        if (deleteAccountController != null) {
            dashboard.setDeleteAccountController(deleteAccountController);
        }

        propertyChange(new PropertyChangeEvent(this, "state", null, loggedInViewModel.getState()));

        if (this.applicationFrame != null) {
            this.applicationFrame.setExtendedState(JFrame.MAXIMIZED_BOTH);
            this.applicationFrame.setVisible(true);
            this.applicationFrame.revalidate();
        }
    }

    /**
     * React to a button click. All action logic is now inside DashboardView.
     */
    public void actionPerformed(ActionEvent evt) {
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (evt.getPropertyName().equals("state")) {
            final LoggedInState state = (LoggedInState) evt.getNewValue();

            if (dashboard != null && state.getUsername() != null && !state.getUsername().isEmpty()) {
                dashboard.updateUsername(state.getUsername());
                dashboard.onLogin();
            }
        }
    }

    public String getViewName() {
        return viewName;
    }

    public void setChangePasswordController(ChangePasswordController changePasswordController) {
        this.changePasswordController = changePasswordController;
        if (dashboard != null) {
            dashboard.setChangePasswordController(changePasswordController);
        }
    }

    public void setLogoutController(LogoutController logoutController) {
        this.logoutController = logoutController;
        if (dashboard != null) {
            dashboard.setLogoutController(logoutController);
        }
    }

    public void setDeleteAccountController(DeleteAccountController deleteAccountController) {
        this.deleteAccountController = deleteAccountController;
        if (dashboard != null) {
            dashboard.setDeleteAccountController(deleteAccountController);
        }
    }
}