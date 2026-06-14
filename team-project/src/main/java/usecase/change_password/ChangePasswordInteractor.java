package usecase.change_password;

import entity.User;
import entity.UserFactory;
import org.mindrot.jbcrypt.BCrypt;

/**
 * The Change Password Interactor.
 */
public class ChangePasswordInteractor implements ChangePasswordInputBoundary {
    private final ChangePasswordUserDataAccessInterface userDataAccessObject;
    private final ChangePasswordOutputBoundary userPresenter;
    private final UserFactory userFactory;

    public ChangePasswordInteractor(ChangePasswordUserDataAccessInterface changePasswordDataAccessInterface,
                                    ChangePasswordOutputBoundary changePasswordOutputBoundary,
                                    UserFactory userFactory) {
        this.userDataAccessObject = changePasswordDataAccessInterface;
        this.userPresenter = changePasswordOutputBoundary;
        this.userFactory = userFactory;
    }

    @Override
    public void execute(ChangePasswordInputData changePasswordInputData) {
        if ("".equals(changePasswordInputData.getPassword())) {
            userPresenter.prepareFailView("New password cannot be empty");
        }
        else {
            final String hashedPassword = BCrypt.hashpw(changePasswordInputData.getPassword(), BCrypt.gensalt());
            final User user = userFactory.create(changePasswordInputData.getUsername(), hashedPassword);

            userDataAccessObject.changePassword(user);

            final ChangePasswordOutputData changePasswordOutputData = new ChangePasswordOutputData(user.getName());
            userPresenter.prepareSuccessView(changePasswordOutputData);
        }
    }
}
