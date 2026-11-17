import { useWorkspace } from '../lib/data'
import { buildIcs } from '../lib/domain/ics'
import { useToast } from '../ui/toastContext'

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/** Download open deadlines, planned topics and events as an .ics file, with a toast saying what it held. */
export function useExportCalendar() {
  const { data: ws } = useWorkspace()
  const toast = useToast()
  return () => {
    if (!ws) return
    const ics = buildIcs(ws, new Date())
    if (!ics.deadlines && !ics.studyBlocks && !ics.events) {
      toast.show({ message: 'Nothing to export yet. Add a deadline or plan a topic first.' })
      return
    }
    download(`lockin-calendar-${new Date().toISOString().slice(0, 10)}.ics`, ics.text, 'text/calendar')
    toast.show({
      message: `Calendar file saved: ${[
        ics.deadlines ? count(ics.deadlines, 'deadline') : null,
        ics.studyBlocks ? count(ics.studyBlocks, 'planned topic') : null,
        ics.events ? count(ics.events, 'event') : null,
      ]
        .filter(Boolean)
        .join(', ')}`,
    })
  }
}
