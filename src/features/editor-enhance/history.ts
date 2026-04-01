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

/**
 * Handle snapshotId logic.
 */
function snapshotId() {
  // Snapshot IDs are client-side generated and persisted with the snapshot payload.
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function createSnapshot(
  list: HistorySnapshot[],
  input: NewSnapshotInput,
  max = 20
): HistorySnapshot[] {
  // Cap list length to prevent unbounded growth in local and collaborative state.
  const next: HistorySnapshot = {
    id: snapshotId(),
    label: input.label.trim(),
    content: input.content,
    createdAt: Date.now(),
  }

  return [next, ...list].slice(0, max)
}

export function findSnapshot(list: HistorySnapshot[], id: string): HistorySnapshot | undefined {
  // Helper used when sidebar selection needs the full snapshot object.
  return list.find((item) => item.id === id)
}

export function removeSnapshot(list: HistorySnapshot[], id: string): HistorySnapshot[] {
  // Immutable removal keeps state updates predictable in watchers.
  return list.filter((item) => item.id !== id)
}
