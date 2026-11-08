import AxeBuilder from '@axe-core/playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { AUDIT_TAGS, addScan, auditExitCode, createReport, formatSummary, summarize } from './a11y-report.mjs'
import { help, options, root, runScreens } from './preview.mjs'
import { screens } from './screens.mjs'

// Audit-only: remove decorative layers that prevent axe measuring the base colors.
const AUDIT_ONLY_CSS = `
  #root::before, .main::before, .course::before,
  .course-card__cover::after, .week__body::before,
  .focus__lamp, .landing__lamp,
  .dialog::backdrop, .palette::backdrop {
    display: none !important;
  }
`

if (process.argv.includes('--help')) help('a11y')
else {
  const report = createReport()
  let strict = process.argv.includes('--strict')
  let coverage = { completed: 0, attempted: 0, failures: [] }
  try {
    const config = options(process.argv.slice(2), { allowStrict: true })
    strict = config.strict
    coverage.attempted = screens.filter((screen) => !config.only || config.only.includes(screen.name)).length * config.themes.length * config.widths.length
    coverage = await runScreens(config, async ({ page, screen, theme, width, index, total }) => {
      // This affects only this isolated audit page, never the UI or screenshots.
      await page.addStyleTag({ content: AUDIT_ONLY_CSS })
      const results = await new AxeBuilder({ page }).withTags(AUDIT_TAGS).analyze()
      addScan(report, results, { screen: screen.name, theme, width })
      console.log(`[${index}/${total}] ${screen.name}/${theme}/${width}: ${results.violations.length} violation rules, ${results.incomplete.length} incomplete rules`)
    })
  } catch (error) {
    coverage.completed = report.scans.length
    coverage.failures.push({ screen: 'runner', theme: null, width: null, message: error.message })
    console.error(error.message)
  }
  const summary = summarize(report, coverage)
  summary.auditOnlyStyles = AUDIT_ONLY_CSS.trim()
  const markdown = formatSummary(summary)
  console.log(`\n${markdown}`)
  try {
    const directory = join(root, '.shots')
    await mkdir(directory, { recursive: true })
    const json = join(directory, 'a11y-summary.json')
    const md = join(directory, 'a11y-summary.md')
    await writeFile(json, JSON.stringify(summary, null, 2) + '\n')
    await writeFile(md, markdown)
    console.log(`Reports: ${json}\n${md}`)
  } catch (error) {
    summary.failures.push({ screen: 'report', message: error.message })
    console.error(`Could not save report: ${error.message}`)
  }
  // Report mode always succeeds. Strict mode also fails for incomplete coverage.
  process.exitCode = auditExitCode(strict, summary)
}
