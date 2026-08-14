import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { db } from '../db'
import { addDays, formatDMY, isoWeekKey, startOfWeek, todayISO } from '../utils/date'

const WEEKS_SHOWN = 12
const HEATMAP_WEEKS = 18

export default function ProgressScreen() {
  const entries = useLiveQuery(() => db.entries.toArray(), []) ?? []

  const workoutDays = useMemo(() => {
    const days = new Map<string, number>() // date -> number of entries that day
    for (const e of entries) days.set(e.date, (days.get(e.date) ?? 0) + 1)
    return days
  }, [entries])

  const weeklyData = useMemo(() => {
    const today = todayISO()
    const weeks: { key: string; label: string; count: number }[] = []
    for (let i = WEEKS_SHOWN - 1; i >= 0; i--) {
      const weekStart = startOfWeek(addDays(today, -7 * i))
      const key = isoWeekKey(weekStart)
      const daysInWeek = new Set<string>()
      let cursor = weekStart
      for (let d = 0; d < 7; d++) {
        if (workoutDays.has(cursor)) daysInWeek.add(cursor)
        cursor = addDays(cursor, 1)
      }
      weeks.push({ key, label: formatDMY(weekStart).slice(0, 5), count: daysInWeek.size })
    }
    return weeks
  }, [workoutDays])

  const heatmapWeeks = useMemo(() => {
    const today = todayISO()
    const start = startOfWeek(addDays(today, -7 * (HEATMAP_WEEKS - 1)))
    const cols: string[][] = []
    let weekCursor = start
    for (let w = 0; w < HEATMAP_WEEKS; w++) {
      const col: string[] = []
      let dayCursor = weekCursor
      for (let d = 0; d < 7; d++) {
        col.push(dayCursor)
        dayCursor = addDays(dayCursor, 1)
      }
      cols.push(col)
      weekCursor = addDays(weekCursor, 7)
    }
    return cols
  }, [])

  function intensity(date: string): number {
    if (date > todayISO()) return -1 // future
    return workoutDays.get(date) ?? 0
  }

  function cellColor(count: number): string {
    if (count < 0) return 'transparent'
    if (count === 0) return 'var(--surface-2)'
    if (count === 1) return 'color-mix(in srgb, var(--accent) 35%, var(--surface-2))'
    if (count === 2) return 'color-mix(in srgb, var(--accent) 65%, var(--surface-2))'
    return 'var(--accent)'
  }

  const last12WeeksTotal = weeklyData.reduce((s, w) => s + w.count, 0)
  const avgPerWeek = (last12WeeksTotal / WEEKS_SHOWN).toFixed(1)

  return (
    <div className="stack">
      <h2>Progress</h2>

      <div className="card row-between">
        <span className="muted">Avg. workout days / week (last {WEEKS_SHOWN})</span>
        <strong>{avgPerWeek}</strong>
      </div>

      <div className="section-title">Workout days per week</div>
      <div className="card">
        <div style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} />
              <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} domain={[0, 7]} />
              <Tooltip formatter={(v: any) => [`${v} day${v !== 1 ? 's' : ''}`, 'Trained']} />
              <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="section-title">Calendar</div>
      <div className="card">
        <div style={{ display: 'flex', gap: 3, overflowX: 'auto' }}>
          {heatmapWeeks.map((col, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {col.map(date => (
                <div
                  key={date}
                  title={`${formatDMY(date)}${intensity(date) > 0 ? ` — ${intensity(date)} logged` : ''}`}
                  className="heatmap-cell"
                  style={{ background: cellColor(intensity(date)) }}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="row muted" style={{ marginTop: 10, gap: 6, fontSize: 11 }}>
          <span>Less</span>
          <div className="heatmap-cell" style={{ background: cellColor(0) }} />
          <div className="heatmap-cell" style={{ background: cellColor(1) }} />
          <div className="heatmap-cell" style={{ background: cellColor(2) }} />
          <div className="heatmap-cell" style={{ background: cellColor(3) }} />
          <span>More</span>
        </div>
      </div>
    </div>
  )
}
