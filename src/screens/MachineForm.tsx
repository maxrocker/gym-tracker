import { useRef, useState } from 'react'
import { db } from '../db'
import type { Category, Machine, Unit } from '../types'
import { resizeImage } from '../utils/image'
import { todayISO } from '../utils/date'
import MachinePhoto from '../components/MachinePhoto'
import { useToast } from '../components/Toast'

interface Props {
  machine: Machine | null
  onDone: () => void
}

const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'bodyweight', label: 'Bodyweight' },
]

const UNITS: { value: Unit; label: string }[] = [
  { value: 'kg', label: 'kg' },
  { value: 'km', label: 'km' },
  { value: 'freetext', label: 'Free text' },
]

export default function MachineForm({ machine, onDone }: Props) {
  const [number, setNumber] = useState(machine?.number ?? '')
  const [name, setName] = useState(machine?.name ?? '')
  const [category, setCategory] = useState<Category>(machine?.category ?? 'strength')
  const [unit, setUnit] = useState<Unit>(machine?.unit ?? 'kg')
  const [photo, setPhoto] = useState<Blob | undefined>(machine?.photo)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    try {
      setPhoto(await resizeImage(file))
    } catch {
      toast.show('Could not process photo')
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!name.trim()) {
      toast.show('Name is required')
      return
    }
    if (machine?.id != null) {
      await db.machines.update(machine.id, {
        number: number.trim() || undefined,
        name: name.trim(),
        category,
        unit,
        photo,
      })
    } else {
      await db.machines.add({
        number: number.trim() || undefined,
        name: name.trim(),
        category,
        unit,
        photo,
        createdAt: todayISO(),
      })
    }
    toast.show('Saved')
    onDone()
  }

  return (
    <div className="stack">
      <button className="btn" onClick={onDone}>← Back</button>
      <h2>{machine ? 'Edit machine' : 'Add machine'}</h2>

      <div className="card stack">
        <div className="row" style={{ justifyContent: 'center' }}>
          <MachinePhoto photo={photo} size="lg" />
        </div>
        <div className="row" style={{ justifyContent: 'center', gap: 8 }}>
          <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? 'Processing…' : photo ? '📷 Change photo' : '📷 Add photo'}
          </button>
          {photo && <button className="btn" onClick={() => setPhoto(undefined)}>Remove</button>}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
      </div>

      <div className="card field-grid">
        <div className="stack-tight">
          <label htmlFor="number">Number</label>
          <input id="number" type="text" inputMode="numeric" value={number} onChange={e => setNumber(e.target.value)} placeholder="e.g. 5" />
        </div>
        <div className="stack-tight">
          <label htmlFor="name">Name *</label>
          <input id="name" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Chest Press" />
        </div>
      </div>

      <div className="card stack-tight">
        <label>Category</label>
        <div className="tabs">
          {CATEGORIES.map(c => (
            <button key={c.value} className={category === c.value ? 'active' : ''} onClick={() => setCategory(c.value)}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card stack-tight">
        <label>Unit</label>
        <div className="tabs">
          {UNITS.map(u => (
            <button key={u.value} className={unit === u.value ? 'active' : ''} onClick={() => setUnit(u.value)}>
              {u.label}
            </button>
          ))}
        </div>
      </div>

      <button className="btn btn-primary btn-block" onClick={save}>Save machine</button>
    </div>
  )
}
