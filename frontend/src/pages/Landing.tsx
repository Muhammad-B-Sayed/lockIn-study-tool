import { useEffect, useId, useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/data'
import type { Confidence } from '../lib/data/types'
import { Wordmark } from '../shell/Wordmark'
import { ConfidenceGlyph } from '../ui/confidence'
import { Icon } from '../ui/Icon'
import { Button, Field, Input, Segmented } from '../ui/primitives'
import { errorMessage } from '../ui/toastContext'
import '../shell/shell.css'
import './landing.css'

type Mode = 'signin' | 'signup'

export default function Landing() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [demoBusy, setDemoBusy] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  if (auth.state.status === 'signed-in') return <Navigate to="/app" replace />

  const demo = async () => {
    setDemoBusy(true)
    try {
      await auth.startDemo()
      navigate('/app')
    } finally {
      setDemoBusy(false)
    }
  }

  return (
    <div className="landing">
      <header className="landing__top">
        <Wordmark size="lg" />
        <button type="button" className="landing__signin" aria-expanded={authOpen} onClick={() => setAuthOpen((o) => !o)}>
          {authOpen ? 'Close' : 'Sign in'}
        </button>
      </header>

      <main className="landing__hero">
        <div className="landing__pitch">
          <p className="t-eyebrow landing__eyebrow">A study planner for people with a syllabus</p>
          <h1 className="landing__title t-display">
            Turn the syllabus into a plan you’ll actually <em>keep</em>.
          </h1>
          <p className="landing__sub">
            Paste your course schedule. LockIn turns each lecture into a topic and each deadline into a fixed pin. After you
            study, rate how sure you feel. It tells you what to review next, and why.
          </p>
          <div className="landing__ctas">
            <Button variant="primary" size="lg" iconRight="arrowRight" onClick={demo} loading={demoBusy}>
              Try it with sample courses
            </Button>
            <span className="landing__note t-faint">No account. Data stays in this browser.</span>
          </div>
        </div>

        <div className="landing__auth" data-open={authOpen || undefined}>
          <AuthCard />
        </div>
      </main>

      <section className="landing__how" aria-label="How it works">
        <Step n="01" title="Paste the syllabus" body="Each line becomes a topic or a deadline. Fix anything the parser guessed before it is saved.">
          <div className="mini mini--paste">
            <p className="t-mono">Week 4 (Sep 29): Paging</p>
            <p className="t-mono">Assignment 2 due Oct 9</p>
            <p className="t-mono">Midterm, Oct 15</p>
            <span className="mini__arrow">
              <Icon name="arrowRight" size={16} />
            </span>
            <div className="mini__out">
              <span className="mini__pill" data-hue="sky">
                Topic
              </span>
              <span className="mini__pill mini__pill--due" data-hue="ember">
                Due
              </span>
              <span className="mini__pill mini__pill--due" data-hue="ember">
                Exam
              </span>
            </div>
          </div>
        </Step>
        <Step n="02" title="Study, then rate it" body="One tap after each session. A jar that fills: shaky, getting there, solid. Undo if you slip.">
          <div className="mini mini--rate">
            {(['shaky', 'okay', 'solid'] as Confidence[]).map((c) => (
              <span key={c} className="mini__jar" data-conf={c}>
                <ConfidenceGlyph value={c} size={30} />
                <span>{c === 'okay' ? 'Getting there' : c[0].toUpperCase() + c.slice(1)}</span>
              </span>
            ))}
          </div>
        </Step>
        <Step n="03" title="Review what’s slipping" body="Weak topics, old topics and topics on next week’s exam rise to the top, with the reason beside each.">
          <div className="mini mini--queue">
            {[
              ['shaky', 'Page replacement', 'Shaky · exam in 4 days'],
              ['okay', 'Type inference', 'Last reviewed 6 days ago'],
              ['solid', 'Gradient descent', 'Due for a check'],
            ].map(([c, t, why], i) => (
              <div key={t} className="mini__row" style={{ ['--i' as string]: i }}>
                <ConfidenceGlyph value={c as Confidence} size={14} />
                <span className="mini__title">{t}</span>
                <span className="mini__why">{why}</span>
              </div>
            ))}
          </div>
        </Step>
      </section>

      <footer className="landing__foot t-faint">
        <span>LockIn</span>
        <span>Ratings are your own gut check, not a grade.</span>
      </footer>
    </div>
  )
}

function Step({ n, title, body, children }: { n: string; title: string; body: string; children: React.ReactNode }) {
  return (
    <article className="step">
      <div className="step__art">{children}</div>
      <p className="step__n t-mono">{n}</p>
      <h2 className="step__title t-display">{title}</h2>
      <p className="step__body">{body}</p>
    </article>
  )
}

function AuthCard() {
  const id = useId()
  const auth = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('signin')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [slow, setSlow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErr, setFieldErr] = useState<{ username?: string; password?: string }>({})

  useEffect(() => {
    if (!busy) return
    const h = window.setTimeout(() => setSlow(true), 2500)
    return () => window.clearTimeout(h)
  }, [busy])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: typeof fieldErr = {}
    if (username.trim().length < 3) errs.username = 'At least 3 characters.'
    if (mode === 'signup' && password.length < 8) errs.password = 'At least 8 characters.'
    if (mode === 'signin' && !password) errs.password = 'Enter your password.'
    setFieldErr(errs)
    setError(null)
    if (Object.keys(errs).length) return
    setBusy(true)
    try {
      const creds = { username: username.trim(), password }
      if (mode === 'signin') await auth.signIn(creds)
      else await auth.signUp(creds)
      navigate('/app')
    } catch (err) {
      setError(errorMessage(err, mode === 'signin' ? 'Wrong username or password.' : 'Could not create the account.'))
    } finally {
      setBusy(false)
      setSlow(false)
    }
  }

  return (
    <section className="auth" id="signin" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="sr-only">
        {mode === 'signin' ? 'Sign in' : 'Create an account'}
      </h2>
      <Segmented<Mode>
        label="Account"
        value={mode}
        onChange={(m) => {
          setMode(m)
          setError(null)
          setFieldErr({})
        }}
        options={[
          { value: 'signin', label: 'Sign in' },
          { value: 'signup', label: 'Create account' },
        ]}
      />
      <form className="auth__form" onSubmit={submit} noValidate>
        <Field label="Username" htmlFor={`${id}-u`} error={fieldErr.username}>
          <Input id={`${id}-u`} autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={50} aria-invalid={!!fieldErr.username} />
        </Field>
        <Field label="Password" htmlFor={`${id}-p`} error={fieldErr.password} hint={mode === 'signup' ? 'At least 8 characters.' : undefined}>
          <span className="pw-field">
          <Input
            id={`${id}-p`}
            type={showPw ? 'text' : 'password'}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!fieldErr.password}
          />
          <button type="button" className="pw-field__toggle" aria-pressed={showPw} onClick={() => setShowPw((v) => !v)}>
            {showPw ? 'Hide' : 'Show'}
          </button>
          </span>
        </Field>
        {error ? (
          <p className="auth__error" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant={username && password ? 'primary' : 'secondary'} size="lg" loading={busy} className="auth__submit">
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
        {mode === 'signin' ? (
          <details className="auth__forgot">
            <summary>Forgot your password?</summary>
            <p>
              LockIn accounts have no email attached, so a password cannot be reset by link. If you are still signed in on
              another device, change it in Settings. Otherwise create a new account; the demo is always open.
            </p>
          </details>
        ) : null}
        {slow ? (
          <p className="auth__slow" role="status">
            Waking the server. The free host naps when idle, so the first sign-in can take up to a minute.
          </p>
        ) : null}
      </form>
    </section>
  )
}
