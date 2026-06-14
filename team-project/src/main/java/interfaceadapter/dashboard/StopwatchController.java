package interfaceadapter.dashboard;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.Timer; // Swing Timer is fine in Interface Adapters for Swing apps

public class StopwatchController {

    private final DashboardViewModel viewModel;
    private final Timer timer;
    private int elapsedSeconds = 0;

    public StopwatchController(DashboardViewModel viewModel) {
        this.viewModel = viewModel;

        this.timer = new Timer(1000, new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                tick();
            }
        });
    }

    public void start() {
        if (!timer.isRunning()) {
            timer.start();
        }
    }

    public void stop() {
        if (timer.isRunning()) {
            timer.stop();
        }
    }

    public void reset() {
        timer.stop();
        elapsedSeconds = 0;
        updateViewModel();
    }

    private void tick() {
        elapsedSeconds++;
        updateViewModel();
    }

    private void updateViewModel() {
        int hours = elapsedSeconds / 3600;
        int minutes = (elapsedSeconds % 3600) / 60;
        int seconds = elapsedSeconds % 60;

        String formatted = String.format("%02d:%02d:%02d", hours, minutes, seconds);

        viewModel.setStopwatchText(formatted);
    }
}