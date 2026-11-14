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

## Desktop (Windows + macOS)

One Electron shell wraps the same UI + local Express extract API.

```bash
npm run electron:dev          # Express/Vite + Electron window
npm run electron:build:win    # portable .exe (zip for GitHub releases)
npm run electron:build:mac    # ZIP x64 + arm64 (macOS 13 Ventura+)
```

macOS builds default to **unsigned** (`CSC_IDENTITY_AUTO_DISCOVERY=false`) so local/CI works without Apple certs. Signing/notarization needs a Developer ID — see internal desktop notes.

Packaged apps load `FIREBASE_*` / `OPENAI_API_KEY` from the process env or a `desktop.env` file under the app userData folder (see `electron/desktop.env.example`).

### Updating / replacing an old install

New GitHub zip releases do **not** auto-delete prior installs. Quit the app, then overwrite:

- **Windows folder zip:** delete/rename the old folder, unzip the new `Accounting-AI-win-x64-folder.zip`, run `Accounting-AI.exe`.
- **Windows portable zip:** overwrite/delete the old `.exe`, run the new one from `Accounting-AI-win-x64.zip`.
- **macOS:** drag the new `Accounting AI.app` onto Applications and choose **Replace**. Right-click → Open on first launch.

See `electron/REPLACE-INSTALL.txt` (also shipped inside release zips). Local books live under app userData and are kept unless you delete that folder.

## Notes

- Per-user books persist in Firestore (`users/{uid}/books/main`) when Firebase is configured; otherwise per-uid localStorage.
- Blank books template — no seed company data.
- Optional extract keys are client-side and scoped to the signed-in uid.
- Never commit API keys. Bind `OPENAI_API_KEY` for host OpenAI extract if needed.
