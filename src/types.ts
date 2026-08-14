export type Category = 'strength' | 'cardio' | 'bodyweight'
export type Unit = 'kg' | 'km' | 'freetext'
export type Effort = '🥵' | '😢' | '🥱'

export const EFFORTS: Effort[] = ['🥵', '😢', '🥱']
export const EFFORT_LABELS: Record<Effort, string> = {
  '🥵': 'Hard',
  '😢': 'Painful',
  '🥱': 'Easy',
}

export interface Machine {
  id?: number
  number?: string
  name: string
  category: Category
  unit: Unit
  photo?: Blob
  createdAt: string
  archived?: boolean
}

export interface WorkoutSet {
  value: number | null
  rawText: string
  effort: Effort | null
}

export interface WorkoutEntry {
  id?: number
  machineId: number
  date: string // YYYY-MM-DD
  sets: WorkoutSet[]
  note?: string
}

export interface BodyWeight {
  id?: number
  date: string // YYYY-MM-DD, one per day
  kg: number
}

export interface DayNote {
  id?: number
  date: string // YYYY-MM-DD, one per day
  text: string
}

// ── Backup / import-export payload ──────────────────────────────────────────

export interface MachineExport extends Omit<Machine, 'photo'> {
  photoBase64?: string
}

export interface BackupPayload {
  version: 1
  exportedAt: string
  machines: MachineExport[]
  entries: WorkoutEntry[]
  bodyWeights: BodyWeight[]
  dayNotes: DayNote[]
}
