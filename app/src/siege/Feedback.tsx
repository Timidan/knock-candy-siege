import { useState } from 'react'
import type { FormEvent } from 'react'
import { Sticker, playUi } from '../ui'
import { sendFeedback } from './telemetry'
import type { FeedbackNote } from './telemetry'

// The optional note after a level: a 1–5 rating (tap the chosen star again to clear it), up to 500 characters, and Send.
// The dialog around it has the close button. Send stays disabled while a note is on its way, so one tap sends it once.
export function Feedback({ context, onSent }: { context: Omit<FeedbackNote, 'rating' | 'text'>; onSent: () => void }) {
  const [rating, setRating] = useState(0), [text, setText] = useState(''), [sending, setSending] = useState(false), [error, setError] = useState('')
  const send = (event: FormEvent) => {
    event.preventDefault()
    if (sending || !text.trim()) return
    setSending(true); setError('')
    sendFeedback({ ...context, rating: rating || null, text: text.trim() }).then(onSent, (reason: Error) => { setError(reason.message); setSending(false) })
  }
  return <form className="siege-feedback" onSubmit={send}>
    <h2>How was that night?</h2>
    <div className="siege-feedback-rating" role="group" aria-label="Rating (optional)">
      {[1, 2, 3, 4, 5].map(n => <button key={n} type="button" className={n <= rating ? 'is-lit' : ''} aria-label={`${n} of 5`} aria-pressed={rating === n} onClick={() => { setRating(rating === n ? 0 : n); playUi('ui-select') }}>★</button>)}
    </div>
    <textarea aria-label="Your feedback" aria-describedby="siege-feedback-hint" maxLength={500} rows={3} value={text} onChange={event => setText(event.target.value)} />
    <p className="siege-feedback-foot"><span id="siege-feedback-hint">Anonymous. Please don’t include personal details.</span><span>{text.length}/500</span></p>
    {error && <p className="siege-feedback-error" role="alert">{error}</p>}
    <Sticker tone="orange" type="submit" sound="ui-confirm" disabled={sending || !text.trim()}>{sending ? 'Sending…' : 'Send'}</Sticker>
  </form>
}
