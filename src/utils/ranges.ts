export type RangeKey = '1M' | '3M' | '6M' | '1Y' | '2Y' | 'ALL'

export const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 180 },
  { key: '1Y', label: '1Y', days: 365 },
  { key: '2Y', label: '2Y', days: 730 },
  { key: 'ALL', label: 'All', days: null },
]
