package view;

import interfaceadapter.dashboard.DashboardViewModel;
import interfaceadapter.dashboard.StopwatchController;
import interfaceadapter.tasks.dto.TaskDTO;
import interfaceadapter.quote.QuoteController;
import interfaceadapter.quote.QuoteViewModel;

import javax.swing.*;
import java.awt.*;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

public class HomePanel extends JPanel implements PropertyChangeListener {

    private final JLabel welcomeLabel;
    private final JLabel quoteLabel;
    private final JPanel mainContentPanel;
    private final DashboardViewModel dashboardViewModel;
    private final QuoteViewModel quoteViewModel;
    private final QuoteController quoteController;

    private final List<JPanel> taskInfoPanels;
    private final JPanel infoContainerPanel;

    private final StopwatchController stopwatchController;
    private JLabel stopwatchLabel;

    private final Color BG_BLACK     = new Color(0xFAF8F5);
    private final Color PANEL_DARK   = new Color(0xF0EBE4);
    private final Color CARD         = new Color(0xFFFFFF);
    private final Color CARD_HI      = new Color(0xFFFAF8);
    private final Color ACCENT_COLOR = new Color(0x3B82F6);
    private final Color TEXT_LIGHT   = new Color(0x1C1917);
    private final Color TEXT_SEC     = new Color(0x78716C);

    public HomePanel(DashboardViewModel dashboardViewModel,
                     QuoteViewModel quoteViewModel,
                     QuoteController quoteController) {
        this.dashboardViewModel = dashboardViewModel;
        this.quoteViewModel = quoteViewModel;
        this.quoteController = quoteController;

        this.dashboardViewModel.addPropertyChangeListener(this);
        this.quoteViewModel.addPropertyChangeListener(this);

        this.stopwatchController = new StopwatchController(dashboardViewModel);

        this.setLayout(new BorderLayout());
        this.setBackground(BG_BLACK);

        // ----- Top welcome + quote bar -----
        JPanel welcomePanel = new JPanel(new BorderLayout());
        welcomePanel.setBackground(PANEL_DARK.brighter());
        welcomePanel.setPreferredSize(new Dimension(0, 120));
        welcomePanel.setBorder(BorderFactory.createEmptyBorder(10, 20, 10, 20));

        welcomeLabel = new JLabel("Welcome Home! (Loading username...)", SwingConstants.LEFT);
        welcomeLabel.setFont(new Font("Helvetica Neue",Font.BOLD, 30));
        welcomeLabel.setForeground(TEXT_LIGHT);

        quoteLabel = new JLabel("", SwingConstants.RIGHT);
        quoteLabel.setFont(new Font("Helvetica Neue",Font.ITALIC, 20));
        quoteLabel.setForeground(TEXT_LIGHT);

        JButton refreshQuoteButton = new JButton("New quote");
        refreshQuoteButton.setFont(new Font("Helvetica Neue",Font.PLAIN, 16));
        refreshQuoteButton.addActionListener(e -> quoteController.loadQuote());

        JPanel rightBox = new JPanel(new FlowLayout(FlowLayout.RIGHT, 10, 0));
        rightBox.setOpaque(false);
        rightBox.add(quoteLabel);
        rightBox.add(refreshQuoteButton);

        welcomePanel.add(welcomeLabel, BorderLayout.CENTER);
        welcomePanel.add(rightBox, BorderLayout.EAST);

        mainContentPanel = new JPanel(new GridLayout(2, 1, 0, 0));
        mainContentPanel.setBackground(BG_BLACK);

        this.add(welcomePanel, BorderLayout.NORTH);
        this.add(mainContentPanel, BorderLayout.CENTER);

        this.infoContainerPanel = createDueSoonPanel();
        JPanel section2Wrapper = createSection2Wrapper(this.infoContainerPanel);
        JPanel section3 = createPlaceholderPanel();

        mainContentPanel.add(section2Wrapper);
        mainContentPanel.add(createSection3Wrapper(section3));

        this.taskInfoPanels = Arrays.stream(this.infoContainerPanel.getComponents())
                .filter(c -> c instanceof JPanel)
                .map(c -> (JPanel) c)
                .collect(Collectors.toList());

        updateTaskPanels(dashboardViewModel.getDueSoonTasks());
    }

    private JPanel createDueSoonPanel() {
        JPanel container = new JPanel();
        container.setBackground(CARD);
        container.setLayout(new BoxLayout(container, BoxLayout.X_AXIS));
        container.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));

        JPanel infoContainer = new JPanel(new GridLayout(1, 3, 15, 0));
        infoContainer.setOpaque(false);
        infoContainer.setMaximumSize(new Dimension(Integer.MAX_VALUE, 250));

        for (int i = 0; i < 3; i++) {
            JPanel infoPanel = createEmptyTaskPanel("Empty Slot");
            infoContainer.add(infoPanel);
        }

        container.add(infoContainer);
        container.add(Box.createHorizontalGlue());
        return infoContainer;
    }

    private JPanel createSection2Wrapper(JPanel section2) {
        JPanel wrapper2 = new JPanel(new BorderLayout());
        wrapper2.setBackground(BG_BLACK);
        wrapper2.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));

        JPanel mainSection2 = new JPanel(new BorderLayout());
        mainSection2.setOpaque(false);

        JLabel titleLabel = new JLabel("Due Soon", SwingConstants.CENTER);
        titleLabel.setFont(new Font("Helvetica Neue",Font.BOLD, 22));
        titleLabel.setForeground(TEXT_LIGHT);
        titleLabel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        titleLabel.setBackground(PANEL_DARK);
        titleLabel.setOpaque(true);

        mainSection2.add(titleLabel, BorderLayout.NORTH);

        JPanel contentArea = new JPanel(new BorderLayout());
        contentArea.setBackground(PANEL_DARK);
        contentArea.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
        contentArea.add(section2, BorderLayout.CENTER);

        mainSection2.add(contentArea, BorderLayout.CENTER);
        wrapper2.add(mainSection2, BorderLayout.CENTER);

        return wrapper2;
    }

    private JPanel createSection3Wrapper(JPanel section3) {
        JPanel wrapper3 = new JPanel(new BorderLayout());
        wrapper3.setBackground(BG_BLACK);
        wrapper3.setBorder(BorderFactory.createEmptyBorder(5, 5, 5, 5));
        wrapper3.add(section3, BorderLayout.CENTER);
        return wrapper3;
    }

    private JPanel createEmptyTaskPanel(String labelText) {
        JPanel panel = new JPanel(new BorderLayout(5, 5));
        panel.setBackground(CARD_HI);
        panel.setBorder(BorderFactory.createLineBorder(new Color(0xE2D9D0), 1, true));

        JLabel title = new JLabel(labelText, SwingConstants.CENTER);
        title.setForeground(TEXT_LIGHT);
        title.setFont(new Font("Helvetica Neue",Font.BOLD, 18));

        panel.add(title, BorderLayout.NORTH);
        return panel;
    }

    private void updateTaskPanels(List<TaskDTO> tasks) {
        if (tasks == null) tasks = List.of();

        for (int i = 0; i < taskInfoPanels.size(); i++) {
            JPanel panel = taskInfoPanels.get(i);
            panel.removeAll();

            if (i < tasks.size()) {
                TaskDTO task = tasks.get(i);

                panel.setLayout(new GridBagLayout());
                panel.setBorder(BorderFactory.createEmptyBorder(10, 10, 10, 10));
                panel.setBackground(CARD_HI);
                panel.setBorder(BorderFactory.createCompoundBorder(
                        BorderFactory.createLineBorder(new Color(0xE2D9D0), 1),
                        BorderFactory.createEmptyBorder(10, 10, 10, 10)));

                GridBagConstraints gbc = new GridBagConstraints();
                gbc.insets = new Insets(4, 6, 4, 6);
                gbc.anchor = GridBagConstraints.WEST;

                gbc.gridx = 0;
                gbc.gridy = 0;
                gbc.gridwidth = 2;
                gbc.fill = GridBagConstraints.HORIZONTAL;
                JLabel dueTopLabel = new JLabel(task.getDueInText(), SwingConstants.CENTER);
                dueTopLabel.setFont(new Font("Helvetica Neue",Font.BOLD, 26));
                dueTopLabel.setForeground(ACCENT_COLOR);
                dueTopLabel.setHorizontalAlignment(SwingConstants.CENTER);
                panel.add(dueTopLabel, gbc);

                gbc.gridy++;
                gbc.gridx = 0;
                gbc.gridwidth = 1;
                gbc.fill = GridBagConstraints.NONE;

                JLabel nameLabel = new JLabel("Task Name:");
                nameLabel.setForeground(TEXT_LIGHT);
                nameLabel.setFont(new Font("Helvetica Neue",Font.BOLD, 18));
                panel.add(nameLabel, gbc);

                gbc.gridy++;
                JLabel courseLabel = new JLabel("Course:");
                courseLabel.setForeground(TEXT_LIGHT);
                courseLabel.setFont(new Font("Helvetica Neue",Font.BOLD, 18));
                panel.add(courseLabel, gbc);

                gbc.gridy++;
                JLabel descLabel = new JLabel("Description:");
                descLabel.setForeground(TEXT_LIGHT);
                descLabel.setFont(new Font("Helvetica Neue",Font.BOLD, 18));
                panel.add(descLabel, gbc);

                gbc.gridy++;
                JLabel dueDateLabel = new JLabel("Due Date:");
                dueDateLabel.setForeground(TEXT_LIGHT);
                dueDateLabel.setFont(new Font("Helvetica Neue",Font.BOLD, 18));
                panel.add(dueDateLabel, gbc);

                gbc.gridx = 1;
                gbc.gridy = 1;
                JLabel nameValue = new JLabel(task.getTaskName());
                nameValue.setForeground(TEXT_LIGHT);
                nameValue.setFont(new Font("Helvetica Neue",Font.PLAIN, 18));
                panel.add(nameValue, gbc);

                gbc.gridy++;
                JLabel courseValue = new JLabel(task.getCourse());
                courseValue.setForeground(ACCENT_COLOR);
                courseValue.setFont(new Font("Helvetica Neue",Font.PLAIN, 18));
                panel.add(courseValue, gbc);

                gbc.gridy++;
                JLabel descValue = new JLabel(task.getDescription() != null ? task.getDescription() : "-");
                descValue.setForeground(TEXT_LIGHT);
                descValue.setFont(new Font("Helvetica Neue",Font.PLAIN, 18));
                panel.add(descValue, gbc);

                gbc.gridy++;
                JLabel dueDateValue = new JLabel(task.getFormattedDueDate());
                dueDateValue.setForeground(TEXT_LIGHT);
                dueDateValue.setFont(new Font("Helvetica Neue",Font.PLAIN, 18));
                panel.add(dueDateValue, gbc);

            } else {
                panel.setLayout(new GridBagLayout());
                panel.setBorder(BorderFactory.createLineBorder(new Color(0xE2D9D0), 1));
                panel.setBackground(CARD);

                JLabel emptyLabel = new JLabel("No more tasks due soon", SwingConstants.CENTER);
                emptyLabel.setForeground(TEXT_SEC);
                emptyLabel.setFont(new Font("Helvetica Neue",Font.PLAIN, 18));
                panel.add(emptyLabel);
            }

            panel.revalidate();
            panel.repaint();
        }
    }

    public void setUsername(String username) {
        this.welcomeLabel.setText("Welcome, " + username + "!");
    }

    /**
     * Called when the ViewModel reports a quote change.
     * Accepts HTML so we can format the text nicely.
     */
    public void setQuoteText(String text) {
        this.quoteLabel.setText(text);
    }

    private JPanel createPlaceholderPanel() {
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBackground(CARD);

        JLabel placeholderLabel = new JLabel("Stopwatch", SwingConstants.CENTER);
        placeholderLabel.setFont(new Font("Helvetica Neue",Font.BOLD, 22));
        placeholderLabel.setForeground(TEXT_LIGHT);
        panel.add(placeholderLabel, BorderLayout.NORTH);

        stopwatchLabel = new JLabel("00:00:00", SwingConstants.CENTER);
        stopwatchLabel.setFont(new Font("Helvetica Neue",Font.BOLD, 26));
        stopwatchLabel.setForeground(ACCENT_COLOR);
        panel.add(stopwatchLabel, BorderLayout.CENTER);

        JPanel buttonPanel = new JPanel();
        buttonPanel.setBackground(CARD);
        JButton startBtn = new JButton("Start");
        JButton stopBtn = new JButton("Stop");
        JButton resetBtn = new JButton("Reset");

        startBtn.addActionListener(e -> stopwatchController.start());
        stopBtn.addActionListener(e -> stopwatchController.stop());
        resetBtn.addActionListener(e -> stopwatchController.reset());

        buttonPanel.add(startBtn);
        buttonPanel.add(stopBtn);
        buttonPanel.add(resetBtn);
        panel.add(buttonPanel, BorderLayout.SOUTH);

        return panel;
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if ("dueSoonTasks".equals(evt.getPropertyName())) {
            @SuppressWarnings("unchecked")
            List<TaskDTO> tasks = (List<TaskDTO>) evt.getNewValue();
            updateTaskPanels(tasks);
        }
        else if ("stopwatchText".equals(evt.getPropertyName())) {
            String timeText = (String) evt.getNewValue();
            if (stopwatchLabel != null) {
                stopwatchLabel.setText(timeText);
            }
        }
        else if (QuoteViewModel.QUOTE_TEXT.equals(evt.getPropertyName())) {
            String quoteHtml = (String) evt.getNewValue();
            setQuoteText(quoteHtml);
        }
    }
}
