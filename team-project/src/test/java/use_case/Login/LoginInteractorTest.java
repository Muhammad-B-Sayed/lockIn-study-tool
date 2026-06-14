package use_case.Login;

import entity.User;
import entity.UserFactory;
import org.junit.jupiter.api.Test;
import org.mindrot.jbcrypt.BCrypt;
import usecase.login.*;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for the LoginInteractor, checking success and failure paths.
 */
class LoginInteractorTest {

    // --- Mock Data Access Object (Stub) ---
    // Simulates the DAO's behavior without actually touching the file system.
    private static class MockDataAccessStub implements LoginUserDataAccessInterface {
        private final Map<String, User> accounts = new HashMap<>();
        private String currentUsername = null;

        public MockDataAccessStub() {
            UserFactory factory = new UserFactory();
            String hashed = BCrypt.hashpw("SecurePwd123", BCrypt.gensalt());
            User testUser = factory.create("testUser", hashed);
            accounts.put("testUser", testUser);
        }

        @Override
        public boolean existsByName(String identifier) {
            return accounts.containsKey(identifier);
        }

        @Override
        public User get(String username) {
            currentUsername = username;
            return accounts.get(username);
        }

        @Override
        public void setCurrentUsername(String name) {
            this.currentUsername = name;
        }

        @Override
        public String getCurrentUsername() {
            return this.currentUsername;
        }

        @Override
        public void save(User user) {
            accounts.put(user.getName(), user);
        }
    }

    // --- Output Boundary (Spy) ---
    // Captures the results sent by the Interactor to check if the correct method was called.
    private static class PresenterSpy implements LoginOutputBoundary {
        private boolean successCalled = false;
        private boolean failCalled = false;
        private String failMessage = null;
        private String loggedInUsername = null;

        @Override
        public void prepareSuccessView(LoginOutputData response) {
            this.successCalled = true;
            this.loggedInUsername = response.getUsername();
        }

        @Override
        public void prepareFailView(String error) {
            this.failCalled = true;
            this.failMessage = error;
        }

        public String getFailMessage() {
            return failMessage;
        }
    }

    @Test
    void testExecute_SuccessCase() {
        // Arrange
        MockDataAccessStub dao = new MockDataAccessStub();
        PresenterSpy presenter = new PresenterSpy();
        LoginInteractor interactor = new LoginInteractor(dao, presenter);
        LoginInputData input = new LoginInputData("testUser", "SecurePwd123");

        // Act
        interactor.execute(input);

        // Assert
        assertTrue(presenter.successCalled, "The presenter should have been notified of success.");
        assertFalse(presenter.failCalled, "The presenter should not have been notified of failure.");
        assertEquals("testUser", presenter.loggedInUsername, "The correct username should be passed to the presenter.");
        // Optional: Check that the current user state was set in the DAO
        assertEquals("testUser", dao.getCurrentUsername(), "DAO should reflect the logged-in user.");
    }

    @Test
    void testExecute_FailureCase_WrongPassword() {
        // Arrange
        MockDataAccessStub dao = new MockDataAccessStub();
        PresenterSpy presenter = new PresenterSpy();
        LoginInteractor interactor = new LoginInteractor(dao, presenter);
        LoginInputData input = new LoginInputData("testUser", "WrongPassword");

        // Act
        interactor.execute(input);

        // Assert
        assertFalse(presenter.successCalled, "The presenter should not have been notified of success.");
        assertTrue(presenter.failCalled, "The presenter should have been notified of failure.");
        assertEquals("Incorrect password for \"testUser\".", presenter.getFailMessage(), "The correct failure message should be displayed.");
    }

    @Test
    void testExecute_FailureCase_UserNotFound() {
        // Arrange
        MockDataAccessStub dao = new MockDataAccessStub();
        PresenterSpy presenter = new PresenterSpy();
        LoginInteractor interactor = new LoginInteractor(dao, presenter);
        LoginInputData input = new LoginInputData("nonExistentUser", "anyPassword");

        // Act
        interactor.execute(input);

        // Assert
        assertFalse(presenter.successCalled, "The presenter should not have been notified of success.");
        assertTrue(presenter.failCalled, "The presenter should have been notified of failure.");
        assertEquals("nonExistentUser: Account does not exist.", presenter.getFailMessage(), "The correct failure message should be displayed.");
    }
}