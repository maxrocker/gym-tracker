import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getLastEntry } from '../db'
import type { Machine, WorkoutEntry, WorkoutSet } from '../types'
import { formatDMY } from '../utils/date'
import MachinePhoto from './MachinePhoto'
import SetEditor from './SetEditor'
import { useToast } from './Toast'

export function summarizeSets(sets: WorkoutSet[]): string {
  return sets
    .map(s => `${s.rawText || (s.value ?? '—')}${s.effort ? ' ' + s.effort : ''}`)
    .join(', ')
}

interface Props {
  machine: Machine
  date: string
  existing: WorkoutEntry | null
  onBack: () => void
  onSaved?: () => void
  onDeleted?: () => void
  /** Hide the "last entry / repeat" reference block — used when the entry being edited IS the last one. */
  hideReference?: boolean
}

export default function EntryEditor({ machine, date, existing, onBack, onSaved, onDeleted, hideReference }: Props) {
  const [sets, setSets] = useState<WorkoutSet[]>(
    existing?.sets.length ? existing.sets.map(s => ({ ...s })) : [{ value: null, rawText: '', effort: null }],
  )
  const [note, setNote] = useState(existing?.note ?? '')
  const [autoFocus, setAutoFocus] = useState(!existing)
  const toast = useToast()

  const lastEntry = useLiveQuery(
    () => (hideReference ? undefined : getLastEntry(machine.id!, existing ? existing.date : date)),
    [machine.id, date, existing, hideReference],
  )

  function repeatLast() {
    if (!lastEntry) return
    setSets(lastEntry.sets.map(s => ({ ...s })))
    setAutoFocus(false)
  }

  async function save() {
    const cleaned = sets.filter(s => s.rawText.trim() !== '' || s.value != null)
    if (cleaned.length === 0) {
      toast.show('Add at least one set')
      return
    }
    if (existing?.id != null) {
      await db.entries.update(existing.id, { sets: cleaned, note: note.trim() || undefined })
    } else {
      await db.entries.add({ machineId: machine.id!, date, sets: cleaned, note: note.trim() || undefined })
    }
    toast.show('Saved')
    onSaved?.()
    onBack()
  }

  async function remove() {
    if (existing?.id != null) {
      await db.entries.delete(existing.id)
      toast.show('Entry deleted')
      onDeleted?.()
    }
    onBack()
  }

  return (
    <div className="stack">
      <button className="btn" onClick={onBack}>← Back</button>

      <div className="card row">
        <MachinePhoto photo={machine.photo} size="lg" />
      </div>
      <h2>{machine.number ? `${machine.number}. ` : ''}{machine.name}</h2>
      <div className="muted">{formatDMY(date)}</div>

      {lastEntry && (
        <div className="card">
          <div className="row-between">
            <span className="muted">Last: {formatDMY(lastEntry.date)}</span>
            <button className="btn" onClick={repeatLast}>🔁 Repeat last</button>
          </div>
          <div>{summarizeSets(lastEntry.sets)}</div>
        </div>
      )}

      <div className="card">
        <label>Sets</label>
        <SetEditor unit={machine.unit} sets={sets} onChange={setSets} autoFocusLast={autoFocus} />
      </div>

      <div className="card">
        <label htmlFor="entrynote">Note (optional)</label>
        <input id="entrynote" type="text" value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. felt tired" />
      </div>

      <button className="btn btn-primary btn-block" onClick={save}>Save</button>
      {existing?.id != null && (
        <button className="btn btn-danger btn-block" onClick={remove}>Delete entry</button>
      )}
    </div>
  )
}
