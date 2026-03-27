export interface HistorySnapshot {
  id: string
  label: string
  content: string
  createdAt: number
}

export interface NewSnapshotInput {
  label: string
  content: string
}

function snapshotId() {
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function createSnapshot(
  list: HistorySnapshot[],
  input: NewSnapshotInput,
  max = 20
): HistorySnapshot[] {
  const next: HistorySnapshot = {
    id: snapshotId(),
    label: input.label.trim(),
    content: input.content,
    createdAt: Date.now(),
  }

  return [next, ...list].slice(0, max)
}

export function findSnapshot(list: HistorySnapshot[], id: string): HistorySnapshot | undefined {
  return list.find((item) => item.id === id)
}

export function removeSnapshot(list: HistorySnapshot[], id: string): HistorySnapshot[] {
  return list.filter((item) => item.id !== id)
}
