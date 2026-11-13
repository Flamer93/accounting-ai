import type { ChangeEventHandler, SelectHTMLAttributes } from 'react'
import { groupAccountsByType } from '../chartOfAccounts'
import type { Account } from '../types'

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  accounts: Account[]
  value: string
  onChange: ChangeEventHandler<HTMLSelectElement>
  /** Optional empty/placeholder option (value ""). */
  placeholder?: string
  /** Show account code beside the name. */
  showCode?: boolean
}

/**
 * Account dropdown grouped by Assets / Liabilities / Owner's Equity / Revenue / Expenses.
 */
export function AccountSelect({
  accounts,
  value,
  onChange,
  placeholder,
  showCode = false,
  ...rest
}: Props) {
  const groups = groupAccountsByType(accounts)

  return (
    <select value={value} onChange={onChange} {...rest}>
      {placeholder != null && <option value="">{placeholder}</option>}
      {groups.map((group) => (
        <optgroup key={group.type} label={group.label}>
          {group.accounts.map((a) => (
            <option key={a.code} value={a.code}>
              {showCode ? `${a.code} · ${a.name}` : a.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  )
}
