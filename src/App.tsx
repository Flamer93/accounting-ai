import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppProvider } from './AppContext'
import { CompanyProvider, useCompany } from './CompanyContext'
import { Layout } from './components/Layout'
import { AuthProvider, useAuth } from './firebase/AuthContext'
import { AddTransaction } from './pages/AddTransaction'
import { BalanceSheet } from './pages/BalanceSheet'
import { GuardedView } from './pages/GuardedView'
import { Home } from './pages/Home'
import { IncomeStatement } from './pages/IncomeStatement'
import { Journal } from './pages/Journal'
import { Ledger } from './pages/Ledger'
import { Settings } from './pages/Settings'
import { TAccounts } from './pages/TAccounts'
import { TrialBalance } from './pages/TrialBalance'

function AuthenticatedApp() {
  const { user, mode, firestore } = useAuth()
  const { companyId } = useCompany()

  return (
    <AppProvider
      key={`${user.uid}:${companyId}`}
      userId={user.uid}
      companyId={companyId}
      authMode={mode}
      firestore={firestore}
    >
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="settings" element={<Settings />} />
            <Route path="add-transaction" element={<AddTransaction />} />
            <Route
              path="journal"
              element={
                <GuardedView view="journal">
                  <Journal />
                </GuardedView>
              }
            />
            <Route
              path="ledger"
              element={
                <GuardedView view="ledger">
                  <Ledger />
                </GuardedView>
              }
            />
            <Route
              path="t-accounts"
              element={
                <GuardedView view="tAccounts">
                  <TAccounts />
                </GuardedView>
              }
            />
            <Route
              path="trial-balance"
              element={
                <GuardedView view="trialBalance">
                  <TrialBalance />
                </GuardedView>
              }
            />
            <Route
              path="balance-sheet"
              element={
                <GuardedView view="balanceSheet">
                  <BalanceSheet />
                </GuardedView>
              }
            />
            <Route
              path="income-statement"
              element={
                <GuardedView view="incomeStatement">
                  <IncomeStatement />
                </GuardedView>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <AuthenticatedApp />
      </CompanyProvider>
    </AuthProvider>
  )
}
