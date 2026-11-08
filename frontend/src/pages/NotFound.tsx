import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="page not-found">
      <p className="t-eyebrow">404</p>
      <h1 className="t-display not-found__title">
        This page is <em>off the syllabus</em>.
      </h1>
      <p className="t-muted">The link may be old, or the item was deleted.</p>
      <Link to="/app" className="btn btn--primary btn--md">
        Go to Today
      </Link>
    </div>
  )
}
