import { EFFORTS, EFFORT_LABELS, type Effort } from '../types'

interface Props {
  value: Effort | null
  onChange: (v: Effort | null) => void
}

export default function EffortPicker({ value, onChange }: Props) {
  return (
    <div className="effort-picker">
      {EFFORTS.map(e => (
        <button
          key={e}
          type="button"
          className={`effort-btn${value === e ? ' selected' : ''}`}
          title={EFFORT_LABELS[e]}
          aria-label={EFFORT_LABELS[e]}
          onClick={() => onChange(value === e ? null : e)}
        >
          {e}
        </button>
      ))}
    </div>
  )
}
