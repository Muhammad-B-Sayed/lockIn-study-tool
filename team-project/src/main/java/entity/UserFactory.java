package entity;

import entity.User;

/**
 * Factory for creating CommonUser objects.
 */
public class UserFactory {

    public User create(String name, String password) {
        return new User(name, password);
    }
}
