import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { db, getEntriesForMachine } from '../db'
import type { Machine, WorkoutEntry } from '../types'
import { addDays, formatDMY, formatShort, todayISO } from '../utils/date'
import MachinePhoto from '../components/MachinePhoto'
import EntryEditor, { summarizeSets } from '../components/EntryEditor'
import { useToast } from '../components/Toast'

type RangeKey = '1M' | '3M' | '6M' | 'ALL'
const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 180 },
  { key: 'ALL', label: 'All', days: null },
]

interface Props {
  machine: Machine
  onBack: () => void
  onEdit: () => void
  onDeleted: () => void
}

export default function MachineDetail({ machine, onBack, onEdit, onDeleted }: Props) {
  const [range, setRange] = useState<RangeKey>('3M')
  const [editingEntry, setEditingEntry] = useState<WorkoutEntry | 'new' | null>(null)
  const toast = useToast()

  const entries = useLiveQuery(() => getEntriesForMachine(machine.id!), [machine.id]) ?? []

  const rangeDef = RANGES.find(r => r.key === range)!
  const cutoff = rangeDef.days != null ? addDays(todayISO(), -rangeDef.days) : null
  const inRange = cutoff ? entries.filter(e => e.date >= cutoff) : entries

  const chartData = useMemo(() => {
    return inRange.map(e => {
      const withValue = e.sets.filter(s => s.value != null)
      const maxSet = withValue.length ? withValue.reduce((a, b) => (b.value! > a.value! ? b : a)) : null
      return {
        date: e.date,
        label: formatShort(e.date),
        value: maxSet?.value ?? null,
        effort: maxSet?.effort ?? null,
      }
    }).filter(d => d.value != null)
  }, [inRange])

  async function archive() {
    await db.machines.update(machine.id!, { archived: true })
    toast.show('Machine archived')
    onDeleted()
  }

  async function deleteMachine() {
    if (!confirm(`Delete "${machine.name}" and all its ${entries.length} logged entries? This can't be undone.`)) return
    await db.transaction('rw', db.machines, db.entries, async () => {
      await db.entries.where('machineId').equals(machine.id!).delete()
      await db.machines.delete(machine.id!)
    })
    toast.show('Machine deleted')
    onDeleted()
  }

  if (editingEntry) {
    const isNew = editingEntry === 'new'
    return (
      <EntryEditor
        machine={machine}
        date={isNew ? todayISO() : editingEntry.date}
        existing={isNew ? null : editingEntry}
        onBack={() => setEditingEntry(null)}
      />
    )
  }

  return (
    <div className="stack">
      <button className="btn" onClick={onBack}>← Back</button>

      <div className="card row" style={{ justifyContent: 'center' }}>
        <MachinePhoto photo={machine.photo} size="lg" />
      </div>

      <div className="row-between">
        <h2>{machine.number ? `${machine.number}. ` : ''}{machine.name}</h2>
        <div className="top-actions">
          <button className="btn btn-icon" aria-label="Edit machine" onClick={onEdit}>✏️</button>
        </div>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <span className="pill">{machine.category}</span>
        <span className="pill">{machine.unit}</span>
      </div>

      <button className="btn btn-primary btn-block" onClick={() => setEditingEntry('new')}>+ Log new entry</button>

      <div className="section-title">Progress</div>
      <div className="tabs">
        {RANGES.map(r => (
          <button key={r.key} className={range === r.key ? 'active' : ''} onClick={() => setRange(r.key)}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="card">
        {chartData.length < 2 ? (
          <div className="empty-state">Not enough data in this range yet.</div>
        ) : (
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} />
                <YAxis tick={{ fontSize: 11 }} width={40} domain={['auto', 'auto']} />
                <Tooltip
                  formatter={(v: any, _n: any, ctx: any) => [`${v} ${machine.unit === 'freetext' ? '' : machine.unit}${ctx?.payload?.effort ? ' ' + ctx.payload.effort : ''}`, 'Max set']}
                  labelFormatter={(_l, payload) => payload?.[0]?.payload ? formatDMY(payload[0].payload.date) : ''}
                />
                <Line type="monotone" dataKey="value" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="section-title">History ({entries.length})</div>
      {entries.length === 0 && <div className="empty-state">No entries logged yet.</div>}
      <div className="list">
        {entries.slice().reverse().map(e => (
          <button
            key={e.id}
            className="card"
            style={{ width: '100%', textAlign: 'left' }}
            onClick={() => setEditingEntry(e)}
          >
            <div className="row-between">
              <strong>{formatDMY(e.date)}</strong>
              <span className="muted">{e.sets.length} set{e.sets.length !== 1 ? 's' : ''}</span>
            </div>
            <div>{summarizeSets(e.sets)}</div>
            {e.note && <div className="muted">📝 {e.note}</div>}
          </button>
        ))}
      </div>

      <div className="divider" />
      <button className="btn btn-block" onClick={archive}>Archive machine</button>
      <button className="btn btn-danger btn-block" onClick={deleteMachine}>Delete machine</button>
    </div>
  )
}
