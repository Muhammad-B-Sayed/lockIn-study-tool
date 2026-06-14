package usecase.delete_account;

public interface DeleteAccountUserDataAccessInterface {
    String getCurrentUsername();
    void deleteUser(String username);
    void setCurrentUsername(String username);
}
