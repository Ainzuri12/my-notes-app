import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

type PdfDocumentViewerProps = {
  file: File | null;
  pageNumber: number;
  onPageCount: (count: number) => void;
  onPageChange: (page: number) => void;
};

type PdfState = { document: pdfjsLib.PDFDocumentProxy; source: string } | null;

export function PdfDocumentViewer({ file, pageNumber, onPageCount, onPageChange }: PdfDocumentViewerProps) {
  const [pdfState, setPdfState] = useState<PdfState>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thumbs, setThumbs] = useState<string[]>([]);
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
    document.getPage(pageNumber).then(async (page) => {
      if (cancelled || !pageCanvasRef.current) return;
      const viewport = page.getViewport({ scale: 1.4 });
      const canvas = pageCanvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
    }).catch(() => setError("The selected page could not be rendered."));
    return () => { cancelled = true; };
  }, [pdfState, pageNumber]);

  useEffect(() => {
    const document = pdfState?.document;
    if (!document) return;
    let cancelled = false;
    const renderThumbs = async () => {
      const rendered: string[] = [];
      for (let index = 1; index <= document.numPages; index += 1) {
        if (cancelled) return;
        const page = await document.getPage(index);
        const viewport = page.getViewport({ scale: 0.22 });
        const canvas = window.document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
        rendered.push(canvas.toDataURL("image/jpeg", 0.76));
        setThumbs([...rendered]);
      }
    };
    renderThumbs().catch(() => setError("Some page thumbnails could not be rendered."));
    return () => { cancelled = true; };
  }, [pdfState]);

  if (!file) return null;
  if (loading) return <div className="flex min-h-[620px] items-center justify-center rounded-xl bg-[#fffdf8] text-sm font-semibold text-[#8a8880]">Rendering {file.name}…</div>;
  if (error) return <div className="flex min-h-[620px] items-center justify-center rounded-xl bg-[#fffdf8] px-6 text-center text-sm font-semibold text-[#bd5f50]">{error}</div>;
  if (!pdfState) return null;

  return (
    <div className="grid min-h-[620px] grid-cols-[76px_minmax(0,1fr)] gap-4 rounded-xl bg-[#fffdf8] p-3 sm:grid-cols-[92px_minmax(0,1fr)] sm:p-5">
      <div className="space-y-3 overflow-y-auto pr-1" aria-label="PDF page thumbnails">
        {thumbs.map((thumbnail, index) => {
          const page = index + 1;
          return <button key={thumbnail} onClick={() => onPageChange(page)} className={`group w-full rounded-lg border p-1.5 text-left transition ${page === pageNumber ? "border-[#d66f59] bg-[#fff2ec] shadow-sm" : "border-[#e5dfd4] bg-[#f8f5ef] hover:border-[#d7b1a5]"}`}><img src={thumbnail} alt={`Page ${page}`} className="w-full rounded-[3px] border border-black/5" /><span className={`mt-1 block text-center text-[10px] font-bold ${page === pageNumber ? "text-[#c56854]" : "text-[#99978f]"}`}>{page}</span></button>;
        })}
        {!thumbs.length && <div className="space-y-2">{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-lg bg-[#f0ebe3]" />)}</div>}
      </div>
      <div className="flex min-w-0 flex-col items-center overflow-auto rounded-lg bg-[#e5ded2] p-3 sm:p-5"><div className="mb-3 flex w-full items-center justify-between text-[11px] font-bold uppercase tracking-[0.16em] text-[#8f887d]"><span className="truncate">{pdfState.source}</span><span className="shrink-0">Page {pageNumber} / {pdfState.document.numPages}</span></div><canvas ref={pageCanvasRef} className="h-auto w-full max-w-[560px] rounded-[2px] bg-white shadow-[0_14px_28px_rgba(62,52,40,0.18)]" /></div>
    </div>
  );
}
