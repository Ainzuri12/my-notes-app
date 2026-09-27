# Paperflow Notes

A tablet-first, installable React PWA for handwritten notes, typed notes, imported PDFs, and study documents.

## Open the app

**The GitHub repository page is only the source-code/documentation page. It will show this README when you open the repository itself.** The app is published separately by GitHub Pages after the workflow finishes.

After pushing this project to GitHub:

1. Open the repository's **Actions** tab and wait for **Build and deploy Paperflow Notes** to finish successfully.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Open the Pages URL shown in the workflow or under **Settings → Pages**. For a repository named `paperflow-notes`, it will usually be:
   `https://YOUR-USERNAME.github.io/paperflow-notes/`

The workflow supports both `main` and `master` branches. It builds the app, adds the GitHub Pages SPA fallback, and deploys `dist/public` automatically on every push.

## What works

- Create a new notebook with a real ruled blank page
- Write with Apple Pencil, stylus, mouse, or touch using the Pen tool
- Add typed notes with the Text tool
- Add additional blank pages and move between pages
- Undo, redo, eraser, highlight, straight-line, lasso, and selection tools
- Import PDFs and annotate them in the workspace
- Export portable `.paperflow.json` backups
- Export an imported PDF with the current page's handwriting overlaid
- Persist notebooks, folders, page count, typed notes, handwriting, and imported PDFs locally
- Organize notebooks with folders, nested folders, drag-and-drop reordering, collapse/expand, and bulk actions
- Restore or permanently delete notebooks and folders from Trash
- Install as a PWA on iPadOS, Android tablets, and desktop browsers

## Run locally

Requirements: Node.js 22 and pnpm 10.

```bash
pnpm install
pnpm dev
```

Open the local URL printed by Vite. For a production build:

```bash
pnpm run check
pnpm run build
pnpm run preview
```

## Data and privacy

The app is local-first: notebook data stays in each browser's IndexedDB/local storage. GitHub Pages publishes the app code but does not synchronize private notebook data between devices.

Imported PDFs are kept in IndexedDB on the device. The annotated PDF export preserves the original document and overlays handwriting strokes from the currently open page. Use the `.paperflow.json` export as an additional portable backup for notebook metadata and editable stroke data.

## Project structure

- `client/src/pages/Home.tsx` — library, notebook editor, folders, Trash, and export behavior
- `client/src/components/PdfDocumentViewer.tsx` — PDF rendering and page navigation
- `client/src/lib/pdfStore.ts` — IndexedDB PDF persistence
- `client/public/manifest.json` and `client/public/sw.js` — installable/offline PWA shell
- `.github/workflows/deploy-pages.yml` — automatic GitHub Pages deployment
