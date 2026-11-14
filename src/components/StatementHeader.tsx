import { useApp } from '../AppContext'
import { formatLongDate, formatPeriodHeading, formatYearEnded } from '../moneyFormat'

interface Props {
  title: string
  /** @deprecated All documents now share one color treatment; kept for call-site compat. */
  variant?: 'green' | 'apple' | 'ledger' | 'plain' | 'unified'
  /** Use "For the Year Ended …" wording when a period end is set. */
  yearEnded?: boolean
  /** Show a single as-of date when period.to is set. */
  asOf?: boolean
}

const COMPANY_PLACEHOLDER = '[Company Name]'

/**
 * Shared document header — same leaf-green band on Journal, Ledger, TB, IS, BS.
 */
export function StatementHeader({
  title,
  yearEnded = false,
  asOf = false,
}: Props) {
  const { settings, period } = useApp()
  const company = settings.companyName.trim() || COMPANY_PLACEHOLDER
  const hasPeriod = Boolean(period.from || period.to)

  let periodLabel = ''
  if (hasPeriod) {
    periodLabel = formatPeriodHeading(period)
    if (yearEnded && period.to) periodLabel = formatYearEnded(period)
    if (asOf && period.to) periodLabel = formatLongDate(period.to)
  }

  return (
    <header className="stmt-head stmt-unified">
      <div className="stmt-company">{company}</div>
      <div className="stmt-title">{title}</div>
      {periodLabel ? <div className="stmt-period">{periodLabel}</div> : null}
    </header>
  )
}
