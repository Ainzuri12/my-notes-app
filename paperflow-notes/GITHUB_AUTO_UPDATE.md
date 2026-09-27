# Paperflow Notes: automatic updates from GitHub

Paperflow is a static PWA, so the code can be hosted from any static deployment service. The included workflow rebuilds the app and publishes it to GitHub Pages every time code is pushed to `main`.

## One-time setup

1. Create a GitHub repository and push this project to it.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main` (or run the workflow manually from the Actions tab).
4. GitHub will build the app with `pnpm run build` and deploy the generated `dist/public` folder.

After that, every push to `main` automatically publishes the newest build. Users who have installed Paperflow to an iPad or Android tablet will receive the refreshed app shell the next time the app opens; the service worker refreshes cached assets while keeping the local notebook data in the browser.

## Important data note

The current starter app is **local-first**: notebooks and drawing state are stored in the browser, and `.paperflow.json` export creates portable backups. GitHub Pages deploys the app code only; it does not sync a user's notebook contents between devices. A future cloud-sync update should add authentication and a database before moving notebooks off-device.

## If you use another host

Use the same build output (`dist/public`) and keep the workflow's build step. Most Git-based hosts can deploy automatically from the same `main` push trigger.
