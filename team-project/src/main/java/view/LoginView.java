package view;

import interfaceadapter.login.LoginController;
import interfaceadapter.login.LoginState;
import interfaceadapter.login.LoginViewModel;

import javax.swing.*;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;

public class LoginView extends JPanel implements ActionListener, PropertyChangeListener {

    private final String viewName = "log in";
    private final LoginViewModel loginViewModel;

    private final JTextField usernameInputField = new JTextField(20);
    private final JLabel usernameErrorField = new JLabel(" ");
    private final JPasswordField passwordInputField = new JPasswordField(20);

    private final JButton logIn;
    private final JButton cancel;
    private final JButton toSignup;

    private LoginController loginController = null;

    private static final Color BG        = new Color(0xFAF8F5);
    private static final Color SURFACE   = new Color(0xFFFFFF);
    private static final Color FIELD     = new Color(0xFAF8F5);
    private static final Color ACCENT    = new Color(0x3B82F6);
    private static final Color ACCENT_HI = new Color(0x2563EB);
    private static final Color TEXT      = new Color(0x1C1917);
    private static final Color MUTED     = new Color(0x78716C);
    private static final Color DANGER    = new Color(0xDC2626);
    private static final Color BORDER    = new Color(0xE2D9D0);

    public LoginView(LoginViewModel loginViewModel) {
        this.loginViewModel = loginViewModel;
        this.loginViewModel.addPropertyChangeListener(this);

        setLayout(new GridBagLayout());
        setBackground(BG);

        JPanel card = new JPanel();
        card.setLayout(new BoxLayout(card, BoxLayout.Y_AXIS));
        card.setBackground(SURFACE);
        card.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(BORDER, 1),
                BorderFactory.createEmptyBorder(44, 52, 44, 52)));
        card.setPreferredSize(new Dimension(420, 530));

        JLabel appName = new JLabel("LockIn");
        appName.setFont(new Font("Copperplate", Font.BOLD, 46));
        appName.setForeground(ACCENT);
        appName.setAlignmentX(Component.CENTER_ALIGNMENT);

        JLabel sub = new JLabel("Sign in to continue");
        sub.setFont(new Font("Helvetica Neue",Font.PLAIN, 17));
        sub.setForeground(MUTED);
        sub.setAlignmentX(Component.CENTER_ALIGNMENT);

        JLabel usernameLabel = new JLabel("Username");
        usernameLabel.setFont(new Font("Helvetica Neue",Font.BOLD, 15));
        usernameLabel.setForeground(MUTED);
        usernameLabel.setAlignmentX(Component.CENTER_ALIGNMENT);
        usernameLabel.setHorizontalAlignment(SwingConstants.CENTER);
        styleField(usernameInputField);

        usernameErrorField.setFont(new Font("Helvetica Neue",Font.PLAIN, 14));
        usernameErrorField.setForeground(DANGER);
        usernameErrorField.setAlignmentX(Component.CENTER_ALIGNMENT);
        usernameErrorField.setHorizontalAlignment(SwingConstants.CENTER);

        JLabel passwordLabel = new JLabel("Password");
        passwordLabel.setFont(new Font("Helvetica Neue",Font.BOLD, 15));
        passwordLabel.setForeground(MUTED);
        passwordLabel.setAlignmentX(Component.CENTER_ALIGNMENT);
        passwordLabel.setHorizontalAlignment(SwingConstants.CENTER);
        styleField(passwordInputField);

        logIn = new JButton("Log In");
        styleAccentButton(logIn);

        toSignup = new JButton("Create an account →");
        styleGhostButton(toSignup, MUTED);

        cancel = new JButton("Exit");
        styleGhostButton(cancel, new Color(0x6B7280));

        card.add(appName);
        card.add(Box.createVerticalStrut(6));
        card.add(sub);
        card.add(Box.createVerticalStrut(32));
        card.add(usernameLabel);
        card.add(Box.createVerticalStrut(6));
        card.add(usernameInputField);
        card.add(Box.createVerticalStrut(4));
        card.add(usernameErrorField);
        card.add(Box.createVerticalStrut(16));
        card.add(passwordLabel);
        card.add(Box.createVerticalStrut(6));
        card.add(passwordInputField);
        card.add(Box.createVerticalStrut(28));
        card.add(logIn);
        card.add(Box.createVerticalStrut(12));
        card.add(toSignup);
        card.add(Box.createVerticalStrut(4));
        card.add(cancel);

        add(card);

        wireListeners();
    }

    private void styleField(JTextField field) {
        field.setBackground(FIELD);
        field.setForeground(TEXT);
        field.setCaretColor(TEXT);
        field.setFont(new Font("Helvetica Neue",Font.PLAIN, 17));
        field.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(BORDER, 1),
                BorderFactory.createEmptyBorder(10, 14, 10, 14)));
        field.setMaximumSize(new Dimension(Integer.MAX_VALUE, 46));
        field.setAlignmentX(Component.CENTER_ALIGNMENT);
    }

    private void styleAccentButton(JButton btn) {
        btn.setBackground(ACCENT);
        btn.setForeground(Color.WHITE);
        btn.setFont(new Font("Helvetica Neue",Font.BOLD, 17));
        btn.setBorderPainted(false);
        btn.setFocusPainted(false);
        btn.setOpaque(true);
        btn.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        btn.setMaximumSize(new Dimension(Integer.MAX_VALUE, 46));
        btn.setAlignmentX(Component.CENTER_ALIGNMENT);
        btn.addMouseListener(new MouseAdapter() {
            public void mouseEntered(MouseEvent e) { btn.setBackground(ACCENT_HI); }
            public void mouseExited(MouseEvent e)  { btn.setBackground(ACCENT); }
        });
    }

    private void styleGhostButton(JButton btn, Color fg) {
        btn.setForeground(fg);
        btn.setFont(new Font("Helvetica Neue",Font.PLAIN, 16));
        btn.setBorderPainted(false);
        btn.setFocusPainted(false);
        btn.setContentAreaFilled(false);
        btn.setOpaque(false);
        btn.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        btn.setAlignmentX(Component.CENTER_ALIGNMENT);
        btn.addMouseListener(new MouseAdapter() {
            public void mouseEntered(MouseEvent e) { btn.setForeground(ACCENT); }
            public void mouseExited(MouseEvent e)  { btn.setForeground(fg); }
        });
    }

    private void wireListeners() {
        logIn.addActionListener(evt -> {
            if (loginController != null) {
                final LoginState s = loginViewModel.getState();
                loginController.execute(s.getUsername(), s.getPassword());
            }
        });

        cancel.addActionListener(this);

        toSignup.addActionListener(evt -> {
            if (loginController != null) loginController.switchToSignupView();
        });

        usernameInputField.getDocument().addDocumentListener(new DocumentListener() {
            private void sync() {
                loginViewModel.getState().setUsername(usernameInputField.getText());
                loginViewModel.setState(loginViewModel.getState());
            }
            public void insertUpdate(DocumentEvent e)  { sync(); }
            public void removeUpdate(DocumentEvent e)  { sync(); }
            public void changedUpdate(DocumentEvent e) { sync(); }
        });

        passwordInputField.getDocument().addDocumentListener(new DocumentListener() {
            private void sync() {
                loginViewModel.getState().setPassword(new String(passwordInputField.getPassword()));
                loginViewModel.setState(loginViewModel.getState());
            }
            public void insertUpdate(DocumentEvent e)  { sync(); }
            public void removeUpdate(DocumentEvent e)  { sync(); }
            public void changedUpdate(DocumentEvent e) { sync(); }
        });
    }

    @Override
    public void actionPerformed(ActionEvent evt) {
        if (evt.getSource() == cancel) {
            JFrame frame = (JFrame) SwingUtilities.getWindowAncestor(this);
            int result = JOptionPane.showConfirmDialog(frame,
                    "You are leaving the program now.", "Confirm Exit",
                    JOptionPane.OK_CANCEL_OPTION, JOptionPane.WARNING_MESSAGE);
            if (result == JOptionPane.OK_OPTION) System.exit(0);
        }
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        final LoginState state = (LoginState) evt.getNewValue();
        usernameInputField.setText(state.getUsername());
        passwordInputField.setText(state.getPassword());
        String err = state.getLoginError();
        usernameErrorField.setText(err != null ? err : " ");
    }

    public String getViewName() { return viewName; }

    public void setLoginController(LoginController loginController) {
        this.loginController = loginController;
    }
}
