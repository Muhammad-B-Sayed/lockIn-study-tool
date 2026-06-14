package app;

import dataaccess.FileTasksDataAccessObject;
import dataaccess.FileUserDataAccessObject;
import entity.UserFactory;
import interfaceadapter.ViewManagerModel;
import interfaceadapter.dashboard.DashboardController;
import interfaceadapter.dashboard.DashboardPresenter;
import interfaceadapter.dashboard.DashboardViewModel;
import interfaceadapter.delete_account.DeleteAccountController;
import interfaceadapter.delete_account.DeleteAccountPresenter;
import interfaceadapter.logged_in.ChangePasswordController;
import interfaceadapter.logged_in.ChangePasswordPresenter;
import interfaceadapter.logged_in.LoggedInViewModel;
import interfaceadapter.login.LoginController;
import interfaceadapter.login.LoginPresenter;
import interfaceadapter.login.LoginViewModel;
import interfaceadapter.logout.LogoutController;
import interfaceadapter.logout.LogoutPresenter;
import interfaceadapter.signup.SignupController;
import interfaceadapter.signup.SignupPresenter;
import interfaceadapter.signup.SignupViewModel;
import usecase.change_password.ChangePasswordInputBoundary;
import usecase.change_password.ChangePasswordInteractor;
import usecase.change_password.ChangePasswordOutputBoundary;
import usecase.delete_account.DeleteAccountInputBoundary;
import usecase.delete_account.DeleteAccountInteractor;
import usecase.delete_account.DeleteAccountOutputBoundary;
import usecase.dashboard.DashboardInputBoundary;
import usecase.dashboard.DashboardInteractor;
import usecase.dashboard.DashboardOutputBoundary;
import usecase.login.LoginInputBoundary;
import usecase.login.LoginInteractor;
import usecase.login.LoginOutputBoundary;
import usecase.logout.LogoutInputBoundary;
import usecase.logout.LogoutInteractor;
import usecase.logout.LogoutOutputBoundary;
import usecase.signup.SignupInputBoundary;
import usecase.signup.SignupInteractor;
import usecase.signup.SignupOutputBoundary;
import view.LoggedInView;
import view.LoginView;
import view.SignupView;
import view.ViewManager;

import javax.swing.*;
import java.awt.*;

public class AppBuilder {
    private final JPanel cardPanel = new JPanel();
    private final CardLayout cardLayout = new CardLayout();

    // Data Access Objects and Factories
    private FileUserDataAccessObject userDataAccessObject;
    private FileTasksDataAccessObject tasksDataAccessObject;
    private UserFactory userFactory;

    // View Models
    private ViewManagerModel viewManagerModel;
    private LoginViewModel loginViewModel;
    private SignupViewModel signupViewModel;
    private LoggedInViewModel loggedInViewModel;
    private DashboardViewModel dashboardViewModel;

    // Views
    private LoginView loginView;
    private SignupView signupView;
    private LoggedInView loggedInView;

    public AppBuilder() {
        cardPanel.setLayout(cardLayout);

        // Initialize Models
        viewManagerModel = new ViewManagerModel();
        loginViewModel = new LoginViewModel();
        signupViewModel = new SignupViewModel();
        loggedInViewModel = new LoggedInViewModel();

        // Initialize DAO and Factory
        this.userDataAccessObject = new FileUserDataAccessObject("./users.csv", new UserFactory());
        this.tasksDataAccessObject = new FileTasksDataAccessObject("./tasks.csv");

        userFactory = new UserFactory();

        // Initialize ViewManager
        new ViewManager(cardPanel, cardLayout, viewManagerModel);
    }

    public AppBuilder addLoginView() {
        // Dependencies for Login
        final LoginOutputBoundary loginOutputBoundary = new LoginPresenter(viewManagerModel,
                loggedInViewModel, loginViewModel, tasksDataAccessObject);
        final LoginInputBoundary loginInteractor =
                new LoginInteractor(userDataAccessObject, loginOutputBoundary);

        final LoginController loginController =
                new LoginController(loginInteractor, viewManagerModel, signupViewModel);


        // View Creation
        this.loginView = new LoginView(loginViewModel);
        this.loginView.setLoginController(loginController);
        cardPanel.add(loginView, loginView.getViewName());
        return this;
    }

    public AppBuilder addSignupView() {
        // Dependencies for Signup
        final SignupOutputBoundary signupOutputBoundary = new SignupPresenter(viewManagerModel,
                signupViewModel, loginViewModel);
        final SignupInputBoundary signupInteractor = new SignupInteractor(
                userDataAccessObject, signupOutputBoundary, userFactory);
        final SignupController signupController = new SignupController(signupInteractor);

        // View Creation
        this.signupView = new SignupView(signupViewModel);
        this.signupView.setSignupController(signupController);
        cardPanel.add(signupView, signupView.getViewName());
        return this;
    }

    /**
     * Instantiates the LoggedInView and wires up the Dashboard Use Case.
     * @param dashboardViewModel The ViewModel containing the 'due soon' tasks.
     * @return this AppBuilder instance.
     */
    public AppBuilder addLoggedInView(DashboardViewModel dashboardViewModel) {
        this.dashboardViewModel = dashboardViewModel;

        DashboardOutputBoundary dashboardPresenter = new DashboardPresenter(dashboardViewModel);
        DashboardInputBoundary dashboardInteractor = new DashboardInteractor(tasksDataAccessObject, dashboardPresenter);
        DashboardController dashboardController = new DashboardController(dashboardInteractor);

        this.loggedInView = new LoggedInView(
                loggedInViewModel,
                this.dashboardViewModel,
                dashboardController,
                tasksDataAccessObject
        );

        cardPanel.add(loggedInView, loggedInView.getViewName());

        return this;
    }

    public AppBuilder addSignupUseCase() {
        return this;
    }

    public AppBuilder addLoginUseCase() {
        return this;
    }

    public AppBuilder addChangePasswordUseCase() {
        final ChangePasswordOutputBoundary changePasswordOutputBoundary = new ChangePasswordPresenter(viewManagerModel,
                loggedInViewModel);

        final ChangePasswordInputBoundary changePasswordInteractor =
                new ChangePasswordInteractor(userDataAccessObject, changePasswordOutputBoundary, userFactory);

        ChangePasswordController changePasswordController = new ChangePasswordController(changePasswordInteractor);

        loggedInView.setChangePasswordController(changePasswordController);
        return this;
    }

    public AppBuilder addDeleteAccountUseCase() {
        final DeleteAccountOutputBoundary deleteAccountPresenter = new DeleteAccountPresenter(
                viewManagerModel, loggedInViewModel, loginViewModel);
        final DeleteAccountInputBoundary deleteAccountInteractor = new DeleteAccountInteractor(
                userDataAccessObject, tasksDataAccessObject, deleteAccountPresenter);
        final DeleteAccountController deleteAccountController =
                new DeleteAccountController(deleteAccountInteractor);
        loggedInView.setDeleteAccountController(deleteAccountController);
        return this;
    }

    public AppBuilder addLogoutUseCase() {
        final LogoutOutputBoundary logoutOutputBoundary = new LogoutPresenter(viewManagerModel,
                loggedInViewModel, loginViewModel);

        final LogoutInputBoundary logoutInteractor =
                new LogoutInteractor(userDataAccessObject, logoutOutputBoundary);

        final LogoutController logoutController = new LogoutController(logoutInteractor);

        loggedInView.setLogoutController(logoutController);
        return this;
    }

    public JFrame build() {
        final JFrame application = new JFrame("LockIn");
        application.setDefaultCloseOperation(WindowConstants.EXIT_ON_CLOSE);

        if (loggedInView != null) {
            loggedInView.setApplicationFrame(application);
        }

        application.add(cardPanel);

        viewManagerModel.setState(signupView.getViewName());
        viewManagerModel.firePropertyChange();

        return application;
    }
}