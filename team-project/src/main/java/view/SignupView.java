package view;

import interfaceadapter.signup.SignupController;
import interfaceadapter.signup.SignupState;
import interfaceadapter.signup.SignupViewModel;

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

public class SignupView extends JPanel implements ActionListener, PropertyChangeListener {

    private final String viewName = "sign up";
    private final SignupViewModel signupViewModel;

    private final JTextField usernameInputField = new JTextField(20);
    private final JPasswordField passwordInputField = new JPasswordField(20);
    private final JPasswordField repeatPasswordInputField = new JPasswordField(20);

    private SignupController signupController = null;

    private final JButton signUp;
    private final JButton cancel;
    private final JButton toLogin;

    private static final Color BG        = new Color(0xFAF8F5);
    private static final Color SURFACE   = new Color(0xFFFFFF);
    private static final Color FIELD     = new Color(0xFAF8F5);
    private static final Color ACCENT    = new Color(0x3B82F6);
    private static final Color ACCENT_HI = new Color(0x2563EB);
    private static final Color TEXT      = new Color(0x1C1917);
    private static final Color MUTED     = new Color(0x78716C);
    private static final Color BORDER    = new Color(0xE2D9D0);

    public SignupView(SignupViewModel signupViewModel) {
        this.signupViewModel = signupViewModel;
        signupViewModel.addPropertyChangeListener(this);

        setLayout(new GridBagLayout());
        setBackground(BG);

        JPanel card = new JPanel();
        card.setLayout(new BoxLayout(card, BoxLayout.Y_AXIS));
        card.setBackground(SURFACE);
        card.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(BORDER, 1),
                BorderFactory.createEmptyBorder(44, 52, 44, 52)));
        card.setPreferredSize(new Dimension(420, 580));

        JLabel appName = new JLabel("LockIn");
        appName.setFont(new Font("Copperplate", Font.BOLD, 46));
        appName.setForeground(ACCENT);
        appName.setAlignmentX(Component.CENTER_ALIGNMENT);

        JLabel sub = new JLabel("Create your account");
        sub.setFont(new Font("Helvetica Neue",Font.PLAIN, 17));
        sub.setForeground(MUTED);
        sub.setAlignmentX(Component.CENTER_ALIGNMENT);

        JLabel usernameLabel = new JLabel(SignupViewModel.USERNAME_LABEL);
        usernameLabel.setFont(new Font("Helvetica Neue",Font.BOLD, 15));
        usernameLabel.setForeground(MUTED);
        usernameLabel.setAlignmentX(Component.CENTER_ALIGNMENT);
        usernameLabel.setHorizontalAlignment(SwingConstants.CENTER);
        styleField(usernameInputField);

        JLabel passwordLabel = new JLabel(SignupViewModel.PASSWORD_LABEL);
        passwordLabel.setFont(new Font("Helvetica Neue",Font.BOLD, 15));
        passwordLabel.setForeground(MUTED);
        passwordLabel.setAlignmentX(Component.CENTER_ALIGNMENT);
        passwordLabel.setHorizontalAlignment(SwingConstants.CENTER);
        styleField(passwordInputField);

        JLabel repeatLabel = new JLabel(SignupViewModel.REPEAT_PASSWORD_LABEL);
        repeatLabel.setFont(new Font("Helvetica Neue",Font.BOLD, 15));
        repeatLabel.setForeground(MUTED);
        repeatLabel.setAlignmentX(Component.CENTER_ALIGNMENT);
        repeatLabel.setHorizontalAlignment(SwingConstants.CENTER);
        styleField(repeatPasswordInputField);

        signUp = new JButton(SignupViewModel.SIGNUP_BUTTON_LABEL);
        styleAccentButton(signUp);

        toLogin = new JButton("Already have an account? Log in →");
        styleGhostButton(toLogin, MUTED);

        cancel = new JButton("Exit");
        styleGhostButton(cancel, new Color(0x6B7280));

        card.add(appName);
        card.add(Box.createVerticalStrut(6));
        card.add(sub);
        card.add(Box.createVerticalStrut(28));
        card.add(usernameLabel);
        card.add(Box.createVerticalStrut(6));
        card.add(usernameInputField);
        card.add(Box.createVerticalStrut(16));
        card.add(passwordLabel);
        card.add(Box.createVerticalStrut(6));
        card.add(passwordInputField);
        card.add(Box.createVerticalStrut(16));
        card.add(repeatLabel);
        card.add(Box.createVerticalStrut(6));
        card.add(repeatPasswordInputField);
        card.add(Box.createVerticalStrut(28));
        card.add(signUp);
        card.add(Box.createVerticalStrut(12));
        card.add(toLogin);
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
        signUp.addActionListener(evt -> {
            if (signupController != null) {
                final SignupState s = signupViewModel.getState();
                signupController.execute(s.getUsername(), s.getPassword(), s.getRepeatPassword());
            }
        });

        toLogin.addActionListener(evt -> {
            if (signupController != null) signupController.switchToLoginView();
        });

        cancel.addActionListener(this);

        usernameInputField.getDocument().addDocumentListener(new DocumentListener() {
            private void sync() {
                signupViewModel.getState().setUsername(usernameInputField.getText());
                signupViewModel.setState(signupViewModel.getState());
            }
            public void insertUpdate(DocumentEvent e)  { sync(); }
            public void removeUpdate(DocumentEvent e)  { sync(); }
            public void changedUpdate(DocumentEvent e) { sync(); }
        });

        passwordInputField.getDocument().addDocumentListener(new DocumentListener() {
            private void sync() {
                signupViewModel.getState().setPassword(new String(passwordInputField.getPassword()));
                signupViewModel.setState(signupViewModel.getState());
            }
            public void insertUpdate(DocumentEvent e)  { sync(); }
            public void removeUpdate(DocumentEvent e)  { sync(); }
            public void changedUpdate(DocumentEvent e) { sync(); }
        });

        repeatPasswordInputField.getDocument().addDocumentListener(new DocumentListener() {
            private void sync() {
                signupViewModel.getState().setRepeatPassword(new String(repeatPasswordInputField.getPassword()));
                signupViewModel.setState(signupViewModel.getState());
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
        final SignupState state = (SignupState) evt.getNewValue();
        if (state.getUsernameError() != null) {
            JOptionPane.showMessageDialog(this, state.getUsernameError());
        }
    }

    public String getViewName() { return viewName; }

    public void setSignupController(SignupController controller) {
        this.signupController = controller;
    }
}
