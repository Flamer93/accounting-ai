import type { ChangeEventHandler, SelectHTMLAttributes } from 'react'
import { groupAccountsByType } from '../chartOfAccounts'
import type { Account } from '../types'

type Props = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'value'> & {
  accounts: Account[]
  value: string | string[]
  onChange: ChangeEventHandler<HTMLSelectElement>
  /** Optional empty/placeholder option (value ""). Ignored when multiple. */
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
  multiple,
  ...rest
}: Props) {
  const groups = groupAccountsByType(accounts)

  return (
    <select
      value={value}
      onChange={onChange}
      multiple={multiple}
      {...rest}
    >
      {placeholder != null && !multiple && <option value="">{placeholder}</option>}
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
