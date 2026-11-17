# Polish sprint handoff

Written at 2:19 AM Toronto time on 2026-11-17 by the lead agent. Read this if you are taking over the sprint. Delete this file before the branch merges.

## Status at 2:30 AM (read this first)

Both delegates died on a 429 rate limit at about 2:21 AM. The `claudeAgent_hub_mdude` account resets around 6:50 AM. They were not restarted. A new lead (Claude Opus 5.5 on the `claudeAgent_hub_outlook` account, started by the owner) took over at 2:22 AM and did the remaining work directly, with no delegates.

What the new lead did:

- Recovered the delegates' half-done round 2 work. It typechecked, so it was kept and committed as `3f0bf55`. It contains:
  - import now completes a course that a failed earlier import left half-done, with two new tests
  - dialogs ask "Discard what you typed?" on Escape or a backdrop click after typing
  - phones get an account menu in the top bar
  - colour swatches have readable names
  - the running Focus screen says "Back"
- Fixed a bug in that guard: a dialog closed by Cancel or Save could reopen with the question still showing.
- Calendar page: an "Export .ics" button in the legend row (`src/features/useExportCalendar.ts`, shared with Settings).
- Command palette: searching also matches topic notes and summaries, marked "Matches your notes". Settings is found by "import", "ics", "goal" and "break".
- Today: deadline titles open the edit dialog, as they do on a course page.
- Today, desktop: Rhythm moved under This term, so the two columns are balanced. The phone order is unchanged.
- Grade panel: shows "No scores yet" instead of a large "--%" placeholder.
- Topic page: "Log time" sits under the focused total, and sessions with no note say "Study session".
- `scripts/screens.mjs`: a `dialog-guard` state.

Checked at 2:29 AM on `2a6f5e5`:

- `npx tsc -b`, `npx eslint .` and `npx vitest run` pass, 513 of 513.
- The production build passes, since the screenshot script builds it.

Screenshots viewed by the new lead, most after the changes:

| Screen | Width | Theme |
|---|---|---|
| today | 390 and 1440 | dark and light |
| course | 390 and 1440 | dark and light |
| focus, focus-running | 390 | dark |
| settings | 390 | dark |
| calendar | 390 and 1440 | light |
| topic | 390 and 1440 | dark |
| dialog-guard | 390 | light |

Not done from round 2: the 8-week trend. Rhythm already shows 21 days, so it was dropped as redundant.

## What the owner asked for

A time-boxed sprint on the LockIn study tool, from about 1:30 AM to 2:45 AM Toronto time. Make as many impactful changes as possible in two areas: features and functionality, and UI/UX. The owner called the existing UI "really dumb UI mistakes" and "non-standard, super unprofessional" without listing specifics.

The owner's rules:

- Two delegates on Fable 5.2 at High effort, one for UI/UX and one for features. The lead manages them.
- Skip extensive testing and new unit tests. Speed matters more.
- The lead may make its own decisions as long as they are not risky.
- 2:45 AM: switch from building to wrapping up. 2:50 AM: finish. 2:53 AM: hard stop.
- The owner did not ask for a push or a pull request. Do not push or open one without asking.

If you pick this up after 2:53 AM, the time box is over. Do not start new feature or UI work. Do the wrap-up steps below, report to the owner, and ask what they want next.

## Where the work is

- Repo: `/Users/muhammad/Documents/Codex/2026-11-06/https-lock-in-study-tool-vercel/work/lockIn-study-tool`
- Branch: `feature/polish-sprint`, cut from `main` at `6653ed0`. Local only. Nothing is pushed.
- Checkpoint commits so far: `db28744`, `7b544ac`, `d791bd4`. Run `git log --oneline 6653ed0..HEAD` for the current list.
- All changes are in `frontend/`. The backend and the data contract in `frontend/src/lib/data/types.ts` are unchanged, on purpose. A stored-field change needs a Java change, a Flyway migration and both adapters.

## The delegates

Both run in the lead's checkout, not in worktrees, to avoid a merge under deadline and to save RAM on an 8 GB machine. Each owns separate files and edits with targeted replacements only. Neither commits. The lead commits checkpoints.

UI/UX delegate

- Thread id: `thread:delegated-task:command%3Amcp%3A16556f68-fcc0-4fec-b617-521d93106cb9%3Adelegate-task%3A688528bb-c723-4c59-af55-9e8248b99968`
- Owns all existing `*.css`, `src/styles/`, `src/shell/`, `src/ui/`, and the layout, markup and copy of pages.
- Round 1 finished at 2:16 AM with about 35 fixes. Its full report is in the thread.
- Round 2 started at 2:18 AM. Its list, in order: guard dialogs against losing unsaved input on Escape or backdrop click, the Focus exit label on phones, a way to sign out on phones, Calendar's page width, the colour picker's labels and tap targets, a touch hint on deadline titles. It also reviews the new feature screens for layout problems.

Features delegate

- Thread id: `thread:delegated-task:command%3Amcp%3A16556f68-fcc0-4fec-b617-521d93106cb9%3Adelegate-task%3A32be2a45-a4df-45a0-82e8-36d330b549c6`
- Owns `src/lib/`, `src/app/`, and new components under `src/features/` with their own CSS files.
- Round 1 finished at 2:19 AM with 15 features. Round 2 started at 2:20 AM.

Both were told: build until 2:36 AM, start nothing new after that, send the final report by 2:42 AM. Read a delegate's report with `t3_thread_read` on its thread id. Continue one with `t3_thread_send` to the same thread, which keeps its context. Do not poll a running delegate. Its completion wakes the lead.

## What has shipped so far

Features, round 1, finished at 2:19 AM. All 15 are mounted and committed. The full report is in the delegate's thread.

- Today: a "This week" panel with study time against last week, time per course, a per-device daily goal, a streak reminder, manual "Log time", and a two-week session log with remove and undo (`src/features/WeekPanel.tsx`, `src/lib/domain/stats.ts`, `src/app/prefs.ts`).
- Topic: session notes from past check-ins, and "Log time" (`TopicSessions`, `LogTimeButton` in `WeekPanel.tsx`).
- Course: a grades panel with weighted average and the average needed for a target (`GradesPanel.tsx`, `src/lib/domain/grades.ts`, `src/app/scores.ts`), a test countdown card (`ExamReadiness.tsx`), and "move topic dates a week" with undo in the More options menu (`useShiftDates.ts`).
- Settings: JSON import and calendar `.ics` export (`DataTools.tsx`, `src/lib/data/backup.ts`, `src/lib/domain/ics.ts`), break length, daily goal.
- Focus: breaks with a countdown pill that follows you across pages, a tab-title countdown and chime off the Focus page (`FocusCompanion.tsx`, `src/app/breakStore.ts`), and a custom session length from 5 to 240 minutes (`FocusLength.tsx`).
- Undo when deleting a deadline, an event or a topic (`useDeleteTopic.ts`, `forms.tsx`, `actions.tsx`).
- Keyboard: `g` then `t`, `r`, `c`, `o`, `f` or `s` to change page (`src/app/useGoToKeys.ts`).

Features, round 2, started at 2:20 AM. Its list, in order: make an import retry add the topics a half-imported course is missing, an "Export calendar" action on the Calendar page, an 8-week study trend in the This week panel.

Limits the features delegate reported:

- Nothing it built was viewed in a browser. Look first at the custom length field on Focus setup and the break pill position, at 390px.
- Import in account mode was not run against the live backend. It sends requests one at a time.
- Import leaves out rating history, because the API cannot create past reviews. Topic undo has the same gap and cannot restore sessions older than 120 days.
- Scores, grade targets, daily goal, break length and focus length live in localStorage, per device.

The lead read `backup.ts` for data safety. The import only adds. It validates every record before writing, skips records that already exist, and never replaces or deletes.

UI/UX, round 1. The full list is in the delegate's thread. The main ones:

- Each page sets its own browser tab title.
- Review and Settings share the left edge of the other pages.
- Loading placeholders on Review, Calendar, Course and Topic.
- Dragging a text selection out of a dialog no longer closes it.
- 44px touch targets on phone for the top bar, dialog buttons and deadline checkboxes.
- Delete topic, delete deadline and discard focus session now confirm. Removing a material has undo.
- Form errors appear under the field they belong to, and a failed submit focuses the first invalid field.
- Theme setting has System, Light and Dark.
- Singular and plural counts read correctly.
- The landing page's Sign in button uses the primary style. The owner may want this reverted, since the landing page now has two primary buttons.

## Known state at 2:19 AM

- At 2:20 AM, run by the lead on commit `d791bd4`: `npx tsc -b` passes, `npx eslint .` passes, `npx vitest run` passes 510 of 510.
- No production build (`npm run build`) has been run yet.
- The lead changed one test, `src/__tests__/navigation.integration.test.tsx`, because the deadline title now appears in three places on a course page.
- The UI/UX delegate added three screenshot states to `frontend/scripts/screens.mjs`: `delete-topic`, `edit-deadline`, `reset-demo`.
- Checked by code reading only, not in a browser: the Focus discard step, the event dialog changes, the loading placeholders, the tab titles, the dialog drag fix, the password error rows.
- Nobody has looked at the new feature screens in a browser yet. Round 2 of the UI/UX delegate is meant to.

## Risks

- Rate limit. Both delegates and the lead run on the same account (`claudeAgent_hub_mdude`, model `mdude/claude-fable-5-2`). Both delegates died on a 429 at 1:58 AM with a reset about three hours out, then worked again when restarted at 2:00 AM. It can happen again. Two other accounts offer Fable 5.2 (`claudeAgent_hub_gmail`, `claudeAgent_hub_outlook`). The owner has not approved moving work to them. Ask first.
- A delegate that dies mid-edit can leave a file half-changed. Run `npx tsc -b` before trusting the tree. If it fails and the delegate is dead, fix the error or run `git diff` on that file and revert the broken region by hand.
- Memory. One Playwright or dev-server process at a time. Something unrelated listens on ports 5176 and 8080. Leave it alone.

## Wrap-up steps

Do these in order once both delegates have reported, or at 2:42 AM, whichever comes first.

1. If a delegate is still running at 2:42 AM, send it a message to stop and report. If it has not stopped by 2:45 AM, cancel its task with `task_cancel`.
2. In `frontend/`, run `npx tsc -b`, then `npx eslint .`, then `npx vitest run --maxWorkers=2`.
3. Fix failures that are small. If a feature cannot be fixed in a few minutes, unmount it from its page and say so in the report. Do not leave the branch failing.
4. Run `npm run build` once to confirm the production build.
5. Commit with a real message. The checkpoint commits can stay as they are, or be squashed if the owner wants one commit.
6. Delete this file, or leave it and tell the owner it is there.
7. Report to the owner: what shipped by area, what was checked and how, what was not checked in a browser, what is left, and the open decisions below.

## Open decisions for the owner

- Push the branch and open a pull request, or keep it local.
- Keep or revert the primary-style Sign in button on the landing page.
- Whether to move delegates to another account if the rate limit returns.

## Not done, ranked

From the UI/UX delegate's round 1 report, minus what round 2 was given:

1. "Leave demo" and "Sign out" in the account menu act with no confirmation.
2. Deadlines on Today cannot be edited from there.

From the features delegate's round 1 report, minus what round 2 was given:

1. Multi-select on the course topic list, to rate, date or delete several at once.
2. Store grade scores in the account so they follow the user across devices. Needs a backend field and a migration.
3. Command palette search across notes and deadlines.
4. Pomodoro cycles, with breaks that start on their own.
5. Rating history in imports. Needs a new backend endpoint.
