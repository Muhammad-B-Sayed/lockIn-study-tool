# Browser checks

Edit `screens.mjs` to change routes or interaction states for both commands. Each entry has `name`, `path`, an optional async `setup(page)`, and optional `signedOut` and screenshot-only `full` flags. Each combination uses fresh storage. Signed-in screens enter demo mode before navigation.

Run `npm run shots` for screenshots or `npm run a11y` for axe. Both build once, start a local Vite preview on a free port, and close Chromium and the preview on completion or interruption. Both accept `--only=name1,name2`, `--theme=dark|light|both`, `--width=1440|390|both`, and `--no-build`. Pass options after `--` when using npm.

The audit defaults to all configured screens, both themes and both widths. It runs `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, and `best-practice` checks without the screenshot runner's layout overrides. Before axe runs, audit-only CSS hides decorative grain, glow layers, cover and grid overlays, and modal backdrops so axe can measure the base colors. UI source files and screenshots keep those layers. It writes `.shots/a11y-summary.md` and `.shots/a11y-summary.json`.

Rules sort by impact. Counts deduplicate identical selectors within each rule across the run. Occurrences count the distinct screen/theme/width combinations for those selectors. Each rule prints at most three selectors with their contexts. Color contrast examples include axe's measured ratio and foreground/background colors when measurable, or explicit unavailable values otherwise. The JSON retains all affected selectors and contexts, failure details and affected HTML. Incomplete checks appear separately for review.

The contrast table groups confirmed failures by component class and theme, keeps the worst measured ratio in each group, and sorts the lowest ratio first. A component class takes priority over utility classes. Unclassed elements keep a structural selector. Markdown shows at most 25 rows; JSON retains all groups in `contrastFailures` with a representative screen and width.

The default audit is report-only and exits zero, including when a scan fails. Failed scans remain visible in the report. Add `--strict` to exit nonzero for confirmed violations or failed scans. Incomplete checks alone do not fail strict mode.

```sh
npm run a11y
npm run a11y -- --only=palette,import --theme=light --width=390 --no-build --strict
npm run shots -- --only=landing --no-build
```
