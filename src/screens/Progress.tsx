import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { db } from '../db'
import { addDays, formatDMY, isoToDate, isoWeekKey, startOfWeek, todayISO, yearBoundaries } from '../utils/date'
import { RANGES, type RangeKey } from '../utils/ranges'

const FALLBACK_WEEKS = 12

export default function ProgressScreen() {
  const [range, setRange] = useState<RangeKey>('3M')
  const entries = useLiveQuery(() => db.entries.toArray(), []) ?? []

  const workoutDays = useMemo(() => {
    const days = new Map<string, number>() // date -> number of entries that day
    for (const e of entries) days.set(e.date, (days.get(e.date) ?? 0) + 1)
    return days
  }, [entries])

  const earliestDate = useMemo(() => {
    let min: string | null = null
    for (const e of entries) if (min === null || e.date < min) min = e.date
    return min
  }, [entries])

  const rangeDef = RANGES.find(r => r.key === range)!

  const weeksShown = useMemo(() => {
    if (rangeDef.days != null) return Math.max(1, Math.ceil(rangeDef.days / 7))
    if (!earliestDate) return FALLBACK_WEEKS
    const diffDays = Math.max(0, (+isoToDate(todayISO()) - +isoToDate(earliestDate)) / 86400000)
    return Math.max(1, Math.ceil(diffDays / 7) + 1)
  }, [rangeDef, earliestDate])

  const weeklyData = useMemo(() => {
    const today = todayISO()
    const weeks: { key: string; date: string; label: string; count: number }[] = []
    for (let i = weeksShown - 1; i >= 0; i--) {
      const weekStart = startOfWeek(addDays(today, -7 * i))
      const key = isoWeekKey(weekStart)
      const daysInWeek = new Set<string>()
      let cursor = weekStart
      for (let d = 0; d < 7; d++) {
        if (workoutDays.has(cursor)) daysInWeek.add(cursor)
        cursor = addDays(cursor, 1)
      }
      weeks.push({ key, date: weekStart, label: formatDMY(weekStart).slice(0, 5), count: daysInWeek.size })
    }
    return weeks
  }, [workoutDays, weeksShown])

  const weeklyYearMarks = useMemo(() => yearBoundaries(weeklyData), [weeklyData])

  const heatmapWeeks = useMemo(() => {
    const today = todayISO()
    const start = startOfWeek(addDays(today, -7 * (weeksShown - 1)))
    const cols: string[][] = []
    let weekCursor = start
    for (let w = 0; w < weeksShown; w++) {
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
  }, [weeksShown])

  const heatmapMonthLabels = useMemo(() => {
    const marks: { col: number; text: string }[] = []
    let lastMonth = ''
    let lastYear = ''
    heatmapWeeks.forEach((col, i) => {
      const d = isoToDate(col[0])
      const month = d.toLocaleDateString('en-GB', { month: 'short' })
      const year = String(d.getFullYear())
      if (month !== lastMonth) {
        marks.push({ col: i, text: year !== lastYear ? `${month} '${year.slice(2)}` : month })
        lastMonth = month
        lastYear = year
      }
    })
    return marks
  }, [heatmapWeeks])

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

  const weeklyTotal = weeklyData.reduce((s, w) => s + w.count, 0)
  const avgPerWeek = (weeklyTotal / weeksShown).toFixed(1)

  const cellStep = 15 // 12px cell + 3px gap, must match .heatmap-cell + heatmap gap in index.css

  return (
    <div className="stack">
      <h2>Progress</h2>

      <div className="card row-between">
        <span className="muted">Avg. workout days / week (last {rangeDef.label})</span>
        <strong>{avgPerWeek}</strong>
      </div>

      <div className="tabs">
        {RANGES.map(r => (
          <button key={r.key} className={range === r.key ? 'active' : ''} onClick={() => setRange(r.key)}>
            {r.label}
          </button>
        ))}
      </div>

      <div className="section-title">Workout days per week</div>
      <div className="card">
        <div style={{ height: 198 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 8, right: 8, left: 0, bottom: 18 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={24} />
              <YAxis tick={{ fontSize: 11 }} width={30} allowDecimals={false} domain={[0, 7]} />
              <Tooltip formatter={(v: any) => [`${v} day${v !== 1 ? 's' : ''}`, 'Trained']} />
              {weeklyYearMarks.map(mark => (
                <ReferenceLine
                  key={mark.label}
                  x={mark.label}
                  stroke="var(--text-muted)"
                  strokeDasharray="3 3"
                  label={{ value: mark.year, position: 'insideBottom', dy: 16, fontSize: 10, fill: 'var(--text-muted)' }}
                />
              ))}
              <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="section-title">Calendar</div>
      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <div style={{ position: 'relative', height: 14, marginBottom: 4, minWidth: heatmapWeeks.length * cellStep }}>
            {heatmapMonthLabels.map(m => (
              <span
                key={m.col}
                style={{
                  position: 'absolute',
                  left: m.col * cellStep,
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap',
                }}
              >
                {m.text}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 3 }}>
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
