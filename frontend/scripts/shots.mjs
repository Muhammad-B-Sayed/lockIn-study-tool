import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { help, options, root, runScreens } from './preview.mjs'

// Edit routes and interaction states in screens.mjs, shared with the axe audit.
try {
  if (process.argv.includes('--help')) help('shots')
  else {
    const result = await runScreens(options(process.argv.slice(2)), async ({ page, screen, theme, width }) => {
      const output = join(root, '.shots', theme, String(width), `${screen.name}.png`)
      await mkdir(dirname(output), { recursive: true })
      if (screen.full) await page.addStyleTag({ content: '.shell{position:relative}.tabbar{position:absolute!important}.sidebar{height:auto!important;position:relative!important}' })
      await page.screenshot({ path: output, fullPage: !!screen.full, animations: 'disabled' })
      console.log(output)
    })
    if (result.failures.length) throw new Error(`${result.failures.length} screenshot capture(s) failed`)
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
