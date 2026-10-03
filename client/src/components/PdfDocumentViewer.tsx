import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type PdfDocumentViewerProps = {
  file: File | null;
  pageNumber: number;
  onPageCount: (count: number) => void;
  onPageChange: (page: number) => void;
  overlay?: ReactNode;
  zoom?: number;
};

type PdfState = { document: pdfjsLib.PDFDocumentProxy; source: string } | null;

export function PdfDocumentViewer({ file, pageNumber, onPageCount, onPageChange, overlay, zoom = 100 }: PdfDocumentViewerProps) {
  const [pdfState, setPdfState] = useState<PdfState>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<Array<string | null>>([]);
  const pageCanvasRef = useRef<HTMLCanvasElement>(null);
  const generationRef = useRef(0);

  useEffect(() => {
    if (!file) {
      setPdfState(null);
      setThumbs([]);
      setError(null);
      return;
    }
    const generation = ++generationRef.current;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setThumbs([]);
    file.arrayBuffer().then((data) => pdfjsLib.getDocument({ data }).promise).then((document) => {
      if (cancelled || generation !== generationRef.current) return;
      setPdfState({ document, source: file.name });
      setThumbs(Array.from({ length: document.numPages }, () => null));
      onPageCount(document.numPages);
      onPageChange(1);
      setLoading(false);
    }).catch(() => {
      if (cancelled) return;
      setError("This PDF could not be rendered in the browser.");
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [file]);

  useEffect(() => {
    const document = pdfState?.document;
    if (!document) return;
    let cancelled = false;
    const safePageNumber = Math.min(document.numPages, Math.max(1, pageNumber));
    document.getPage(safePageNumber).then(async (page) => {
      if (cancelled || !pageCanvasRef.current) return;
      const viewport = page.getViewport({ scale: 1.4 * Math.max(25, zoom) / 100 });
      const canvas = pageCanvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
    }).catch(() => setError("The selected page could not be rendered."));
    return () => { cancelled = true; };
  }, [pdfState, pageNumber, zoom]);

  useEffect(() => {
    const document = pdfState?.document;
    if (!document) return;
    let cancelled = false;
    const renderThumbs = async () => {
      // Render in small batches so the selected page stays responsive even for
      // large documents. Placeholders are shown immediately for every page.
      for (let start = 1; start <= document.numPages; start += 3) {
        if (cancelled) return;
        const indexes = Array.from({ length: Math.min(3, document.numPages - start + 1) }, (_, offset) => start + offset);
        await Promise.all(indexes.map(async (index) => {
          try {
            const page = await document.getPage(index);
            const viewport = page.getViewport({ scale: 0.22 });
            const canvas = window.document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
            if (!cancelled) setThumbs((current) => current.map((thumbnail, pageIndex) => pageIndex === index - 1 ? canvas.toDataURL("image/jpeg", 0.76) : thumbnail));
            page.cleanup();
          } catch {
            // Keep the page slot available even if an individual thumbnail is
            // not renderable; the full-size page can still be selected/rendered.
          }
        }));
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      }
    };
    void renderThumbs();
    return () => { cancelled = true; };
  }, [pdfState]);

  if (!file) return null;
  if (loading) return <div className="flex min-h-[620px] items-center justify-center rounded-xl bg-[#fffdf8] text-sm font-semibold text-[#8a8880]">Rendering {file.name}…</div>;
  if (error) return <div className="flex min-h-[620px] items-center justify-center rounded-xl bg-[#fffdf8] px-6 text-center text-sm font-semibold text-[#bd5f50]">{error}</div>;
  if (!pdfState) return null;

  return (
    <div className="pdf-document-viewer grid min-h-[620px] grid-cols-[76px_minmax(0,1fr)] gap-4 rounded-xl bg-[#fffdf8] p-3 sm:grid-cols-[92px_minmax(0,1fr)] sm:p-5">
      <div className="space-y-3 overflow-y-auto pr-1" aria-label="PDF page thumbnails">
        {thumbs.map((thumbnail, index) => {
          const page = index + 1;
          return <button key={page} onClick={() => onPageChange(page)} className={`group w-full rounded-lg border p-1.5 text-left transition ${page === pageNumber ? "border-[#d66f59] bg-[#fff2ec] shadow-sm" : "border-[#e5dfd4] bg-[#f8f5ef] hover:border-[#d7b1a5]"}`} aria-label={`Go to page ${page}`}>
            {thumbnail ? <img src={thumbnail} alt={`Page ${page}`} className="w-full rounded-[3px] border border-black/5" /> : <span className="block aspect-[0.72] w-full animate-pulse rounded-[3px] border border-black/5 bg-[#eee8df]" aria-hidden="true" />}
            <span className={`mt-1 block text-center text-[10px] font-bold ${page === pageNumber ? "text-[#c56854]" : "text-[#99978f]"}`}>{page}</span>
          </button>;
        })}
        {!thumbs.length && <div className="space-y-2">{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg bg-[#f0ebe3]" />)}</div>}
      </div>
      <div className="flex min-w-0 flex-col items-center overflow-auto rounded-lg bg-[#e5ded2] p-3 sm:p-5"><div className="mb-3 flex w-full items-center justify-between text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f887d]"><span className="truncate">{pdfState.source}</span><span className="shrink-0">Page {pageNumber} / {pdfState.document.numPages}</span></div><div className="relative max-w-none" style={{ width: `${Math.max(25, zoom)}%` }}><canvas ref={pageCanvasRef} className="block h-auto w-full rounded-[2px] bg-white shadow-[0_14px_28px_rgba(62,52,40,0.18)]" />{overlay && <div className="pointer-events-none absolute inset-0">{overlay}</div>}</div></div>
    </div>
  );
}
