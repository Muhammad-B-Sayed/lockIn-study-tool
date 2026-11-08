const impacts = { critical: 4, serious: 3, moderate: 2, minor: 1 }

export const AUDIT_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']

export function createReport() {
  return { scans: [], violations: new Map(), incomplete: new Map() }
}

function collect(groups, rules, context) {
  for (const rule of rules) {
    if (!groups.has(rule.id)) groups.set(rule.id, { id: rule.id, impact: rule.impact, description: rule.help, helpUrl: rule.helpUrl, selectors: new Map() })
    const group = groups.get(rule.id)
    if ((impacts[rule.impact] ?? 0) > (impacts[group.impact] ?? 0)) group.impact = rule.impact
    for (const node of rule.nodes) {
      const key = JSON.stringify(node.target)
      if (!group.selectors.has(key)) group.selectors.set(key, { selector: node.target.map((part) => Array.isArray(part) ? part.join(' >> ') : part).join(' >> '), failureSummary: node.failureSummary, html: node.html, contexts: new Map() })
      const selector = group.selectors.get(key)
      const checks = [...node.any, ...node.all, ...node.none].filter((check) => check.id === 'color-contrast' && check.data)
      const contrast = checks.map(({ data, message }) => ({ ratio: data.contrastRatio ?? null, foreground: data.fgColor ?? null, background: data.bgColor ?? null, expected: data.expectedContrastRatio, reason: message }))
      selector.contexts.set(`${context.screen}/${context.theme}/${context.width}`, { ...context, contrast })
    }
  }
}

export function addScan(report, results, context) {
  report.scans.push({ ...context, violationRules: results.violations.length, incompleteRules: results.incomplete.length })
  collect(report.violations, results.violations, context)
  collect(report.incomplete, results.incomplete, context)
}

function examples(selectors) {
  const candidates = selectors.flatMap((entry) => entry.contexts.map((context) => ({ selector: entry.selector, failureSummary: entry.failureSummary, ...context })))
    .sort((a, b) => Math.min(...a.contrast.map((check) => check.ratio ?? Infinity)) - Math.min(...b.contrast.map((check) => check.ratio ?? Infinity)))
  const chosen = []
  const seenSelectors = new Set()
  const seenScreens = new Set()
  // Prefer examples from different screens before filling the remaining slots.
  for (const diverse of [true, false]) {
    for (const candidate of candidates) {
      if (chosen.length === 3) return chosen
      if (seenSelectors.has(candidate.selector) || (diverse && seenScreens.has(candidate.screen))) continue
      chosen.push(candidate)
      seenSelectors.add(candidate.selector)
      seenScreens.add(candidate.screen)
    }
  }
  return chosen
}

function serialize(groups) {
  return [...groups.values()].map((group) => {
    const selectors = [...group.selectors.values()].map((entry) => ({ selector: entry.selector, failureSummary: entry.failureSummary, html: entry.html, contexts: [...entry.contexts.values()] }))
    return { id: group.id, impact: group.impact, description: group.description, helpUrl: group.helpUrl,
      count: selectors.length, occurrences: selectors.reduce((sum, entry) => sum + entry.contexts.length, 0),
      examples: examples(selectors), selectors }
  }).sort((a, b) => (impacts[b.impact] ?? 0) - (impacts[a.impact] ?? 0) || a.id.localeCompare(b.id))
}

export function summarize(report, coverage) {
  const summary = { generatedAt: new Date().toISOString(), tags: AUDIT_TAGS, ...coverage,
    scans: report.scans, violations: serialize(report.violations), incomplete: serialize(report.incomplete) }
  return { ...summary, contrastFailures: groupContrastFailures(summary) }
}

function selectorClass(entry) {
  const openingTag = /^<[^>]+>/.exec(entry.html ?? '')?.[0] ?? ''
  const classes = /\bclass=["']([^"']*)["']/.exec(openingTag)?.[1].split(/\s+/).filter(Boolean) ?? []
  const component = classes.find((name) => name.includes('__') && !name.includes('--'))
    ?? classes.find((name) => !name.startsWith('t-') && !['tabular', 'sr-only'].includes(name) && !name.includes('--'))
    ?? classes[0]
  return component ? `.${component}` : entry.selector.replace(/:nth-(?:child|of-type)\(\d+\)/g, '')
}

/** One worst measured failure per component class and theme. */
export function groupContrastFailures(summary) {
  const groups = new Map()
  for (const entry of summary.violations.find((rule) => rule.id === 'color-contrast')?.selectors ?? []) {
    const selector = selectorClass(entry)
    for (const context of entry.contexts) {
      for (const check of context.contrast) {
        if (!Number.isFinite(check.ratio)) continue
        const required = Number.parseFloat(check.expected)
        const key = JSON.stringify([selector, context.theme])
        const previous = groups.get(key)
        const sample = { selector, theme: context.theme, ratio: check.ratio, required,
          foreground: check.foreground, background: check.background, screen: context.screen, width: context.width }
        const worst = !previous || check.ratio < previous.ratio || (check.ratio === previous.ratio && required > previous.required)
        groups.set(key, { ...(worst ? sample : previous), occurrences: (previous?.occurrences ?? 0) + 1 })
      }
    }
  }
  return [...groups.values()].sort((a, b) => a.ratio - b.ratio || b.required - a.required || a.selector.localeCompare(b.selector) || a.theme.localeCompare(b.theme))
}

export function auditExitCode(strict, summary) {
  return strict && (summary.violations.length > 0 || summary.failures.length > 0) ? 1 : 0
}

export function formatSummary(summary) {
  const lines = [
    '# Accessibility audit', '',
    `Completed ${summary.completed}/${summary.attempted} screen/theme/width combinations.`,
    `Tags: ${summary.tags.join(', ')}.`,
    'Count means unique selectors per rule across the run. Occurrences count distinct screen/theme/width contexts for those selectors.', '',
  ]
  if (summary.auditOnlyStyles) lines.push('Decorative overlays are hidden in this audit only so axe can measure the underlying colors.', '')
  for (const [heading, rules] of [['Confirmed violations', summary.violations], ['Incomplete checks requiring review', summary.incomplete]]) {
    lines.push(`## ${heading}`, '')
    if (!rules.length) { lines.push('None.', ''); continue }
    for (const rule of rules) {
      lines.push(`### ${rule.id} | ${rule.impact ?? 'unclassified'} | count ${rule.count} | occurrences ${rule.occurrences}`, '', rule.description, '')
      for (const example of rule.examples) {
        // Axe may use zero as a sentinel when it could not determine the colors.
        const measured = example.contrast.map((check) => `ratio ${Number.isFinite(check.ratio) && check.ratio >= 1 && check.foreground && check.background ? `${check.ratio}:1` : 'unavailable'}, foreground ${check.foreground ?? 'unavailable'}, background ${check.background ?? 'unavailable'}${check.expected ? `, expected ${check.expected}` : ''}${check.reason ? `; ${check.reason}` : ''}`)
        const contrast = rule.id === 'color-contrast' ? ` | ${measured.join('; ') || 'ratio unavailable, foreground unavailable, background unavailable'}` : ''
        lines.push(`- \`${example.selector}\` | ${example.screen}/${example.theme}/${example.width}${contrast}`)
      }
      lines.push('', `[Rule details](${rule.helpUrl})`, '')
    }
  }
  const contrast = summary.contrastFailures ?? groupContrastFailures(summary)
  lines.push('## Color contrast by selector class and theme', '',
    `Showing ${Math.min(25, contrast.length)} of ${contrast.length} groups, lowest measured ratio first. Each group retains its worst measurement. Component classes take priority over utility classes; unclassed elements use their structural selector.`, '')
  if (contrast.length) {
    lines.push('| Selector class | Theme | Ratio | Required | Foreground | Background |', '| --- | --- | ---: | ---: | --- | --- |')
    for (const row of contrast.slice(0, 25)) lines.push(`| \`${row.selector.replaceAll('|', '\\|')}\` | ${row.theme} | ${row.ratio}:1 | ${row.required}:1 | ${row.foreground} | ${row.background} |`)
    lines.push('')
  } else lines.push('None.', '')
  lines.push('## Failed scans', '')
  if (!summary.failures.length) lines.push('None.')
  else for (const failure of summary.failures) lines.push(`- ${failure.screen}/${failure.theme ?? '-'}/${failure.width ?? '-'}: ${failure.message}`)
  lines.push('')
  return lines.join('\n')
}
