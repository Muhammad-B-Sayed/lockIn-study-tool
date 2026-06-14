package usecase.delete_account;

import usecase.tasks.TasksDataAccessInterface;

public class DeleteAccountInteractor implements DeleteAccountInputBoundary {

    private final DeleteAccountUserDataAccessInterface userDao;
    private final TasksDataAccessInterface tasksDao;
    private final DeleteAccountOutputBoundary presenter;

    public DeleteAccountInteractor(DeleteAccountUserDataAccessInterface userDao,
                                   TasksDataAccessInterface tasksDao,
                                   DeleteAccountOutputBoundary presenter) {
        this.userDao = userDao;
        this.tasksDao = tasksDao;
        this.presenter = presenter;
    }

    @Override
    public void execute() {
        String username = userDao.getCurrentUsername();
        tasksDao.deleteAllTasksForUser(username);
        userDao.deleteUser(username);
        userDao.setCurrentUsername(null);
        presenter.prepareSuccessView();
    }
}
