import { useApp } from '../AppContext'
import { formatLongDate, formatPeriodHeading, formatYearEnded } from '../moneyFormat'

interface Props {
  title: string
  /** Paul's Guitar green block vs Apple muted/centered vs ledger green band. */
  variant?: 'green' | 'apple' | 'ledger' | 'plain'
  /** Use "For the Year Ended …" wording when true. */
  yearEnded?: boolean
  /** Show a single as-of date (balance sheet / trial balance). */
  asOf?: boolean
}

export function StatementHeader({
  title,
  variant = 'green',
  yearEnded = false,
  asOf = false,
}: Props) {
  const { settings, period } = useApp()
  const company = settings.companyName || 'Company'

  let periodLabel = formatPeriodHeading(period)
  if (yearEnded) periodLabel = formatYearEnded(period)
  if (asOf && period.to) periodLabel = formatLongDate(period.to)

  if (variant === 'apple') {
    return (
      <header className="stmt-head apple">
        <div className="stmt-company">{company}</div>
        <div className="stmt-title">{title.toUpperCase()}</div>
        <div className="stmt-period muted-italic">{periodLabel}</div>
      </header>
    )
  }

  if (variant === 'ledger') {
    return (
      <header className="stmt-head ledger-green">
        <div className="stmt-company">{company}</div>
        <div className="stmt-title">{title}</div>
      </header>
    )
  }

  if (variant === 'plain') {
    return (
      <header className="stmt-head plain">
        <div className="stmt-company">{company}&apos;s Journal</div>
      </header>
    )
  }

  return (
    <header className="stmt-head green-block">
      <div className="stmt-company">{company}</div>
      <div className="stmt-title">{title}</div>
      <div className="stmt-period">{periodLabel}</div>
    </header>
  )
}
