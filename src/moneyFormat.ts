/** Accounting-style money helpers for statement layouts. */

export function formatAmount(n: number, withDollar = false): string {
  const abs = Math.abs(n)
  const body = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs)
  const signed = n < 0 ? `(${body})` : body
  return withDollar ? `$ ${signed}` : signed
}

export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${m}/${String(d).padStart(2, '0')}`
}

export function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export function formatPeriodHeading(period: { from?: string; to?: string }): string {
  if (!period.from && !period.to) return ''
  if (period.from && period.to && period.from === period.to) {
    return formatLongDate(period.to)
  }
  if (period.from && period.to) {
    return `For the Period ${formatLongDate(period.from)} to ${formatLongDate(period.to)}`
  }
  if (period.to) return `As of ${formatLongDate(period.to)}`
  if (period.from) return `From ${formatLongDate(period.from)}`
  return ''
}

export function formatYearEnded(period: { from?: string; to?: string }): string {
  if (period.to) return `For the Year Ended ${formatLongDate(period.to)}`
  return formatPeriodHeading(period)
}
