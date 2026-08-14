import { EFFORTS, type Effort } from '../types'

// Pulls the first number out of free text like "1 up a step" or "10 kg" or "90, 90, 100".
// Mirrors the leading-number rule scripts/migrate.js uses for historical imports, so manually
// typed entries behave the same way.
export function extractLeadingNumber(text: string): number | null {
  const m = text.replace(',', '.').match(/-?\d+(\.\d+)?/)
  return m ? parseFloat(m[0]) : null
}

export function stripEffort(text: string): { text: string; effort: Effort | null } {
  for (const e of EFFORTS) {
    if (text.includes(e)) {
      return { text: text.replace(e, '').trim(), effort: e }
    }
  }
  return { text, effort: null }
}
