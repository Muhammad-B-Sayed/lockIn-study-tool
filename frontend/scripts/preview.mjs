import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { chromium } from 'playwright'
import { screens } from './screens.mjs'

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const viewportHeights = { 1440: 900, 390: 844 }

export function options(args, { allowStrict = false } = {}) {
  const result = { only: null, themes: ['dark', 'light'], widths: [1440, 390], build: true, strict: false }
  for (const arg of args) {
    if (arg === '--no-build') result.build = false
    else if (arg === '--strict' && allowStrict) result.strict = true
    else if (arg.startsWith('--only=')) result.only = arg.slice(7).split(',').filter(Boolean)
    else if (arg.startsWith('--theme=')) {
      const theme = arg.slice(8)
      if (!['dark', 'light', 'both'].includes(theme)) throw new Error('Use --theme=dark|light|both')
      result.themes = theme === 'both' ? ['dark', 'light'] : [theme]
    } else if (arg.startsWith('--width=')) {
      const width = arg.slice(8)
      if (!['1440', '390', 'both'].includes(width)) throw new Error('Use --width=1440|390|both')
      result.widths = width === 'both' ? [1440, 390] : [Number(width)]
    } else throw new Error(`Unknown option: ${arg}`)
  }
  if (result.only) {
    const missing = result.only.filter((name) => !screens.some((screen) => screen.name === name))
    if (!result.only.length || missing.length) throw new Error(`Unknown screens: ${missing.join(', ') || '(empty)'}. Available: ${screens.map((screen) => screen.name).join(', ')}`)
  }
  return result
}

export function help(command) {
  console.log(`npm run ${command} -- [--only=landing,today] [--theme=dark|light|both] [--width=1440|390|both] [--no-build]${command === 'a11y' ? ' [--strict]' : ''}`)
  console.log(`Available: ${screens.map((screen) => screen.name).join(', ')}`)
}

async function freePort() {
  const probe = createServer()
  await new Promise((resolveListen, reject) => {
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', resolveListen)
  })
  const port = probe.address().port
  await new Promise((resolveClose, reject) => probe.close((error) => error ? reject(error) : resolveClose()))
  return port
}

async function stopChild(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return
  const exited = new Promise((resolveExit) => child.once('exit', resolveExit))
  child.kill('SIGTERM')
  const force = setTimeout(() => child.kill('SIGKILL'), 2000)
  force.unref()
  await exited
  clearTimeout(force)
}

export async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => console.warn(`Network stayed busy at ${page.url()}; continuing.`))
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  await page.waitForTimeout(300)
}

/** One build, preview and browser. Every screen gets isolated demo storage. */
export async function runScreens(config, visit) {
  let browser
  let server
  let buildChild
  let cleanupPromise
  const cleanup = () => cleanupPromise ??= (async () => {
    try { await browser?.close() } catch { /* Still stop the preview if Chromium exited. */ }
    await stopChild(server)
    await stopChild(buildChild)
  })()
  const signals = ['SIGINT', 'SIGTERM'].map((signal) => {
    const handler = () => { void cleanup().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143)) }
    process.once(signal, handler)
    return [signal, handler]
  })
  const failures = []
  let completed = 0
  const selected = screens.filter((screen) => !config.only || config.only.includes(screen.name))
  const attempted = selected.length * config.themes.length * config.widths.length
  try {
    if (config.build) {
      buildChild = spawn('npm', ['run', 'build'], { cwd: root, stdio: 'inherit' })
      await new Promise((resolveBuild, reject) => {
        buildChild.once('error', reject)
        buildChild.once('exit', (code) => code === 0 ? resolveBuild() : reject(new Error(`Build failed with exit code ${code}`)))
      })
    }
    await access(join(root, 'dist/index.html')).catch(() => { throw new Error('No build found. Run npm run build first or omit --no-build.') })
    const port = await freePort()
    const base = `http://127.0.0.1:${port}`
    let output = ''
    let spawnError
    server = spawn(process.execPath, [join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
    server.once('error', (error) => { spawnError = error })
    const record = (chunk) => { output = (output + chunk).slice(-4000) }
    server.stdout.on('data', record)
    server.stderr.on('data', record)
    let ready = false
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (spawnError) throw spawnError
      if (server.exitCode !== null || server.signalCode !== null) throw new Error(`Preview stopped before startup.\n${output}`)
      try {
        const response = await fetch(base, { signal: AbortSignal.timeout(500) })
        await response.body?.cancel()
        if (response.ok) { ready = true; break }
      } catch { /* Wait until Vite has bound its port. */ }
      await delay(100)
    }
    if (!ready) throw new Error(`Preview did not start.\n${output}`)
    browser = await chromium.launch({ headless: true })
    for (const theme of config.themes) {
      for (const width of config.widths) {
        for (const screen of selected) {
          const context = await browser.newContext({ viewport: { width, height: viewportHeights[width] }, colorScheme: theme, reducedMotion: 'reduce' })
          try {
            const page = await context.newPage()
            await page.addInitScript(({ theme: selectedTheme, signedOut }) => {
              if (!signedOut) localStorage.setItem('lockin.session.v1', JSON.stringify({ mode: 'demo' }))
              else localStorage.removeItem('lockin.session.v1')
              localStorage.setItem('lockin.theme', selectedTheme)
            }, { theme, signedOut: !!screen.signedOut })
            const response = await page.goto(`${base}${screen.path}`, { waitUntil: 'domcontentloaded' })
            if (response && !response.ok()) console.warn(`${screen.name}: HTTP ${response.status()}`)
            await settle(page)
            if (screen.setup) { await screen.setup(page); await settle(page) }
            const expectedPath = new URL(screen.path, base).pathname
            if (!screen.setup && new URL(page.url()).pathname !== expectedPath) console.warn(`${screen.name}: ${screen.path} redirected to ${new URL(page.url()).pathname}`)
            await visit({ page, screen, theme, width, index: completed + failures.length + 1, total: attempted })
            completed += 1
          } catch (error) {
            failures.push({ screen: screen.name, theme, width, message: error.message })
            console.error(`${screen.name} (${theme}, ${width}): ${error.message}`)
          } finally {
            await context.close()
          }
        }
      }
    }
    return { completed, attempted, failures }
  } finally {
    await cleanup()
    for (const [signal, handler] of signals) process.removeListener(signal, handler)
  }
}
