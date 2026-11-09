import { useApp } from '../AppContext'

export function PeriodControls() {
  const { period, setPeriod } = useApp()
  return (
    <div className="period">
      <label>
        From
        <input
          type="date"
          value={period.from || ''}
          onChange={(e) => setPeriod({ ...period, from: e.target.value || undefined })}
        />
      </label>
      <label>
        To
        <input
          type="date"
          value={period.to || ''}
          onChange={(e) => setPeriod({ ...period, to: e.target.value || undefined })}
        />
      </label>
    </div>
  )
}
