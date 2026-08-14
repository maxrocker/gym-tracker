import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import type { Machine } from '../types'
import MachinePhoto from '../components/MachinePhoto'
import MachineForm from './MachineForm'
import MachineDetail from './MachineDetail'

type View =
  | { mode: 'list' }
  | { mode: 'form'; machine: Machine | null }
  | { mode: 'detail'; machineId: number }

const CATEGORY_LABEL: Record<string, string> = {
  strength: 'Strength',
  cardio: 'Cardio',
  bodyweight: 'Bodyweight',
}

export default function Machines() {
  const [view, setView] = useState<View>({ mode: 'list' })
  const [showArchived, setShowArchived] = useState(false)

  const machines = useLiveQuery(() => db.machines.toArray(), []) ?? []

  if (view.mode === 'form') {
    return <MachineForm machine={view.machine} onDone={() => setView({ mode: 'list' })} />
  }

  if (view.mode === 'detail') {
    const machine = machines.find(m => m.id === view.machineId)
    if (!machine) return null
    return (
      <MachineDetail
        machine={machine}
        onBack={() => setView({ mode: 'list' })}
        onEdit={() => setView({ mode: 'form', machine })}
        onDeleted={() => setView({ mode: 'list' })}
      />
    )
  }

  const visible = machines.filter(m => !!m.archived === showArchived)
  const grouped = visible.reduce<Record<string, Machine[]>>((acc, m) => {
    (acc[m.category] ??= []).push(m)
    return acc
  }, {})

  return (
    <div className="stack">
      <div className="row-between">
        <h2>Machines</h2>
        <button className="btn btn-primary" onClick={() => setView({ mode: 'form', machine: null })}>+ Add</button>
      </div>

      <div className="tabs">
        <button className={!showArchived ? 'active' : ''} onClick={() => setShowArchived(false)}>Active</button>
        <button className={showArchived ? 'active' : ''} onClick={() => setShowArchived(true)}>Archived</button>
      </div>

      {visible.length === 0 && (
        <div className="empty-state">
          <span className="emoji">🗂️</span>
          {showArchived ? 'No archived machines.' : 'No machines yet — add your first one.'}
        </div>
      )}

      {Object.entries(grouped).map(([category, list]) => (
        <div key={category}>
          <div className="section-title">{CATEGORY_LABEL[category] ?? category}</div>
          <div className="list">
            {list.map(m => (
              <button
                key={m.id}
                className="card row"
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() => setView({ mode: 'detail', machineId: m.id! })}
              >
                <MachinePhoto photo={m.photo} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong>{m.number ? `${m.number}. ` : ''}{m.name}</strong>
                  <div className="muted">{m.unit}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
