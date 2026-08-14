import { db } from '../db'
import type { Category, Effort, Unit } from '../types'
import { addDays, todayISO } from './date'

interface SeedMachine {
  number: string
  name: string
  category: Category
  unit: Unit
  start: number
  step: number
  sets: number
}

const SEED_MACHINES: SeedMachine[] = [
  { number: '1', name: 'Leg Press', category: 'strength', unit: 'kg', start: 80, step: 2.5, sets: 3 },
  { number: '5', name: 'Chest Press', category: 'strength', unit: 'kg', start: 40, step: 1.25, sets: 3 },
  { number: '9', name: 'Lat Pulldown', category: 'strength', unit: 'kg', start: 45, step: 1.25, sets: 3 },
  { number: '', name: 'Laufband', category: 'cardio', unit: 'km', start: 1, step: 0.05, sets: 1 },
  { number: '', name: 'Sit-ups', category: 'bodyweight', unit: 'freetext', start: 1, step: 0, sets: 1 },
]

const EFFORTS: Effort[] = ['🥵', '😢', '🥱']

function rand(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

// Deterministic-ish pseudo-random dataset so repeated "load sample data" clicks look consistent
// within a run but still vary day to day and machine to machine.
export async function loadSampleData(): Promise<void> {
  const today = todayISO()
  const start = addDays(today, -180)

  const machineIds: number[] = []
  for (const sm of SEED_MACHINES) {
    const id = await db.machines.add({
      number: sm.number || undefined,
      name: sm.name,
      category: sm.category,
      unit: sm.unit,
      createdAt: start,
    })
    machineIds.push(id)
  }

  let cursor = start
  let day = 0
  while (cursor <= today) {
    day++
    const dayRand = rand(day * 7.13)
    // Roughly 4 workout days a week
    if (dayRand > 0.42) {
      const machinesToday = SEED_MACHINES
        .map((sm, i) => ({ sm, id: machineIds[i] }))
        .filter((_, i) => rand(day * 3.1 + i) > 0.35)

      for (const { sm, id } of machinesToday) {
        const progress = Math.floor(day / 14) * sm.step
        const sets = []
        for (let s = 0; s < sm.sets; s++) {
          const jitter = (rand(day * 11 + s * 5) - 0.5) * sm.step * 2
          const value = sm.unit === 'freetext'
            ? Math.max(1, Math.round(1 + day / 60))
            : Math.round((sm.start + progress + jitter) * 4) / 4
          const effort = rand(day * 13 + s) > 0.75 ? EFFORTS[Math.floor(rand(day * 17 + s) * 3)] : null
          sets.push({
            value,
            rawText: String(value),
            effort,
          })
        }
        await db.entries.add({ machineId: id, date: cursor, sets })
      }

      if (rand(day * 4.2) > 0.85) {
        await db.dayNotes.put({ date: cursor, text: 'Felt strong today' })
      }
    }

    if (day % 3 === 0) {
      const bw = Math.round((82 - day * 0.02 + (rand(day * 2.7) - 0.5) * 0.6) * 10) / 10
      await db.bodyWeights.put({ date: cursor, kg: bw })
    }

    cursor = addDays(cursor, 1)
  }
}
