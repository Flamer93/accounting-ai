import { useApp } from '../AppContext'
import { formatLongDate, formatPeriodHeading, formatYearEnded } from '../moneyFormat'

interface Props {
  title: string
  /** Green block vs Apple muted/centered vs ledger green band vs plain journal. */
  variant?: 'green' | 'apple' | 'ledger' | 'plain'
  /** Use "For the Year Ended …" wording when a period end is set. */
  yearEnded?: boolean
  /** Show a single as-of date when period.to is set. */
  asOf?: boolean
}

const COMPANY_PLACEHOLDER = '[Company Name]'

export function StatementHeader({
  title,
  variant = 'green',
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

  if (variant === 'apple') {
    return (
      <header className="stmt-head apple">
        <div className="stmt-company">{company}</div>
        <div className="stmt-title">{title.toUpperCase()}</div>
        {periodLabel ? <div className="stmt-period muted-italic">{periodLabel}</div> : null}
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
        <div className="stmt-company">
          {settings.companyName.trim() ? `${company}'s Journal` : 'General Journal'}
        </div>
      </header>
    )
  }

  return (
    <header className="stmt-head green-block">
      <div className="stmt-company">{company}</div>
      <div className="stmt-title">{title}</div>
      {periodLabel ? <div className="stmt-period">{periodLabel}</div> : null}
    </header>
  )
}
