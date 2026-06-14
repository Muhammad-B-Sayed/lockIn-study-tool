package interfaceadapter.login;

import interfaceadapter.ViewManagerModel;
import interfaceadapter.logged_in.LoggedInState;
import interfaceadapter.logged_in.LoggedInViewModel;
import usecase.login.LoginOutputBoundary;
import usecase.login.LoginOutputData;
import usecase.tasks.TasksDataAccessInterface;

public class LoginPresenter implements LoginOutputBoundary {

    private final LoginViewModel loginViewModel;
    private final LoggedInViewModel loggedInViewModel;
    private final ViewManagerModel viewManagerModel;
    private final TasksDataAccessInterface tasksDataAccess;

    public LoginPresenter(ViewManagerModel viewManagerModel,
                          LoggedInViewModel loggedInViewModel,
                          LoginViewModel loginViewModel,
                          TasksDataAccessInterface tasksDataAccess) {
        this.viewManagerModel = viewManagerModel;
        this.loggedInViewModel = loggedInViewModel;
        this.loginViewModel = loginViewModel;
        this.tasksDataAccess = tasksDataAccess;
    }

    @Override
    public void prepareSuccessView(LoginOutputData response) {
        tasksDataAccess.setCurrentUsername(response.getUsername());

        final LoggedInState loggedInState = loggedInViewModel.getState();
        loggedInState.setUsername(response.getUsername());
        this.loggedInViewModel.firePropertyChange();

        loginViewModel.setState(new LoginState());

        this.viewManagerModel.setState(loggedInViewModel.getViewName());
        this.viewManagerModel.firePropertyChange();
    }

    @Override
    public void prepareFailView(String error) {
        final LoginState loginState = loginViewModel.getState();
        loginState.setLoginError(error);
        loginViewModel.firePropertyChange();
    }
}
