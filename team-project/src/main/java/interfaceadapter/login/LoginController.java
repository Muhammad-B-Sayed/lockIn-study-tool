package interfaceadapter.login;

import interfaceadapter.ViewManagerModel;
import interfaceadapter.signup.SignupViewModel;
import usecase.login.LoginInputBoundary;
import usecase.login.LoginInputData;

/**
 * The controller for the Login Use Case.
 */
public class LoginController {

    private final LoginInputBoundary loginUseCaseInteractor;
    private final ViewManagerModel viewManagerModel;
    private final SignupViewModel signupViewModel;

    public LoginController(LoginInputBoundary loginUseCaseInteractor,
                           ViewManagerModel viewManagerModel,
                           SignupViewModel signupViewModel) {
        this.loginUseCaseInteractor = loginUseCaseInteractor;
        this.viewManagerModel = viewManagerModel;
        this.signupViewModel = signupViewModel;
    }

    /**
     * Executes the Login Use Case.
     * @param username the username of the user logging in
     * @param password the password of the user logging in
     */
    public void execute(String username, String password) {
        final LoginInputData loginInputData = new LoginInputData(username, password);
        loginUseCaseInteractor.execute(loginInputData);
    }

    /**
     * Switches from the Login view to the Signup view.
     */
    public void switchToSignupView() {
        viewManagerModel.setState(signupViewModel.getViewName());
        viewManagerModel.firePropertyChange();
    }
}
