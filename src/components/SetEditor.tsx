import type { Unit, WorkoutSet, Effort } from '../types'
import { extractLeadingNumber } from '../utils/parse'
import EffortPicker from './EffortPicker'

interface Props {
  unit: Unit
  sets: WorkoutSet[]
  onChange: (sets: WorkoutSet[]) => void
  autoFocusLast?: boolean
}

function emptySet(): WorkoutSet {
  return { value: null, rawText: '', effort: null }
}

export default function SetEditor({ unit, sets, onChange, autoFocusLast }: Props) {
  function update(i: number, patch: Partial<WorkoutSet>) {
    const next = sets.slice()
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }

  function updateText(i: number, text: string) {
    update(i, { rawText: text, value: unit === 'freetext' ? extractLeadingNumber(text) : (text === '' ? null : parseFloat(text.replace(',', '.'))) })
  }

  function setEffort(i: number, effort: Effort | null) {
    update(i, { effort })
  }

  function removeSet(i: number) {
    onChange(sets.filter((_, idx) => idx !== i))
  }

  function addSet() {
    onChange([...sets, emptySet()])
  }

  const unitLabel = unit === 'kg' ? 'kg' : unit === 'km' ? 'km' : ''

  return (
    <div className="stack-tight">
      {sets.map((s, i) => (
        <div className="set-row" key={i}>
          <span className="muted" style={{ width: 18 }}>{i + 1}</span>
          {unit === 'freetext' ? (
            <input
              type="text"
              placeholder="e.g. 10 up a step"
              value={s.rawText}
              autoFocus={autoFocusLast && i === sets.length - 1}
              onChange={e => updateText(i, e.target.value)}
            />
          ) : (
            <input
              type="text"
              inputMode="decimal"
              placeholder={unitLabel || 'value'}
              value={s.rawText}
              autoFocus={autoFocusLast && i === sets.length - 1}
              onChange={e => updateText(i, e.target.value)}
            />
          )}
          <EffortPicker value={s.effort} onChange={v => setEffort(i, v)} />
          <button type="button" className="btn btn-icon" aria-label="Remove set" onClick={() => removeSet(i)}>✕</button>
        </div>
      ))}
      <button type="button" className="btn btn-block" onClick={addSet}>+ Add set</button>
    </div>
  )
}
