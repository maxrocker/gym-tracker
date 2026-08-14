import { db } from '../db'
import type { BackupPayload, Machine, MachineExport } from '../types'
import { blobToBase64, base64ToBlob } from './image'

export async function buildBackupPayload(): Promise<BackupPayload> {
  const [machines, entries, bodyWeights, dayNotes] = await Promise.all([
    db.machines.toArray(),
    db.entries.toArray(),
    db.bodyWeights.toArray(),
    db.dayNotes.toArray(),
  ])
  const machinesOut: MachineExport[] = await Promise.all(
    machines.map(async m => {
      const { photo, ...rest } = m
      return { ...rest, photoBase64: photo ? await blobToBase64(photo) : undefined }
    }),
  )
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    machines: machinesOut,
    entries,
    bodyWeights,
    dayNotes,
  }
}

export async function exportBackupFile(): Promise<void> {
  const payload = await buildBackupPayload()
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = payload.exportedAt.slice(0, 10)
  a.href = url
  a.download = `gym-tracker-backup-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// Full replace: clears existing data, then loads the payload. Machine ids are always remapped
// (never trusted to match Dexie's live auto-increment counter) and entries' machineId is
// rewritten to follow — this makes import safe regardless of whether the payload came from this
// app's own export or from scripts/migrate.js.
export async function importBackup(payload: BackupPayload): Promise<{ machines: number; entries: number; bodyWeights: number; dayNotes: number }> {
  return db.transaction('rw', db.machines, db.entries, db.bodyWeights, db.dayNotes, async () => {
    await Promise.all([db.machines.clear(), db.entries.clear(), db.bodyWeights.clear(), db.dayNotes.clear()])

    const idMap = new Map<number, number>()
    for (const m of payload.machines) {
      const { id: oldId, photoBase64, ...rest } = m
      const photo = photoBase64 ? await base64ToBlob(photoBase64) : undefined
      const machine: Machine = { ...rest, photo }
      const newId = await db.machines.add(machine)
      if (oldId != null) idMap.set(oldId, newId)
    }

    let entryCount = 0
    for (const e of payload.entries) {
      const { id: _id, machineId, ...rest } = e
      const newMachineId = idMap.get(machineId)
      if (newMachineId == null) continue // orphaned reference — skip rather than corrupt
      await db.entries.add({ ...rest, machineId: newMachineId })
      entryCount++
    }

    for (const bw of payload.bodyWeights) {
      const { id: _id, ...rest } = bw
      await db.bodyWeights.put(rest)
    }
    for (const dn of payload.dayNotes) {
      const { id: _id, ...rest } = dn
      await db.dayNotes.put(rest)
    }

    return {
      machines: payload.machines.length,
      entries: entryCount,
      bodyWeights: payload.bodyWeights.length,
      dayNotes: payload.dayNotes.length,
    }
  })
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.machines, db.entries, db.bodyWeights, db.dayNotes, async () => {
    await Promise.all([db.machines.clear(), db.entries.clear(), db.bodyWeights.clear(), db.dayNotes.clear()])
  })
}
