import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { db } from '../db'
import { addDays, formatDMY, formatShort, todayISO } from '../utils/date'
import { useToast } from '../components/Toast'

type RangeKey = '1M' | '3M' | '6M' | 'ALL'
const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 180 },
  { key: 'ALL', label: 'All', days: null },
]

export default function BodyWeightScreen() {
  const [date, setDate] = useState(todayISO())
  const [range, setRange] = useState<RangeKey>('3M')
  const toast = useToast()

  const entries = useLiveQuery(() => db.bodyWeights.orderBy('date').toArray(), []) ?? []
  const todayEntry = useLiveQuery(() => db.bodyWeights.where('date').equals(date).first(), [date])
  const [kgDraft, setKgDraft] = useState<string | null>(null)
  const kgValue = kgDraft ?? (todayEntry ? String(todayEntry.kg) : '')

  const rangeDef = RANGES.find(r => r.key === range)!
  const cutoff = rangeDef.days != null ? addDays(todayISO(), -rangeDef.days) : null
  const chartData = useMemo(() => {
    const filtered = cutoff ? entries.filter(e => e.date >= cutoff) : entries
    return filtered.map(e => ({ date: e.date, label: formatShort(e.date), kg: e.kg }))
  }, [entries, cutoff])

  async function save() {
    const kg = parseFloat(kgValue.replace(',', '.'))
    if (isNaN(kg) || kg <= 0) {
      toast.show('Enter a valid weight')
      return
    }
    await db.bodyWeights.put({ date, kg })
    setKgDraft(null)
    toast.show('Saved')
  }

  async function removeEntry(id: number) {
    await db.bodyWeights.delete(id)
    toast.show('Deleted')
  }

  const latest = entries[entries.length - 1]

  return (
    <div className="stack">
      <h2>Body weight</h2>

      <div className="card stack-tight">
        <label htmlFor="bw-date">Date</label>
        <input id="bw-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        <label htmlFor="bw-kg">Weight (kg)</label>
        <input
          id="bw-kg"
          type="text"
          inputMode="decimal"
          placeholder="e.g. 81.5"
          value={kgValue}
          onChange={e => setKgDraft(e.target.value)}
        />
        <button className="btn btn-primary btn-block" onClick={save}>Save</button>
      </div>

      {latest && (
        <div className="card row-between">
          <span className="muted">Latest</span>
          <strong>{latest.kg} kg <span className="muted">({formatDMY(latest.date)})</span></strong>
        </div>
      )}

      <div className="section-title">Trend</div>
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
                  formatter={(v: any) => [`${v} kg`, 'Weight']}
                  labelFormatter={(_l, payload) => payload?.[0]?.payload ? formatDMY(payload[0].payload.date) : ''}
                />
                <Line type="monotone" dataKey="kg" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="section-title">History</div>
      {entries.length === 0 && <div className="empty-state">No entries yet.</div>}
      <div className="list">
        {entries.slice().reverse().map(e => (
          <div key={e.id} className="card row-between">
            <span>{formatDMY(e.date)}</span>
            <div className="row" style={{ gap: 10 }}>
              <strong>{e.kg} kg</strong>
              <button className="btn btn-icon" aria-label="Delete" onClick={() => removeEntry(e.id!)}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
