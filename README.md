# Secret Chamber Credits

`Secret Chamber Credits` is a mobile-first shared wallet app for GitHub Pages.

## Included

- Member login with name and 4-digit code
- Fixed operator account: `&#50948;&#46300; / 4001`
- Korean won mode and fantasy coin mode: gold, silver, copper
- Send-only member transfers
- Operator wallet view, member ranking, manual `+ / -` adjustment, member delete, seed capital button, and reset
- Realtime alerts, notification tab, ledger, chat, and profile photo upload
- Local persistence, tab-to-tab realtime sync, and optional Firebase Realtime Database sync

## Run Locally

Open `index.html` in a browser.

For service worker or Firebase testing, serve the folder:

```bash
python -m http.server 4173
```

Then open `http://localhost:4173`.

## GitHub Pages

1. Push these files to a GitHub repository.
2. Enable GitHub Pages from the repository settings.
3. Open the Pages URL on phones.

## Multi-Phone Realtime Sync

GitHub Pages is static hosting, so shared realtime data needs a database. This app supports Firebase Realtime Database:

1. Create a Firebase project.
2. Create a Realtime Database.
3. Copy `firebase-config.example.js` to `firebase-config.js`.
4. Replace the placeholder values with your Firebase web app config.
5. Commit `firebase-config.js` if the database rules are safe for your group, or keep it private for local testing.

The app works without Firebase, but data is then stored only in the current browser.
For sync across different phones, `firebase-config.js` must exist in the repository root and Firebase Realtime Database rules must allow your group to read and write the configured path.

## GitHub Folder Auto Upload

The operator screen includes a GitHub Sync panel. It can upload the current credit state to:

```text
data/credits-state.json
```

Use:

- Owner: `SECRET-CHAMBER-WID`
- Repo: `money`
- Branch: `main`
- Path: `data/credits-state.json`
- Token: a fine-grained GitHub token with repository Contents read/write permission

Do not commit the token into the repository. The token is stored only in the operator browser local storage.

GitHub Sync is best used as backup/history. Firebase is still the better realtime sync path for many phones because every credit transfer needs a shared write target.

## Git Program Upload

This folder includes two PowerShell helpers that use Git for Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\sync-to-github.ps1
```

Runs one upload now.

```powershell
powershell -ExecutionPolicy Bypass -File .\watch-and-upload.ps1
```

Keeps watching this folder and uploads after file changes.

The scripts use a clean hidden clone at `.github-sync/`, then copy the app files into that clone, commit, and push to `SECRET-CHAMBER-WID/money` on `main`.

You need to be logged in to GitHub through Git Credential Manager, or Git push will ask you to authenticate. Do not put GitHub tokens directly inside these scripts.
