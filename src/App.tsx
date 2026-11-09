import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './AppContext'
import { Layout } from './components/Layout'
import { BalanceSheet } from './pages/BalanceSheet'
import { Documents } from './pages/Documents'
import { Home } from './pages/Home'
import { IncomeStatement } from './pages/IncomeStatement'
import { Journal } from './pages/Journal'
import { Ledger } from './pages/Ledger'
import { TAccounts } from './pages/TAccounts'
import { TrialBalance } from './pages/TrialBalance'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="documents" element={<Documents />} />
            <Route path="journal" element={<Journal />} />
            <Route path="ledger" element={<Ledger />} />
            <Route path="t-accounts" element={<TAccounts />} />
            <Route path="trial-balance" element={<TrialBalance />} />
            <Route path="balance-sheet" element={<BalanceSheet />} />
            <Route path="income-statement" element={<IncomeStatement />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
