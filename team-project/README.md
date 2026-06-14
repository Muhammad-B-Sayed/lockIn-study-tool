# LockIn

A desktop productivity app for students built with Java Swing, following Clean Architecture principles.

---

## Features

### Authentication
- Sign up with a username and password
- Log in / log out with persistent user sessions
- Change password from the dashboard
- Delete account — permanently removes your account and all associated tasks

### Home Dashboard
- "Due Soon" panel showing your three most upcoming tasks at a glance
- Built-in stopwatch (Start / Stop / Reset)
- Rotating inspirational quotes powered by the [DummyJSON Quotes API](https://dummyjson.com/quotes)

### Task Manager
- Add, edit, and delete tasks with a title, course, description, due date, and completion status
- Sort tasks by due date or course (click the active sort button again to restore the original order)
- Tasks persist across sessions via a local CSV file

### Calendar
- Visual monthly calendar view
- Tasks are automatically synced to the calendar on login
- Add events manually and mark tasks as completed

---

## Architecture

The project follows **Clean Architecture**, separating concerns across four layers:

```
app/                    Entry point and dependency wiring (AppBuilder, Main)
entity/                 Core domain objects (User, Task, Event, Quote)
usecase/                Business logic — interactors and input/output boundaries
interfaceadapter/       Controllers, presenters, view models
dataaccess/             File-based and in-memory data access objects
view/                   Java Swing UI panels and views
```

Each use case is fully decoupled — the UI layer never touches the data layer directly.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI | Java Swing |
| Build | Maven |
| Persistence | CSV files (`users.csv`, `tasks.csv`) |
| Quotes API | [DummyJSON](https://dummyjson.com/quotes/random) |
| Password hashing | jBCrypt |
| JSON parsing | org.json |
| HTTP client | OkHttp3 |
| Testing | JUnit 5 |

---

## Getting Started

### Prerequisites
- Java 17+
- Maven

### Run

```bash
git clone https://github.com/Raiyaan2005/lockin-app.git
cd lockin-app
mvn compile exec:java -Dexec.mainClass="app.Main"
```

Or open the project in IntelliJ IDEA and run `app.Main`.

### Build

```bash
mvn package
```

---

## User Stories

**Home Page** *(Raiyaan)*
- As a user, I want to see my three most due-soon tasks on the home page so I know what to prioritize.
- As a user, I want a built-in stopwatch to time my study sessions.

**Task Manager** *(Ella)*
- As a user, I want to see all my tasks in one place so I can understand my workload.
- As a user, I want to add tasks with a due date, course, and description so I can stay organised.
- As a user, I want to add, edit, and remove tasks so I can keep my list up to date.
- As a user, I want to sort tasks by course or due date so I can prioritise my work.

**Calendar** *(Angel)*
- As a user, I want to view my tasks on a monthly calendar so I can see upcoming deadlines visually.
- As a user, I want tasks added in the Task Manager to appear on the calendar automatically.

**Login / Logout** *(Zen)*
- As a user, I want to sign up and log in/out so my data is private to me.
- As a user, I want my tasks and calendar to be saved between sessions so I don't lose my schedule.

---

## Data Storage

User credentials are stored in `users.csv` and tasks in `tasks.csv` in the working directory. Both files are created automatically on first run.
