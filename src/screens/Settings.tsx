import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'
import { clearAllData, exportBackupFile, importBackup } from '../utils/backup'
import { loadSampleData } from '../utils/seed'
import { useToast } from '../components/Toast'
import type { BackupPayload } from '../types'

type Theme = 'system' | 'light' | 'dark'

export default function Settings() {
  const [theme, setThemeState] = useState<Theme>(() => (localStorage.getItem('gt_theme') as Theme) || 'system')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const counts = useLiveQuery(async () => ({
    machines: await db.machines.count(),
    entries: await db.entries.count(),
    bodyWeights: await db.bodyWeights.count(),
  }), [])

  function setTheme(t: Theme) {
    setThemeState(t)
    if (t === 'system') {
      localStorage.removeItem('gt_theme')
      document.documentElement.removeAttribute('data-theme')
    } else {
      localStorage.setItem('gt_theme', t)
      document.documentElement.setAttribute('data-theme', t)
    }
  }

  async function handleExport() {
    setBusy(true)
    try {
      await exportBackupFile()
      toast.show('Backup downloaded')
    } finally {
      setBusy(false)
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!confirm('Importing replaces ALL current data with the contents of this backup. Continue?')) return
    setBusy(true)
    try {
      const text = await file.text()
      const payload = JSON.parse(text) as BackupPayload
      if (!payload || !Array.isArray(payload.machines)) throw new Error('Not a valid backup file')
      const result = await importBackup(payload)
      toast.show(`Imported ${result.machines} machines, ${result.entries} entries`)
    } catch (err: any) {
      toast.show(`Import failed: ${err?.message ?? 'invalid file'}`)
    } finally {
      setBusy(false)
    }
  }

  async function handleSeed() {
    if (!confirm('Load sample data for previewing charts? This adds extra machines/entries on top of what you have.')) return
    setBusy(true)
    try {
      await loadSampleData()
      toast.show('Sample data loaded')
    } finally {
      setBusy(false)
    }
  }

  async function handleReset() {
    if (!confirm('Delete ALL machines, entries, body weights and notes? This cannot be undone. Export a backup first if unsure.')) return
    setBusy(true)
    try {
      await clearAllData()
      toast.show('All data cleared')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="stack">
      <h2>Settings</h2>

      <div className="card row-between">
        <span className="muted">Machines</span>
        <strong>{counts?.machines ?? '—'}</strong>
      </div>
      <div className="card row-between">
        <span className="muted">Logged entries</span>
        <strong>{counts?.entries ?? '—'}</strong>
      </div>
      <div className="card row-between">
        <span className="muted">Body weight entries</span>
        <strong>{counts?.bodyWeights ?? '—'}</strong>
      </div>

      <div className="section-title">Appearance</div>
      <div className="card tabs">
        <button className={theme === 'system' ? 'active' : ''} onClick={() => setTheme('system')}>System</button>
        <button className={theme === 'light' ? 'active' : ''} onClick={() => setTheme('light')}>Light</button>
        <button className={theme === 'dark' ? 'active' : ''} onClick={() => setTheme('dark')}>Dark</button>
      </div>

      <div className="section-title">Backup</div>
      <div className="card stack">
        <p className="muted">Your data lives only on this device. Export a backup regularly — this JSON file is the only way to restore or move to a new phone.</p>
        <button className="btn btn-primary btn-block" disabled={busy} onClick={handleExport}>⬇️ Export backup (.json)</button>
        <button className="btn btn-block" disabled={busy} onClick={() => fileRef.current?.click()}>⬆️ Import backup</button>
        <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleImportFile} />
      </div>

      <div className="section-title">Preview</div>
      <div className="card">
        <button className="btn btn-block" disabled={busy} onClick={handleSeed}>✨ Load sample data</button>
      </div>

      <div className="section-title">Danger zone</div>
      <div className="card">
        <button className="btn btn-danger btn-block" disabled={busy} onClick={handleReset}>🗑️ Erase all data</button>
      </div>
    </div>
  )
}
