package view;

import entity.Event;
import interfaceadapter.calendar.CalendarController;
import interfaceadapter.calendar.CalendarViewModel;

import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.time.*;
import java.util.List;

public class CalendarPanel extends JPanel implements PropertyChangeListener {

    private static final Color CAL_BG        = new Color(0xFAF8F5);
    private static final Color CAL_CELL      = new Color(0xFFFFFF);
    private static final Color CAL_HEADER    = new Color(0xF0EBE4);
    private static final Color CAL_BORDER    = new Color(0xE2D9D0);
    private static final Color CAL_TEXT      = new Color(0x1C1917);
    private static final Color CAL_MUTED     = new Color(0x78716C);
    private static final Color CAL_ACCENT    = new Color(0x3B82F6);
    private static final Color CAL_COMPLETE  = new Color(0x16A34A);

    // These are set from Main before the DashboardView is created
    public static CalendarViewModel sharedViewModel;
    public static CalendarController sharedCalendarController;

    private final CalendarController controller;
    private final CalendarViewModel viewModel;

    private final JLabel monthLabel = new JLabel("", SwingConstants.CENTER);
    private final JPanel grid = new JPanel(new GridLayout(7, 7, 1, 1));
    private YearMonth current = YearMonth.now();

    public CalendarPanel() {
        this(sharedCalendarController, sharedViewModel);
    }

    public CalendarPanel(CalendarController controller, CalendarViewModel viewModel) {
        this.controller = controller;
        this.viewModel = viewModel;

        if (this.viewModel != null) {
            this.viewModel.addPropertyChangeListener(this);
        }

        setLayout(new BorderLayout());
        setBackground(CAL_BG);
        setBorder(new EmptyBorder(16, 16, 16, 16));

        JButton addEventBtn = new JButton("Add Event");
        addEventBtn.setBackground(CAL_ACCENT);
        addEventBtn.setForeground(Color.WHITE);
        addEventBtn.setFont(addEventBtn.getFont().deriveFont(Font.BOLD));
        addEventBtn.setBorderPainted(false);
        addEventBtn.setFocusPainted(false);
        addEventBtn.setOpaque(true);
        addEventBtn.addActionListener(this::openAddDialog);

        JButton prev = new JButton("<");
        JButton next = new JButton(">");
        styleNavButton(prev);
        styleNavButton(next);

        prev.addActionListener(e -> {
            current = current.minusMonths(1);
            refresh();
        });

        next.addActionListener(e -> {
            current = current.plusMonths(1);
            refresh();
        });

        JPanel left = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
        left.setOpaque(false);
        left.add(addEventBtn);

        monthLabel.setFont(monthLabel.getFont().deriveFont(Font.BOLD, 18f));
        monthLabel.setForeground(CAL_TEXT);

        JPanel center = new JPanel(new FlowLayout(FlowLayout.CENTER, 0, 0));
        center.add(monthLabel);

        JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT, 8, 0));
        right.setOpaque(false);
        right.add(prev);
        right.add(next);

        JPanel top = new JPanel(new BorderLayout());
        top.setBackground(CAL_BG);
        top.add(left, BorderLayout.WEST);
        top.add(center, BorderLayout.CENTER);
        top.add(right, BorderLayout.EAST);

        add(top, BorderLayout.NORTH);
        add(grid, BorderLayout.CENTER);

        controller.viewCalendar();

        refresh();
    }

    private void openAddDialog(ActionEvent e) {
        if (controller == null) {
            JOptionPane.showMessageDialog(
                    this,
                    "Calendar is not wired correctly (controller is null). " +
                            "Make sure Main creates a real CalendarController and assigns\n" +
                            "CalendarPanel.sharedCalendarController before creating DashboardView.",
                    "Error",
                    JOptionPane.ERROR_MESSAGE
            );
            return;
        }

        JDialog dlg = new JDialog(SwingUtilities.getWindowAncestor(this),
                "Add Event", Dialog.ModalityType.APPLICATION_MODAL);
        dlg.setLayout(new GridBagLayout());
        GridBagConstraints c = new GridBagConstraints();
        c.insets = new Insets(6, 6, 6, 6);
        c.fill = GridBagConstraints.HORIZONTAL;
        c.gridx = 0;
        c.gridy = 0;

        dlg.add(new JLabel("Event name:"), c);
        c.gridx = 1;
        JTextField nameField = new JTextField(16);
        dlg.add(nameField, c);

        c.gridx = 0;
        c.gridy++;
        dlg.add(new JLabel("Date (YYYY-MM-DD):"), c);
        c.gridx = 1;
        JTextField dateField = new JTextField(current.atDay(1).toString(), 16);
        dlg.add(dateField, c);

        c.gridx = 0;
        c.gridy++;
        dlg.add(new JLabel("Colour:"), c);

        c.gridx = 1;
        // Use your existing ColorSwatchPicker class
        ColorSwatchPicker colorPicker = new ColorSwatchPicker(Color.BLUE);
        dlg.add(colorPicker, c);

        c.gridx = 0;
        c.gridy++;
        c.gridwidth = 2;
        JPanel btnRow = new JPanel(new FlowLayout(FlowLayout.RIGHT, 10, 0));
        JButton cancel = new JButton("Cancel");
        JButton add = new JButton("Add");
        btnRow.add(cancel);
        btnRow.add(add);
        dlg.add(btnRow, c);

        cancel.addActionListener(ev -> dlg.dispose());

        add.addActionListener(ev -> {
            try {
                String name = nameField.getText().trim();
                LocalDate date = LocalDate.parse(dateField.getText().trim());
                Color color = colorPicker.getSelectedColor();
                controller.addEvent(name, date, color);
                dlg.dispose();
            } catch (Exception ex) {
                JOptionPane.showMessageDialog(
                        dlg,
                        "Invalid input: " + ex.getMessage(),
                        "Error",
                        JOptionPane.ERROR_MESSAGE
                );
            }
        });

        dlg.pack();
        dlg.setLocationRelativeTo(this);
        dlg.setVisible(true);
    }

    private void styleNavButton(JButton btn) {
        btn.setBackground(new Color(0xEDE8E3));
        btn.setForeground(CAL_TEXT);
        btn.setBorderPainted(false);
        btn.setFocusPainted(false);
        btn.setOpaque(true);
        btn.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
    }

    private void refresh() {
        String monthName = current.getMonth().toString();
        monthName = monthName.substring(0, 1) + monthName.substring(1).toLowerCase();
        monthLabel.setText(monthName + " " + current.getYear());

        grid.setBackground(CAL_BG);
        grid.removeAll();

        DayOfWeek[] order = {
                DayOfWeek.SUNDAY,
                DayOfWeek.MONDAY,
                DayOfWeek.TUESDAY,
                DayOfWeek.WEDNESDAY,
                DayOfWeek.THURSDAY,
                DayOfWeek.FRIDAY,
                DayOfWeek.SATURDAY
        };

        for (DayOfWeek d : order) {
            JLabel l = new JLabel(d.name().substring(0, 3), SwingConstants.CENTER);
            l.setOpaque(true);
            l.setBackground(CAL_HEADER);
            l.setForeground(CAL_MUTED);
            l.setFont(l.getFont().deriveFont(Font.BOLD));
            l.setBorder(BorderFactory.createLineBorder(CAL_BORDER));
            grid.add(l);
        }

        LocalDate first = current.atDay(1);
        int startCol = first.getDayOfWeek().getValue() % 7;
        int days = current.lengthOfMonth();

        for (int i = 0; i < 42; i++) {
            if (i < startCol || i >= startCol + days) {
                grid.add(dayCell("", null));
            } else {
                int d = i - startCol + 1;
                LocalDate date = current.atDay(d);

                List<Event> events = null;
                if (viewModel != null) {
                    events = viewModel.eventsOn(date);
                }

                grid.add(dayCell(String.valueOf(d), events));
            }
        }

        revalidate();
        repaint();
    }

    private JPanel dayCell(String dayText, List<Event> events) {
        JPanel p = new JPanel(new BorderLayout());
        p.setBackground(CAL_CELL);
        p.setBorder(BorderFactory.createLineBorder(CAL_BORDER));

        JLabel day = new JLabel(dayText);
        day.setForeground(CAL_TEXT);
        day.setBorder(new EmptyBorder(4, 6, 0, 0));
        p.add(day, BorderLayout.NORTH);

        if (events != null && !events.isEmpty()) {
            JPanel list = new JPanel();
            list.setOpaque(false);
            list.setLayout(new BoxLayout(list, BoxLayout.Y_AXIS));
            for (Event e : events) {
                Color displayColor = e.isCompleted() ? CAL_COMPLETE : e.getColor();
                String prefix = e.isCompleted() ? "✓ " : "• ";
                JLabel l = new JLabel(prefix + e.getName());
                l.setForeground(displayColor);
                l.setFont(l.getFont().deriveFont(15f));
                l.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
                l.addMouseListener(new MouseAdapter() {
                    @Override
                    public void mouseClicked(MouseEvent ev) {
                        showEventDetail(e);
                    }
                    @Override
                    public void mouseEntered(MouseEvent ev) {
                        l.setText("<html><u>" + prefix + e.getName() + "</u></html>");
                    }
                    @Override
                    public void mouseExited(MouseEvent ev) {
                        l.setText(prefix + e.getName());
                    }
                });
                list.add(l);
            }
            p.add(list, BorderLayout.CENTER);
        }
        return p;
    }

    private void showEventDetail(Event event) {
        JDialog dlg = new JDialog(SwingUtilities.getWindowAncestor(this),
                "Event Details", Dialog.ModalityType.APPLICATION_MODAL);
        dlg.setLayout(new BorderLayout());

        JPanel content = new JPanel(new GridBagLayout());
        content.setBorder(BorderFactory.createEmptyBorder(20, 24, 12, 24));
        GridBagConstraints c = new GridBagConstraints();
        c.anchor = GridBagConstraints.WEST;
        c.insets = new Insets(4, 0, 4, 12);

        // Color swatch + name header
        JPanel header = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
        header.setOpaque(false);
        JPanel swatch = new JPanel() {
            @Override public Dimension getPreferredSize() { return new Dimension(14, 14); }
            @Override protected void paintComponent(Graphics g) {
                g.setColor(event.getColor());
                g.fillRoundRect(0, 0, getWidth(), getHeight(), 6, 6);
            }
        };
        swatch.setOpaque(false);
        JLabel nameLabel = new JLabel(event.getName());
        nameLabel.setFont(nameLabel.getFont().deriveFont(Font.BOLD, 16f));
        header.add(swatch);
        header.add(nameLabel);

        c.gridx = 0; c.gridy = 0; c.gridwidth = 2;
        content.add(header, c);

        c.gridy++; c.gridwidth = 1;
        JLabel dateKey = new JLabel("Date:");
        dateKey.setFont(dateKey.getFont().deriveFont(Font.BOLD));
        dateKey.setForeground(CAL_MUTED);
        content.add(dateKey, c);

        c.gridx = 1;
        content.add(new JLabel(event.getDate().toString()), c);

        c.gridx = 0; c.gridy++;
        JLabel statusKey = new JLabel("Status:");
        statusKey.setFont(statusKey.getFont().deriveFont(Font.BOLD));
        statusKey.setForeground(CAL_MUTED);
        content.add(statusKey, c);

        c.gridx = 1;
        if (event.isCompleted()) {
            JLabel completedBadge = new JLabel("✓ Completed");
            completedBadge.setForeground(CAL_COMPLETE);
            completedBadge.setFont(completedBadge.getFont().deriveFont(Font.BOLD));
            content.add(completedBadge, c);
        } else {
            content.add(new JLabel("In progress"), c);
        }

        dlg.add(content, BorderLayout.CENTER);

        JPanel btnRow = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        JButton close = new JButton("Close");
        close.addActionListener(ev -> dlg.dispose());
        btnRow.add(close);
        dlg.add(btnRow, BorderLayout.SOUTH);

        dlg.pack();
        dlg.setResizable(false);
        dlg.setLocationRelativeTo(this);
        dlg.setVisible(true);
    }

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        if (CalendarViewModel.EVENTS_CHANGED.equals(evt.getPropertyName())) {
            refresh();
        }
    }
}
