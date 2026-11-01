export const orderStatusLabel: Record<string, string> = { filled: 'Terisi', pending: 'Menunggu', cancelled: 'Dibatalkan', rejected: 'Ditolak' }
export const orderStatusClass: Record<string, string> = { filled: 'text-up', pending: 'text-warn', cancelled: 'text-muted', rejected: 'text-down' }

/** Which target of a signal an exit order is: the system writes it at the start of the order's note. */
export function targetLabel(note: string | null | undefined): string | null {
  return note?.match(/^TP\d/)?.[0] ?? null
}

