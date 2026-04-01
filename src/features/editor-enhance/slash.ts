export interface SlashTrigger {
  from: number
  to: number
  query: string
}

export function detectSlashTrigger(textBeforeCursor: string, cursorPos: number): SlashTrigger | null {
  // Match "/xxx" at line start or after whitespace and return replacement range.
  const match = /(?:^|\s)\/([^\s\/]*)$/.exec(textBeforeCursor)
  if (!match) return null

  const query = match[1]
  const tokenLength = query.length + 1

  return {
    from: cursorPos - tokenLength,
    to: cursorPos,
    query,
  }
}
