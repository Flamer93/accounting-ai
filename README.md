# Accounting AI (Receipt Ledger)

Private multi-account bookkeeping: sign in, keep blank books per user, post journal entries, and keep ledger / T-accounts / trial balance / income statement / balance sheet in sync.

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173

Without Firebase env vars the app uses **Local mock auth** (banner) — accounts and books stay in this browser, scoped by mock uid.

Production-style:

```bash
npm run build
npm start
```

## Firebase (multi-account)

Set these host env vars / Cursor secrets (no `VITE_` / `NEXT_PUBLIC_` prefixes):

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`

Enable Email/Password (and optionally Google) in Firebase Authentication, and Firestore with rules that restrict `users/{uid}/**` to that uid. See internal notes for rules and publish binding.

## Notes

- Per-user books persist in Firestore (`users/{uid}/books/main`) when Firebase is configured; otherwise per-uid localStorage.
- Blank books template — no seed company data.
- Optional extract keys are client-side and scoped to the signed-in uid.
- Never commit API keys. Bind `OPENAI_API_KEY` for host OpenAI extract if needed.
