import Dexie, { type Table } from 'dexie'
import type { Machine, WorkoutEntry, BodyWeight, DayNote } from './types'

export class GymDB extends Dexie {
  machines!: Table<Machine, number>
  entries!: Table<WorkoutEntry, number>
  bodyWeights!: Table<BodyWeight, number>
  dayNotes!: Table<DayNote, number>

  constructor() {
    super('gym-tracker')
    this.version(1).stores({
      machines: '++id, name, category, archived',
      entries: '++id, machineId, date, [machineId+date]',
      bodyWeights: '++id, &date',
      dayNotes: '++id, &date',
    })
  }
}

export const db = new GymDB()

// Last entry for a machine (most recent date), used to show "beat this" while logging.
export async function getLastEntry(machineId: number, beforeDate?: string): Promise<WorkoutEntry | undefined> {
  let coll = db.entries.where('machineId').equals(machineId)
  const all = await coll.toArray()
  const filtered = beforeDate ? all.filter(e => e.date < beforeDate) : all
  if (!filtered.length) return undefined
  return filtered.reduce((a, b) => (a.date > b.date ? a : b))
}

export async function getEntriesForMachine(machineId: number): Promise<WorkoutEntry[]> {
  const rows = await db.entries.where('machineId').equals(machineId).toArray()
  return rows.sort((a, b) => a.date.localeCompare(b.date))
}
