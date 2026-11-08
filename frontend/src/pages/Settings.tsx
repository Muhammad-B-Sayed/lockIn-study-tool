import { useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAccount, useAuth } from '../lib/data'
import { useTheme } from '../app/theme'
import { Button, Dialog, Field, Input, Segmented } from '../ui/primitives'
import { errorMessage, useToast } from '../ui/toastContext'
import { Kbd } from '../ui/primitives'
import './settings.css'

export default function Settings() {
  const auth = useAuth()
  const account = useAccount()
  const toast = useToast()
  const navigate = useNavigate()
  const { setPref, resolved } = useTheme()
  const [confirm, setConfirm] = useState<'delete' | 'reset' | null>(null)
  const [busy, setBusy] = useState(false)
  const demo = auth.state.status === 'signed-in' && auth.state.mode === 'demo'
  const user = auth.state.status === 'signed-in' ? auth.state.user : null

  const exportData = async () => {
    try {
      const blob = await account.exportData()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lockin-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err)
    }
  }

  return (
    <div className="page settings">
      <header className="page-head">
        <div>
          <p className="t-eyebrow page-head__eyebrow">Settings</p>
          <h1 className="page-head__title t-display">Settings</h1>
        </div>
      </header>

      <div className="settings__list">
        <Row title="Appearance" body="Starts with your system setting. Pick one to keep it.">
          <Segmented<'dark' | 'light'>
            label="Theme"
            value={resolved}
            onChange={setPref}
            options={[
              { value: 'dark', label: 'Dark', icon: 'moon' },
              { value: 'light', label: 'Light', icon: 'sun' },
            ]}
          />
        </Row>

        <Row title="Account" body={demo ? 'You are in the demo. Everything lives in this browser only.' : `Signed in as ${user?.username ?? ''}.`}>
          <Button
            variant="secondary"
            icon="logout"
            onClick={async () => {
              await auth.signOut()
              navigate('/')
            }}
          >
            {demo ? 'Leave demo' : 'Sign out'}
          </Button>
        </Row>

        {!demo ? <PasswordRow onChange={async (current, next) => { await account.changePassword(current, next) }} /> : null}

        <Row title="Export" body="Download every course, topic, deadline, review and session as JSON.">
          <Button variant="secondary" icon="download" onClick={exportData}>
            Export data
          </Button>
        </Row>

        <Row title="Keyboard" body="Work without the mouse." className="kbd-hint">
          <dl className="keys">
            <div>
              <dt>
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </dt>
              <dd>Search, jump or quick add</dd>
            </div>
            <div>
              <dt>
                <Kbd>/</Kbd>
              </dt>
              <dd>Open search</dd>
            </div>
            <div>
              <dt>
                <Kbd>1</Kbd>
                <Kbd>2</Kbd>
                <Kbd>3</Kbd>
              </dt>
              <dd>Rate in a review pass</dd>
            </div>
            <div>
              <dt>
                <Kbd>space</Kbd>
              </dt>
              <dd>Pause or resume focus</dd>
            </div>
          </dl>
        </Row>

        <div className="settings__danger">
          {demo ? (
            <Row title="Reset demo" body="Start over with fresh sample courses. Your demo changes are lost.">
              <Button variant="danger" onClick={() => setConfirm('reset')}>
                Reset demo
              </Button>
            </Row>
          ) : (
            <Row title="Delete account" body="Removes your account and everything in it. This cannot be undone.">
              <Button variant="danger" onClick={() => setConfirm('delete')}>
                Delete account
              </Button>
            </Row>
          )}
        </div>
      </div>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        size="sm"
        title={confirm === 'reset' ? 'Reset the demo?' : 'Delete your account?'}
        description={
          confirm === 'reset'
            ? 'The sample courses come back as new. Anything you changed in the demo is gone.'
            : 'Every course, topic, note and review goes with it. Export first if you want a copy.'
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  if (confirm === 'reset') {
                    await account.resetDemo()
                    toast.show({ message: 'Demo reset' })
                    setConfirm(null)
                    navigate('/app')
                  } else {
                    await account.deleteAccount()
                    navigate('/')
                  }
                } catch (err) {
                  toast.error(err)
                } finally {
                  setBusy(false)
                }
              }}
            >
              {confirm === 'reset' ? 'Reset demo' : 'Delete everything'}
            </Button>
          </>
        }
      >
        <span className="sr-only">Confirm</span>
      </Dialog>
    </div>
  )
}

function Row({ title, body, children, className }: { title: string; body: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={['srow', className].filter(Boolean).join(' ')}>
      <div className="srow__text">
        <h2 className="srow__title">{title}</h2>
        <p className="srow__body">{body}</p>
      </div>
      <div className="srow__control">{children}</div>
    </section>
  )
}

function PasswordRow({ onChange }: { onChange: (current: string, next: string) => Promise<void> }) {
  const id = useId()
  const toast = useToast()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (next.length < 8) return setError('Use at least 8 characters.')
    if (next !== repeat) return setError('The new passwords do not match.')
    setError(null)
    setBusy(true)
    try {
      await onChange(current, next)
      setCurrent('')
      setNext('')
      setRepeat('')
      toast.show({ message: 'Password changed' })
    } catch (err) {
      setError(errorMessage(err, 'Could not change the password.'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="srow srow--stack">
      <div className="srow__text">
        <h2 className="srow__title">Password</h2>
        <p className="srow__body">Use at least 8 characters.</p>
      </div>
      <form className="pw" onSubmit={submit} noValidate>
        <Field label="Current" htmlFor={`${id}-c`}>
          <Input id={`${id}-c`} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="New" htmlFor={`${id}-n`}>
          <Input id={`${id}-n`} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="Repeat new" htmlFor={`${id}-r`} error={error}>
          <Input id={`${id}-r`} type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        </Field>
        <Button type="submit" loading={busy} disabled={!current || !next}>
          Change password
        </Button>
      </form>
    </section>
  )
}
