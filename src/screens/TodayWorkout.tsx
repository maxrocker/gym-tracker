import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { todayISO } from '../utils/date'
import MachinePhoto from '../components/MachinePhoto'
import EntryEditor, { summarizeSets } from '../components/EntryEditor'
import { useToast } from '../components/Toast'

export default function TodayWorkout() {
  const [date, setDate] = useState(todayISO())
  const [query, setQuery] = useState('')
  const [activeMachineId, setActiveMachineId] = useState<number | null>(null)
  const toast = useToast()

  const machines = useLiveQuery(
    () => db.machines.filter(m => !m.archived).toArray(),
    [],
  ) ?? []

  const todaysEntries = useLiveQuery(
    () => db.entries.where('date').equals(date).toArray(),
    [date],
  ) ?? []

  const dayNote = useLiveQuery(() => db.dayNotes.where('date').equals(date).first(), [date])
  const [noteDraft, setNoteDraft] = useState<string | null>(null)
  const noteValue = noteDraft ?? dayNote?.text ?? ''

  const entryByMachine = useMemo(() => {
    const m = new Map<number, typeof todaysEntries[number]>()
    for (const e of todaysEntries) m.set(e.machineId, e)
    return m
  }, [todaysEntries])

  const filtered = machines.filter(m =>
    !query.trim() || m.name.toLowerCase().includes(query.toLowerCase()) || (m.number ?? '').includes(query),
  )

  async function saveNote() {
    if (noteDraft == null) return
    if (noteDraft.trim()) {
      await db.dayNotes.put({ date, text: noteDraft.trim() })
    } else if (dayNote) {
      await db.dayNotes.delete(dayNote.id!)
    }
    setNoteDraft(null)
    toast.show('Note saved')
  }

  const activeMachine = machines.find(m => m.id === activeMachineId) ?? null

  if (activeMachine) {
    return (
      <EntryEditor
        machine={activeMachine}
        date={date}
        existing={entryByMachine.get(activeMachine.id!) ?? null}
        onBack={() => setActiveMachineId(null)}
      />
    )
  }

  return (
    <div className="stack">
      <div className="card">
        <label htmlFor="date">Date</label>
        <input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} />
      </div>

      <div className="card">
        <label htmlFor="daynote">Day note</label>
        <textarea
          id="daynote"
          placeholder="e.g. Schulterschmerzen"
          value={noteValue}
          onChange={e => setNoteDraft(e.target.value)}
          onBlur={saveNote}
        />
      </div>

      <input
        type="text"
        placeholder="Search machines…"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      {filtered.length === 0 && machines.length === 0 && (
        <div className="empty-state">
          <span className="emoji">🏋️</span>
          No machines yet. Add one in the Machines tab.
        </div>
      )}

      <div className="list">
        {filtered.map(m => {
          const entry = entryByMachine.get(m.id!)
          return (
            <button
              key={m.id}
              className="card row"
              style={{ width: '100%', textAlign: 'left', border: entry ? '1px solid var(--accent)' : undefined }}
              onClick={() => setActiveMachineId(m.id!)}
            >
              <MachinePhoto photo={m.photo} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row-between">
                  <strong>{m.number ? `${m.number}. ` : ''}{m.name}</strong>
                  {entry && <span className="pill pill-accent">✓ logged</span>}
                </div>
                <div className="muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {entry ? summarizeSets(entry.sets) : 'Tap to log'}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
