#!/usr/bin/env node
// One-time migration: parses the tab-separated workout-history.txt export from iPhone Notes
// into the app's backup JSON import format. Run with:
//   node scripts/migrate.js [path-to-workout-history.txt] [output-path]
// Defaults: ./workout-history.txt (project root) -> ./migrated-data.json
//
// Import the resulting JSON via the app's Settings screen ("Import backup").

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

const inputPath = path.resolve(process.cwd(), process.argv[2] || path.join(projectRoot, 'workout-history.txt'))
const outputPath = path.resolve(process.cwd(), process.argv[3] || path.join(projectRoot, 'migrated-data.json'))

const EFFORTS = ['🥵', '😢', '🥱']

const MONTHS = {
  januar: 1, january: 1,
  februar: 2, february: 2,
  märz: 3, maerz: 3, march: 3,
  april: 4,
  mai: 5, may: 5,
  juni: 6, june: 6,
  juli: 7, july: 7,
  august: 8,
  september: 9,
  oktober: 10, october: 10,
  november: 11,
  dezember: 12, december: 12,
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function shiftDateISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

// Builds `count` ascending dates ending at anchorISO, stepping backward with alternating 4/3-day
// gaps -- averaging 3.5 days, i.e. twice a week.
function buildBackwardDates(anchorISO, count) {
  const dates = []
  let cursor = anchorISO
  let toggle = 0
  for (let i = 0; i < count; i++) {
    dates.unshift(cursor)
    const gap = toggle % 2 === 0 ? 4 : 3
    toggle++
    cursor = shiftDateISO(cursor, -gap)
  }
  return dates
}

function readRows(text) {
  const clean = text.replace(/^﻿/, '') // strip BOM if present
  return clean.split(/\r\n|\r|\n/).filter(line => line.length > 0).map(line => line.split('\t'))
}

// The Notes export can have a title line ("Workout progress") above the real header row.
// Find the first row where a good chunk of cells (from column 2 on) parse as dates.
function findHeaderRowIndex(rows) {
  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r]
    if (cells.length < 10) continue
    let parseable = 0
    for (let c = 2; c < cells.length; c++) {
      if (cells[c].trim() && parseHeaderCell(cells[c])) parseable++
    }
    if (parseable >= 10) return r
  }
  return 0
}

// ── Date header parsing (German/English, year inferred via month rollover) ──────────────────────────

function parseHeaderCell(cell) {
  const normalized = cell.replace(/ /g, ' ').trim()
  if (!normalized) return null
  // The day/month separator ("16. Juli") is occasionally typed without the period ("7 Juli").
  const m = normalized.match(/^(\d{1,2})\.?\s*([A-Za-zÀ-ÿ]+)(?:\s+(\d{4}))?$/)
  if (!m) return null
  const day = parseInt(m[1], 10)
  const month = MONTHS[m[2].toLowerCase()]
  if (!month || day < 1 || day > 31) return null
  return { day, month, explicitYear: m[3] ? parseInt(m[3], 10) : null }
}

function buildDateColumns(headerCells, headerRowIndex) {
  const dates = []
  const unparsed = []
  let currentYear = 2024 // "data starts Juli 2024"
  let prevMonth = null

  for (let c = 2; c < headerCells.length; c++) {
    const raw = headerCells[c] ?? ''
    if (!raw.trim()) {
      dates.push(null)
      unparsed.push({ row: headerRowIndex, col: c, context: 'date header (blank — any data in this column below is undated)', raw: '(empty)' })
      continue
    }
    const parsed = parseHeaderCell(raw)
    if (!parsed) {
      dates.push(null)
      unparsed.push({ row: headerRowIndex, col: c, context: 'date header (unrecognised format)', raw })
      continue
    }
    if (parsed.explicitYear) {
      currentYear = parsed.explicitYear
    } else if (prevMonth != null && parsed.month < prevMonth) {
      currentYear += 1
    }
    prevMonth = parsed.month
    dates.push(`${currentYear}-${pad(parsed.month)}-${pad(parsed.day)}`)
  }
  return { dates, unparsed }
}

// ── Cell value parsing ───────────────────────────────────────────────────────────────────────

function extractEffort(token) {
  for (const e of EFFORTS) {
    if (token.includes(e)) return e
  }
  return null
}

// Generic rule: plain numbers, "XX" (attempted/skipped), slash values ("30/25" -> first number),
// range values ("45-50" -> first number), and emoji-tagged values all reduce to one set.
function parseGenericToken(rawToken) {
  const token = rawToken.trim()
  const effort = extractEffort(token)
  if (/^XX$/i.test(token.replace(/[🥵😢🥱]/gu, '').trim())) {
    return { value: null, rawText: token, effort }
  }
  const numMatch = token.match(/-?\d+(?:[.,]\d+)?/)
  const value = numMatch ? parseFloat(numMatch[0].replace(',', '.')) : null
  return { value, rawText: token, effort }
}

// Laufband (cardio): only count a value as km if the token actually says "km" — "30 Stockwerke"
// or "30 floors" is a different unit entirely and must not be plotted as if it were 30 km.
function parseLaufbandToken(rawToken) {
  const token = rawToken.trim()
  const effort = extractEffort(token)
  if (/^XX$/i.test(token.replace(/[🥵😢🥱]/gu, '').trim())) {
    return { value: null, rawText: token, effort }
  }
  const kmMatch = token.match(/(-?\d+(?:[.,]\d+)?)\s*km/i)
  const value = kmMatch ? parseFloat(kmMatch[1].replace(',', '.')) : null
  return { value, rawText: token, effort }
}

// Splits a cell into one or more sets (comma-separated = multiple sets logged that session),
// stripping a leading "N - " machine-number prefix if present. The strip only applies when the
// cell also has commas (a multi-set list) — otherwise it collides with single range values like
// "45-50", which look identical to a stripped "N - " prefix but mean something different.
function parseCell(rawCell, tokenParser) {
  let cell = rawCell.trim()
  if (!cell) return []
  if (cell.includes(',')) {
    cell = cell.replace(/^\d+\s*-\s*/, '')
  }
  const parts = cell.split(',').map(p => p.trim()).filter(Boolean)
  if (parts.length === 0) return []
  return parts.map(tokenParser)
}

function parseWeightCell(rawCell) {
  const cell = rawCell.trim()
  if (!cell) return null
  const m = cell.match(/-?\d+(?:[.,]\d+)?/)
  return m ? parseFloat(m[0].replace(',', '.')) : null
}

// ── Row classification ──────────────────────────────────────────────────────────────────────

// flagNullAsUnparsed: whether a set with value=null (and rawText !== 'XX') should be reported as
// a parse failure. Freetext rows and Laufband's non-km entries ("30 Stockwerke") are EXPECTED to
// sometimes have no numeric value — that's not a failure, so they're excluded from the report.
const ROW_TYPES = {
  laufband: { kind: 'machine', category: 'cardio', unit: 'km', parser: parseLaufbandToken, flagNullAsUnparsed: false },
  gewicht: { kind: 'bodyweight' },
  comment: { kind: 'daynote' },
  'sit-ups': { kind: 'machine', category: 'bodyweight', unit: 'freetext', parser: parseGenericToken, flagNullAsUnparsed: false },
  situps: { kind: 'machine', category: 'bodyweight', unit: 'freetext', parser: parseGenericToken, flagNullAsUnparsed: false },
  hanteln: { kind: 'machine', category: 'strength', unit: 'freetext', parser: parseGenericToken, flagNullAsUnparsed: false },
}

const DEFAULT_ROW_TYPE = { kind: 'machine', category: 'strength', unit: 'kg', parser: parseGenericToken, flagNullAsUnparsed: true }

// The special keyword (Laufband, Gewicht, Comment, Sit-ups, Hanteln) can land in either the
// "number" or the "name" column depending on how the row was originally typed — Laufband/
// Gewicht/Comment use the name column, but Sit-ups/Hanteln in this export use the number column.
// Whichever column holds it becomes the row's label; the other is not treated as a real number.
function classifyRow(numberRaw, nameRaw) {
  for (const candidate of [numberRaw, nameRaw]) {
    const key = candidate.trim().toLowerCase()
    if (ROW_TYPES[key]) return { rowType: ROW_TYPES[key], label: candidate.trim(), isSpecial: true }
  }
  return { rowType: DEFAULT_ROW_TYPE, label: nameRaw, isSpecial: false }
}

// ── Main migration ──────────────────────────────────────────────────────────────────────────

function migrate(text) {
  const rows = readRows(text)
  if (rows.length === 0) throw new Error('File is empty')

  const headerRowIndex = findHeaderRowIndex(rows)
  const header = rows[headerRowIndex]
  const { dates, unparsed: unparsedHeaders } = buildDateColumns(header, headerRowIndex)

  // Leading header columns with no date label at all (before the first labeled date) hold real
  // logged values, per clarification: each comma-separated value in these columns is a separate,
  // undated pre-history WORKOUT (not extra sets within one session) -- e.g. "90, 90, 100" there
  // means three separate visits, each with one set of that weight. Dates are assumed at a
  // twice-a-week cadence, working backward from just before the first labeled date, with all
  // machines' most recent pre-history value aligned to the same end of that shared calendar
  // (machines with fewer pre-history values just have no entry on the earliest shared dates).
  let leadingBlankCols = 0
  for (let c = 2; c < header.length; c++) {
    if (header[c].trim()) break
    leadingBlankCols++
  }
  const leadingBlankColSet = new Set(Array.from({ length: leadingBlankCols }, (_, i) => 2 + i))
  const firstRealDate = dates.find(Boolean) ?? '2024-07-01'
  // Drop the leading-blank columns from the "unparsed" report -- they're handled below, not lost.
  const unparsedHeadersFiltered = unparsedHeaders.filter(u => !leadingBlankColSet.has(u.col))

  const machines = []
  const entries = []
  const bodyWeights = []
  const dayNotes = []
  const unparsedCells = []
  const workoutDaySet = new Set()
  const preHistoryByMachine = new Map() // machineId -> ordered array of {value, rawText, effort}

  let nextMachineId = 1
  let nextEntryId = 1

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const cells = rows[r]
    const numberRaw = (cells[0] ?? '').trim()
    const nameRaw = (cells[1] ?? '').trim()
    if (!numberRaw && !nameRaw) continue // blank row

    const { rowType, label, isSpecial } = classifyRow(numberRaw, nameRaw)
    const number = isSpecial ? '' : numberRaw
    const name = isSpecial ? label : nameRaw

    if (rowType.kind === 'bodyweight') {
      for (let c = 2; c < cells.length; c++) {
        const date = dates[c - 2]
        const raw = (cells[c] ?? '').trim()
        if (!raw) continue
        if (!date) { unparsedCells.push({ row: r, col: c, context: `Gewicht (bad date column)`, raw }); continue }
        const kg = parseWeightCell(raw)
        if (kg == null) { unparsedCells.push({ row: r, col: c, context: `Gewicht ${date}`, raw }); continue }
        bodyWeights.push({ date, kg })
      }
      continue
    }

    if (rowType.kind === 'daynote') {
      for (let c = 2; c < cells.length; c++) {
        const date = dates[c - 2]
        const raw = (cells[c] ?? '').trim()
        if (!raw) continue
        if (!date) { unparsedCells.push({ row: r, col: c, context: `Comment (bad date column)`, raw }); continue }
        dayNotes.push({ date, text: raw })
      }
      continue
    }

    // Regular / special machine row
    const machineName = name || `Machine ${number}`
    const machine = {
      id: nextMachineId++,
      number: number || undefined,
      name: machineName,
      category: rowType.category,
      unit: rowType.unit,
      createdAt: null, // filled in below, once pre-history dates (if any) are assigned
    }
    machines.push(machine)

    const preHistory = []
    let earliestDate = null
    for (let c = 2; c < cells.length; c++) {
      const raw = (cells[c] ?? '').trim()
      if (!raw) continue

      if (leadingBlankColSet.has(c)) {
        preHistory.push(...parseCell(raw, rowType.parser))
        continue
      }

      const date = dates[c - 2]
      if (!date) { unparsedCells.push({ row: r, col: c, context: `${machineName} (bad date column)`, raw }); continue }

      const sets = parseCell(raw, rowType.parser)
      if (sets.length === 0) continue

      const badSets = rowType.flagNullAsUnparsed
        ? sets.filter(s => s.value == null && s.rawText.toUpperCase() !== 'XX')
        : []
      for (const bad of badSets) {
        unparsedCells.push({ row: r, col: c, context: `${machineName} ${date}`, raw: bad.rawText })
      }

      entries.push({ id: nextEntryId++, machineId: machine.id, date, sets })
      workoutDaySet.add(date)
      if (!earliestDate || date < earliestDate) earliestDate = date
    }

    if (preHistory.length > 0) preHistoryByMachine.set(machine.id, preHistory)
    machine.createdAt = earliestDate
  }

  // Assign the shared twice-a-week calendar to every machine's pre-history values.
  let assumedEntryCount = 0
  let assumedDateRange = null
  if (preHistoryByMachine.size > 0) {
    const maxCount = Math.max(...[...preHistoryByMachine.values()].map(v => v.length))
    const anchor = shiftDateISO(firstRealDate, -3)
    const sharedCalendar = buildBackwardDates(anchor, maxCount)
    assumedDateRange = [sharedCalendar[0], sharedCalendar[sharedCalendar.length - 1]]

    for (const machine of machines) {
      const preHistory = preHistoryByMachine.get(machine.id)
      if (!preHistory) continue
      const assignedDates = sharedCalendar.slice(sharedCalendar.length - preHistory.length)
      for (let i = 0; i < preHistory.length; i++) {
        const date = assignedDates[i]
        entries.push({ id: nextEntryId++, machineId: machine.id, date, sets: [preHistory[i]] })
        workoutDaySet.add(date)
        assumedEntryCount++
      }
      if (!machine.createdAt || assignedDates[0] < machine.createdAt) machine.createdAt = assignedDates[0]
    }
  }

  for (const machine of machines) {
    if (!machine.createdAt) machine.createdAt = firstRealDate
  }

  return {
    machines, entries, bodyWeights, dayNotes,
    unparsedHeaders: unparsedHeadersFiltered, unparsedCells, workoutDaySet, header,
    assumedEntryCount, assumedDateRange, preHistoryMachineCount: preHistoryByMachine.size,
  }
}

// ── Run ──────────────────────────────────────────────────────────────────────────────────────

if (!fs.existsSync(inputPath)) {
  console.error(`Could not find input file: ${inputPath}`)
  console.error('Usage: node scripts/migrate.js [path-to-workout-history.txt] [output-path]')
  process.exit(1)
}

const text = fs.readFileSync(inputPath, 'utf8')
const result = migrate(text)

const totalSets = result.entries.reduce((s, e) => s + e.sets.length, 0)
const allDates = [
  ...result.entries.map(e => e.date),
  ...result.bodyWeights.map(b => b.date),
].sort()

const payload = {
  version: 1,
  exportedAt: new Date().toISOString(),
  machines: result.machines.map(({ createdAt, ...m }) => ({ ...m, createdAt })),
  entries: result.entries,
  bodyWeights: result.bodyWeights,
  dayNotes: result.dayNotes,
}

fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2))

console.log('')
console.log('=== Migration Summary ===')
console.log(`Input:  ${inputPath}`)
console.log(`Output: ${outputPath}`)
console.log('')
console.log(`Machines created:      ${result.machines.length}`)
for (const m of result.machines) {
  const n = m.number ? `${m.number}. ` : ''
  console.log(`  - [${m.id}] ${n}${m.name}  (${m.category}, ${m.unit})`)
}
console.log('')
console.log(`Total entries:         ${result.entries.length}`)
console.log(`Total sets:            ${totalSets}`)
console.log(`Body weight entries:   ${result.bodyWeights.length}`)
console.log(`Day notes:             ${result.dayNotes.length}`)
console.log(`Workout days:          ${result.workoutDaySet.size}`)
console.log(`Date range:            ${allDates[0] ?? 'n/a'} to ${allDates[allDates.length - 1] ?? 'n/a'}`)

if (result.assumedEntryCount > 0) {
  console.log('')
  console.log(`Assumed dates:         ${result.assumedEntryCount} entries across ${result.preHistoryMachineCount} machines`)
  console.log(`                       (the two unlabeled pre-16-July columns — each comma value treated as`)
  console.log(`                       its own workout, dated twice-weekly backward from ${result.assumedDateRange[1]} to`)
  console.log(`                       ${result.assumedDateRange[0]}, aligned so each machine's most recent`)
  console.log(`                       pre-history value lands closest to its first labeled date)`)
}

const totalUnparsed = result.unparsedHeaders.length + result.unparsedCells.length
console.log('')
if (totalUnparsed === 0) {
  console.log('No unparsed cells. 🎉')
} else {
  console.log(`Unparsed (needs manual fix): ${totalUnparsed}`)
  if (result.unparsedHeaders.length) {
    console.log('  Date headers:')
    for (const u of result.unparsedHeaders) {
      console.log(`    - column ${u.col}: "${u.raw}"`)
    }
  }
  if (result.unparsedCells.length) {
    console.log('  Cells:')
    for (const u of result.unparsedCells) {
      console.log(`    - row ${u.row}, col ${u.col} [${u.context}]: "${u.raw}"`)
    }
  }
}
console.log('')
console.log(`Next step: open the app → Settings → Import backup → select ${path.basename(outputPath)}`)
