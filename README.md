# Receipt Ledger

Private bookkeeping app: upload receipt photos, extract journal entries (OpenAI when `OPENAI_API_KEY` is set, otherwise a mock extractor), then generate general journal, ledger, T-accounts, trial balance, balance sheet, and income statement.

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173

Production-style:

```bash
npm run build
npm start
```

## Notes

- Documents and journal entries persist in browser `localStorage`.
- Sample receipts and entries seed on first load.
- Never commit an API key. Bind `OPENAI_API_KEY` as an app secret for published AI extraction.
