import { buildBalanceSheet, buildIncomeStatement, buildTrialBalance } from '../src/accounting.ts'
import { cascadeRemoveDocument } from '../src/documentCascade.ts'
import { createSeedData } from '../src/seed.ts'

const { documents, entries } = createSeedData()
const beforeTb = buildTrialBalance(entries)
const beforeBs = buildBalanceSheet(entries)
const beforeIs = buildIncomeStatement(entries)

const office = documents.find((d) => d.id === 'doc_seed_office')
if (!office) throw new Error('missing office seed doc')

const after = cascadeRemoveDocument(documents, entries, office.id)
const afterTb = buildTrialBalance(after.entries)
const afterBs = buildBalanceSheet(after.entries)
const afterIs = buildIncomeStatement(after.entries)

const removed = entries.filter((e) => !after.entries.some((x) => x.id === e.id))

console.log(
  JSON.stringify(
    {
      removedDoc: office.id,
      removedEntryIds: removed.map((e) => e.id),
      docsBefore: documents.length,
      docsAfter: after.documents.length,
      entriesBefore: entries.length,
      entriesAfter: after.entries.length,
      trialBalance: {
        before: { debit: beforeTb.totalDebit, credit: beforeTb.totalCredit },
        after: { debit: afterTb.totalDebit, credit: afterTb.totalCredit },
      },
      income: {
        beforeNet: beforeIs.netIncome,
        afterNet: afterIs.netIncome,
      },
      balanceSheet: {
        beforeAssets: beforeBs.totalAssets,
        afterAssets: afterBs.totalAssets,
      },
      officeExpenseGone: !afterTb.rows.some((r) => r.code === '5200'),
    },
    null,
    2,
  ),
)

if (after.documents.some((d) => d.id === office.id)) throw new Error('doc still present')
if (after.entries.some((e) => e.documentId === office.id || office.entryIds.includes(e.id))) {
  throw new Error('linked entries still present')
}
if (afterIs.netIncome === beforeIs.netIncome) throw new Error('net income unchanged')
if (afterBs.totalAssets === beforeBs.totalAssets) throw new Error('assets unchanged')
if (afterTb.rows.some((r) => r.code === '5200')) throw new Error('office supplies still on TB')
if (afterTb.totalDebit !== afterTb.totalCredit) throw new Error('trial balance out of balance')
if (afterIs.netIncome !== 1251) throw new Error(`unexpected net income ${afterIs.netIncome}`)
if (afterBs.totalAssets !== 6251) throw new Error(`unexpected assets ${afterBs.totalAssets}`)

// Also: edited-but-still-linked entry is removed with the doc
const edited = {
  ...entries.find((e) => e.id === 'je_seed_2')!,
  memo: 'manually edited rent',
  editRequired: false,
}
const withEdit = entries.map((e) => (e.id === edited.id ? edited : e))
const afterEditDelete = cascadeRemoveDocument(documents, withEdit, 'doc_seed_rent')
if (afterEditDelete.entries.some((e) => e.id === 'je_seed_2')) {
  throw new Error('manually edited linked entry survived doc delete')
}

console.log('cascade delete verified')
