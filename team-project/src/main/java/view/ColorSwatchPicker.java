package view;

import javax.swing.*;
import javax.swing.border.LineBorder;
import java.awt.*;
import java.util.List;
import javax.swing.JComponent;

public class ColorSwatchPicker extends JPanel {
    private final JPanel swatchPanel = new JPanel(new GridLayout(2, 6, 8, 8)); // 12 per page
    private final JButton prevBtn = new JButton("Prev");
    private final JButton nextBtn = new JButton("Next");

    private final List<List<Color>> pages;
    private int pageIndex = 0;
    private Color selected;

    public ColorSwatchPicker(Color initial) {
        setLayout(new BorderLayout(8, 8));
        this.pages = ColorPalettes.pages(12);
        this.selected = initial;

        JPanel top = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        top.add(new JLabel("Colour:"));
        add(top, BorderLayout.NORTH);

        add(swatchPanel, BorderLayout.CENTER);

        JPanel nav = new JPanel(new FlowLayout(FlowLayout.RIGHT, 8, 0));
        nav.add(prevBtn); nav.add(nextBtn);
        add(nav, BorderLayout.SOUTH);

        prevBtn.addActionListener(e -> { if (pageIndex > 0) { pageIndex--; renderPage(); } });
        nextBtn.addActionListener(e -> { if (pageIndex < pages.size() - 1) { pageIndex++; renderPage(); } });

        renderPage();
    }

    public Color getSelectedColor() { return selected; }

    private void renderPage() {
        swatchPanel.removeAll();
        List<Color> page = pages.get(pageIndex);

        for (Color c : page) {
            JToggleButton swatch = buildSwatch(c);
            if (c.equals(selected)) swatch.setSelected(true);
            swatchPanel.add(swatch);
        }

        prevBtn.setEnabled(pageIndex > 0);
        nextBtn.setEnabled(pageIndex < pages.size() - 1);

        revalidate(); repaint();
    }

    private JToggleButton buildSwatch(Color c) {
        JToggleButton b = new JToggleButton();
        b.setPreferredSize(new Dimension(28, 28));
        b.setBackground(c);
        b.setOpaque(true);
        b.setBorder(new LineBorder(new Color(220,220,220)));
        b.setFocusPainted(false);

        b.addChangeListener(e -> {
            if (b.isSelected()) {
                selected = c;

                for (Component comp : swatchPanel.getComponents()) {
                    if (comp instanceof JToggleButton) {
                        JToggleButton sw = (JToggleButton) comp;
                        sw.setSelected(sw == b);
                        ((JComponent) sw).setBorder(new LineBorder(new Color(220, 220, 220)));
                    }
                }

                ((JComponent) b).setBorder(new LineBorder(Color.BLACK, 3));

            } else {
                ((JComponent) b).setBorder(new LineBorder(new Color(220, 220, 220)));
            }
        });


        b.addActionListener(e -> b.setSelected(true));
        return b;
    }
}
