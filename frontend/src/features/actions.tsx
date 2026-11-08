import { useNavigate } from 'react-router-dom'
import { useAssessmentMutations, useRateTopic } from '../lib/data'
import type { Assessment, Confidence, Topic } from '../lib/data/types'
import { focus } from '../app/focusStore'
import { ConfidenceGlyph } from '../ui/confidence'
import { CONFIDENCE } from '../ui/confidenceMeta'
import { useToast } from '../ui/toastContext'

/** Rate a topic, then offer undo in a toast. */
export function useRateWithUndo() {
  const { rate } = useRateTopic()
  const toast = useToast()
  return async (topic: Topic, rating: Confidence, source: 'review' | 'focus' | 'topic' = 'review') => {
    // Re-rating the same value still logs a review: the learner just checked themselves.
    let ok = false
    try {
      const { undo } = await rate({ topicId: topic.id, rating, source })
      ok = true
      toast.show({
        message: (
          <span className="toast-rated">
            <ConfidenceGlyph value={rating} />
            <span>
              {topic.title} <span className="toast-rated__arrow">→</span> {CONFIDENCE[rating].label}
            </span>
          </span>
        ),
        action: { label: 'Undo', run: undo },
      })
    } catch (err) {
      toast.error(err, 'Could not save that rating.')
    }
    return ok
  }
}

export function useToggleDone() {
  const { update } = useAssessmentMutations()
  const toast = useToast()
  return async (a: Assessment) => {
    const done = !a.done
    try {
      await update(a.id, { done })
      if (done) {
        toast.show({
          message: `Done: ${a.title}`,
          action: { label: 'Undo', run: () => update(a.id, { done: false }).then(() => undefined) },
        })
      }
    } catch (err) {
      toast.error(err, 'Could not update that deadline.')
    }
  }
}

export function startFocus(navigate: ReturnType<typeof useNavigate>, topic: Topic | null, minutes = 50) {
  focus.start({ topicId: topic?.id ?? null, courseId: topic?.courseId ?? null, goalMinutes: minutes })
  navigate('/app/focus')
}
