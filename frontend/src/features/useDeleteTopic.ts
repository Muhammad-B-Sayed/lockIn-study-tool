import { useAssessmentMutations, useSessionMutations, useTopicMutations } from '../lib/data'
import type { Topic, Workspace } from '../lib/data/types'
import { useToast } from '../ui/toastContext'

/**
 * Delete a topic and offer Undo. Undo recreates the topic with its notes, links, plan,
 * confidence and last review date, logs its study sessions again and links it back to
 * its deadlines. The list of past ratings cannot be recreated, and the toast says so.
 * Throws when the delete itself fails, so the caller can keep its dialog open.
 */
export function useDeleteTopic() {
  const topicM = useTopicMutations()
  const sessionM = useSessionMutations()
  const assessmentM = useAssessmentMutations()
  const toast = useToast()

  return async (t: Topic, ws: Workspace) => {
    const sessions = ws.sessions.filter((x) => x.topicId === t.id)
    const links = ws.assessments.filter((a) => a.topicIds.includes(t.id))
    const ratings = ws.reviews.filter((r) => r.topicId === t.id).length
    await topicM.remove(t.id)
    toast.show(
      {
        message: `Deleted ${t.title}`,
        action: {
          label: 'Undo',
          run: async () => {
            const created = await topicM.create({
              courseId: t.courseId,
              title: t.title,
              details: t.details,
              notes: t.notes,
              plannedDate: t.plannedDate,
              plannedStart: t.plannedStart,
              plannedMinutes: t.plannedMinutes,
              confidence: t.confidence,
              position: t.position,
              resources: t.resources.map((r) => ({ label: r.label, url: r.url })),
            })
            if (t.lastReviewedAt) await topicM.update(created.id, { lastReviewedAt: t.lastReviewedAt })
            for (const x of sessions) {
              await sessionM.create({ topicId: created.id, courseId: x.courseId, startedAt: x.startedAt, minutes: x.minutes, note: x.note })
            }
            for (const a of links) {
              await assessmentM.update(a.id, { topicIds: a.topicIds.map((id) => (id === t.id ? created.id : id)) })
            }
            toast.show({
              message: ratings
                ? `Restored ${t.title}. Its ${ratings} past ${ratings === 1 ? 'rating is' : 'ratings are'} not in the history any more.`
                : `Restored ${t.title}`,
            })
          },
        },
      },
      10_000,
    )
  }
}
