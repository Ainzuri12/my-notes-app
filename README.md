# Paperflow Notes

A tablet-first, installable React PWA for handwritten notes, typed notes, imported PDFs, and study documents.

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

## Upload to GitHub

1. Create an empty GitHub repository.
2. Upload the contents of this folder, including `package.json` and `pnpm-lock.yaml`.
3. In the repository settings, open **Pages** and choose **GitHub Actions** as the source.
4. Push to the `main` branch. The included `.github/workflows/deploy-pages.yml` builds and deploys the app automatically on every push.

The build is configured for GitHub Pages project URLs. The app is local-first: notebook data stays in each browser's IndexedDB/local storage. GitHub Pages publishes the app code but does not synchronize private notebook data between devices.

## Notes about imported PDFs

Imported PDFs are kept in IndexedDB on the device. The annotated PDF export preserves the original document and overlays handwriting strokes from the currently open page. Use the `.paperflow.json` export as an additional portable backup for notebook metadata and editable stroke data.

## Project structure

- `client/src/pages/Home.tsx` — library, notebook editor, folders, Trash, and export behavior
- `client/src/components/PdfDocumentViewer.tsx` — PDF rendering and page navigation
- `client/src/lib/pdfStore.ts` — IndexedDB PDF persistence
- `client/public/manifest.json` and `client/public/sw.js` — installable/offline PWA shell
- `.github/workflows/deploy-pages.yml` — automatic GitHub Pages deployment
