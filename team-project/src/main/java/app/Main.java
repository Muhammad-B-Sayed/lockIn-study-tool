package app;

import javax.swing.*;

import dataaccess.InMemoryCalendarRepository;
import interfaceadapter.dashboard.DashboardViewModel;
import interfaceadapter.calendar.AddEventPresenter;
import interfaceadapter.calendar.CalendarController;
import interfaceadapter.calendar.CalendarViewModel;
import interfaceadapter.calendar.ViewCalendarPresenter;
import usecase.calendar.AddEventInputBoundary;
import usecase.calendar.AddEventInteractor;
import usecase.calendar.AddEventOutputBoundary;
import usecase.calendar.ViewCalendarInputBoundary;
import usecase.calendar.ViewCalendarInteractor;
import usecase.calendar.ViewCalendarOutputBoundary;
import view.CalendarPanel;
import interfaceadapter.sync_task.SyncTaskToCalendarController;
import interfaceadapter.sync_task.SyncTaskToCalendarPresenter;
import usecase.sync_task.SyncTaskToCalendarInputBoundary;
import usecase.sync_task.SyncTaskToCalendarInteractor;
import usecase.sync_task.SyncTaskToCalendarOutputBoundary;
import view.TasksPanel;


public class Main {
    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {

            InMemoryCalendarRepository repo = new InMemoryCalendarRepository();
            CalendarViewModel calendarViewModel = new CalendarViewModel(repo);
            DashboardViewModel dashboardViewModel = new DashboardViewModel();

            AddEventOutputBoundary addPresenter = new AddEventPresenter(calendarViewModel);
            AddEventInputBoundary addInteractor = new AddEventInteractor(repo, addPresenter);

            ViewCalendarOutputBoundary viewPresenter = new ViewCalendarPresenter(calendarViewModel);
            ViewCalendarInputBoundary viewInteractor = new ViewCalendarInteractor(viewPresenter);

            CalendarController calendarController =
                    new CalendarController(addInteractor, viewInteractor);

            CalendarPanel.sharedViewModel = calendarViewModel;
            CalendarPanel.sharedCalendarController = calendarController;

            SyncTaskToCalendarOutputBoundary syncPresenter = new SyncTaskToCalendarPresenter();
            SyncTaskToCalendarInputBoundary syncInteractor =
                    new SyncTaskToCalendarInteractor(calendarController, syncPresenter);
            SyncTaskToCalendarController syncController =
                    new SyncTaskToCalendarController(syncInteractor);

            TasksPanel.syncController = syncController;

            AppBuilder appBuilder = new AppBuilder();
            JFrame application = appBuilder
                    .addLoginView()
                    .addSignupView()
                    .addLoggedInView(dashboardViewModel)
                    .addSignupUseCase()
                    .addLoginUseCase()
                    .addChangePasswordUseCase()
                    .addLogoutUseCase()
                    .addDeleteAccountUseCase()
                    .build();

            application.pack();
            application.setLocationRelativeTo(null);
            application.setVisible(true);
        });
    }
}
