# Secret Chamber Credits

`Secret Chamber Credits` is a mobile-first shared wallet app for GitHub Pages.

## Included

- Member login with name and 4-digit code
- Fixed operator account: `위드 / 4001`
- Korean won mode and fantasy coin mode: gold, silver, copper, tin
- Send-only member transfers
- Operator wallet view, member ranking, manual `+ / -` adjustment, seed capital button, and reset
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
