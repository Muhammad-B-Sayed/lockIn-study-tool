/** "Lockin" set in Fraunces: upright "Lock", italic "in", and a lamp dot over the i's place. */
export function Wordmark({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={`wordmark wordmark--${size}`}>
      <span className="wordmark__lamp" aria-hidden />
      <span className="wordmark__lock">Lock</span>
      <span className="wordmark__in">in</span>
    </span>
  )
}
