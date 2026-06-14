package interfaceadapter.delete_account;

import interfaceadapter.ViewManagerModel;
import interfaceadapter.logged_in.LoggedInViewModel;
import interfaceadapter.login.LoginState;
import interfaceadapter.login.LoginViewModel;
import usecase.delete_account.DeleteAccountOutputBoundary;

public class DeleteAccountPresenter implements DeleteAccountOutputBoundary {

    private final ViewManagerModel viewManagerModel;
    private final LoggedInViewModel loggedInViewModel;
    private final LoginViewModel loginViewModel;

    public DeleteAccountPresenter(ViewManagerModel viewManagerModel,
                                  LoggedInViewModel loggedInViewModel,
                                  LoginViewModel loginViewModel) {
        this.viewManagerModel = viewManagerModel;
        this.loggedInViewModel = loggedInViewModel;
        this.loginViewModel = loginViewModel;
    }

    @Override
    public void prepareSuccessView() {
        loggedInViewModel.getState().setUsername("");
        loggedInViewModel.firePropertyChange();

        LoginState loginState = loginViewModel.getState();
        loginState.setUsername("");
        loginState.setPassword("");
        loginState.setLoginError(null);
        loginViewModel.setState(loginState);
        loginViewModel.firePropertyChange();

        viewManagerModel.setState(loginViewModel.getViewName());
        viewManagerModel.firePropertyChange();
    }
}
