package interfaceadapter.delete_account;

import usecase.delete_account.DeleteAccountInputBoundary;

public class DeleteAccountController {

    private final DeleteAccountInputBoundary interactor;

    public DeleteAccountController(DeleteAccountInputBoundary interactor) {
        this.interactor = interactor;
    }

    public void execute() {
        interactor.execute();
    }
}
