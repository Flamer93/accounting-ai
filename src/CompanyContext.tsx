import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createCompany as createCompanyMeta,
  deleteCompany as deleteCompanyMeta,
  getActiveCompanyId,
  listCompanies,
  renameCompany as renameCompanyMeta,
  setActiveCompanyId,
  type CompanyMeta,
} from './companies'

type CompanyState = {
  companyId: string
  companies: CompanyMeta[]
  activeCompany: CompanyMeta | null
  refreshCompanies: () => void
  switchCompany: (id: string) => void
  createCompany: (name: string) => CompanyMeta
  renameCompany: (id: string, name: string) => CompanyMeta
  deleteCompany: (id: string) => void
}

const Ctx = createContext<CompanyState | null>(null)

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [companyId, setCompanyId] = useState(() => getActiveCompanyId())
  const [companies, setCompanies] = useState(() => listCompanies())

  const refreshCompanies = useCallback(() => {
    setCompanies(listCompanies())
  }, [])

  const switchCompany = useCallback((id: string) => {
    setActiveCompanyId(id)
    setCompanyId(id)
    setCompanies(listCompanies())
  }, [])

  const createCompany = useCallback((name: string) => {
    const created = createCompanyMeta(name)
    setCompanies(listCompanies())
    setActiveCompanyId(created.id)
    setCompanyId(created.id)
    return created
  }, [])

  const renameCompany = useCallback((id: string, name: string) => {
    const updated = renameCompanyMeta(id, name)
    setCompanies(listCompanies())
    return updated
  }, [])

  const deleteCompany = useCallback(
    (id: string) => {
      deleteCompanyMeta(id)
      const nextId = getActiveCompanyId()
      setCompanies(listCompanies())
      setCompanyId(nextId)
    },
    [],
  )

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === companyId) ?? null,
    [companies, companyId],
  )

  const value = useMemo(
    () => ({
      companyId,
      companies,
      activeCompany,
      refreshCompanies,
      switchCompany,
      createCompany,
      renameCompany,
      deleteCompany,
    }),
    [
      companyId,
      companies,
      activeCompany,
      refreshCompanies,
      switchCompany,
      createCompany,
      renameCompany,
      deleteCompany,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCompany(): CompanyState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCompany requires CompanyProvider')
  return ctx
}
