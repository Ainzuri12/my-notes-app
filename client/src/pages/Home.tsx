import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PdfDocumentViewer } from "@/components/PdfDocumentViewer";
import { deleteImportedPdf, loadImportedFile, saveImportedFile } from "@/lib/pdfStore";
import { PDFDocument, rgb } from "pdf-lib";
import {
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Download,
  Eraser,
  File,
  FileDown,
  FileText,
  FileUp,
  Folder,
  Grid2X2,
  Highlighter,
  Image as ImageIcon,
  LayoutList,
  LayoutTemplate,
  Map as MapIcon,
  Lasso,
  Minus,
  RotateCcw,
  Menu,
  MoreHorizontal,
  NotebookPen,
  Palette,
  PanelLeft,
  PenLine,
  Pencil,
  Plus,
  Printer,
  Redo2,
  Search,
  Settings2,
  Sparkles,
  Tablet,
  Trash2,
  Undo2,
  UploadCloud,
  Wifi,
  X,
  ZoomIn,
  ZoomOut,
  Copy,
  Maximize2,
  RotateCw,
  SlidersHorizontal,
  Sun,
  Moon,
  Contrast,
  Type,
  MoveHorizontal,
  Save,
  CheckCircle,
} from "lucide-react";

type Tool = "select" | "pen" | "highlight" | "eraser" | "lasso" | "line" | "text";
type Point = { x: number; y: number; p: number };
type Stroke = { points: Point[]; color: string; width: number; opacity: number };
type Board = { id: string; title: string; updated: string; pageNumber?: number; templateId?: string; color?: string };
type Notebook = {
  id: string;
  title: string;
  subtitle: string;
  pages: number;
  updated: string;
  color: string;
  icon: string;
  folderId?: string;
  boards: Board[];
};

type Folder = { id: string; name: string; color: string; parentId?: string | null };

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 20000;
const STROKE_STORAGE_KEY = "paperflow-stroke-pages";
const SETTINGS_STORAGE_KEY = "paperflow-settings";
const IMAGE_PAGE_STORAGE_KEY = "paperflow-image-pages";
const IMAGE_LAYOUT_STORAGE_KEY = "paperflow-image-layouts";
const IMAGE_ITEMS_STORAGE_KEY = "paperflow-image-items";

type DrawingSettings = { selectedColor: string; penSize: number; zoom: number };
type DisplayPreferences = { theme: "light" | "dark" | "contrast"; largeText: boolean; reducedMotion: boolean; compactToolbar: boolean; leftHanded: boolean };
type ImportStatus = { name: string; progress: number; message: string; error?: boolean };
const DISPLAY_PREFS_KEY = "paperflow-display-preferences";
const defaultDisplayPreferences: DisplayPreferences = { theme: "light", largeText: false, reducedMotion: false, compactToolbar: false, leftHanded: false };
type ImageLayout = { x: number; y: number; scale: number };
type ImageItem = { id: string; name: string; layout: ImageLayout };
type PageTemplate = { id: string; name: string; description: string; icon: string; preview: string; color: string };

const pageTemplates: PageTemplate[] = [
  { id: "lined", name: "Lined notes", description: "Classic ruled paper for lectures and journaling.", icon: "≡", preview: "linear-gradient(#fffdf8 0 0) padding-box, repeating-linear-gradient(to bottom, transparent 0 30px, #d8e0e5 31px 32px)", color: "#fffdf8" },
  { id: "dot-grid", name: "Dot grid", description: "A flexible grid for planning, diagrams, and sketches.", icon: "⁙", preview: "radial-gradient(#b8c7cf 1.2px, transparent 1.2px)", color: "#fffdf8" },
  { id: "blank", name: "Blank canvas", description: "A clean page for freeform handwriting and drawing.", icon: "□", preview: "#fffdf8", color: "#fffdf8" },
  { id: "cornell", name: "Cornell notes", description: "Notes, cues, and summary areas for revision.", icon: "▥", preview: "linear-gradient(90deg, transparent 0 24%, #e2b6a8 24% 24.5%, transparent 24.5%), linear-gradient(#fffdf8 0 0)", color: "#fffdf8" },
  { id: "checklist", name: "Checklist", description: "A structured page for tasks, habits, and study plans.", icon: "✓", preview: "repeating-linear-gradient(to bottom, #fffdf8 0 30px, #d8e0e5 31px 32px)", color: "#fffdf8" },
  { id: "graph", name: "Graph paper", description: "Precise squares for maths, charts, and geometry.", icon: "▦", preview: "linear-gradient(#d8e0e5 1px, transparent 1px), linear-gradient(90deg, #d8e0e5 1px, transparent 1px)", color: "#fffdf8" },
];

function readStored<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeStored<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function makeBoards(count: number, prefix = "Whiteboard", updated = "Edited a while ago"): Board[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    id: `${prefix.toLowerCase().replace(/\s+/g, "-")}-${makeId()}`,
    title: `${prefix} ${index + 1}`,
    updated,
    pageNumber: index + 1,
  }));
}

const biologyBoards: Board[] = makeBoards(38, "Whiteboard", "Edited 12 min ago").map((board, index) =>
  index === 3 ? { ...board, id: "bio-cellular-respiration", title: "Cellular respiration" } : board,
);
const mathsBoards: Board[] = makeBoards(24, "Whiteboard", "Edited yesterday");
const ideasBoards: Board[] = makeBoards(17, "Whiteboard", "Edited 3 days ago");

const defaultNotebooks: Notebook[] = [
  {
    id: "biology",
    title: "Biology · Unit 04",
    subtitle: "Cellular respiration + past papers",
    pages: biologyBoards.length,
    updated: "Edited 12 min ago",
    color: "coral",
    icon: "BIO",
    boards: biologyBoards,
  },
  {
    id: "maths",
    title: "Mathematics · Revision",
    subtitle: "Vectors, calculus & exam plans",
    pages: mathsBoards.length,
    updated: "Edited yesterday",
    color: "sage",
    icon: "∑",
    boards: mathsBoards,
  },
  {
    id: "ideas",
    title: "Ideas & sketches",
    subtitle: "Loose notes, diagrams, and sparks",
    pages: ideasBoards.length,
    updated: "Edited 3 days ago",
    color: "lilac",
    icon: "✦",
    boards: ideasBoards,
  },
];

const starterStrokes: Stroke[] = [
  {
    points: [
      { x: 150, y: 280, p: 0.6 },
      { x: 170, y: 265, p: 0.6 },
      { x: 193, y: 258, p: 0.6 },
      { x: 220, y: 258, p: 0.6 },
      { x: 246, y: 263, p: 0.6 },
    ],
    color: "#e06b55",
    width: 5,
    opacity: 0.95,
  },
];

const defaultFolders: Folder[] = [
  { id: "study", name: "Study hub", color: "#d66f59", parentId: null },
  { id: "past-papers", name: "Past papers", color: "#78947e", parentId: "study" },
  { id: "personal", name: "Personal", color: "#a18bb0", parentId: null },
];

function getStoredNotebooks() {
  return readStored("paperflow-notebooks", defaultNotebooks);
}
function getStoredFolders() {
  return readStored("paperflow-folders", defaultFolders);
}
function getStoredStrokePages(): Record<string, Stroke[]> {
  return readStored(STROKE_STORAGE_KEY, {} as Record<string, Stroke[]>);
}
function getStoredPageText(): Record<string, string> {
  return readStored("paperflow-page-text", {} as Record<string, string>);
}
function getStoredSettings(): DrawingSettings {
  const stored = readStored<Partial<DrawingSettings>>(SETTINGS_STORAGE_KEY, {});
  return {
    selectedColor: /^#[0-9a-f]{6}$/i.test(stored.selectedColor ?? "") ? stored.selectedColor! : "#2f456f",
    penSize: Math.min(40, Math.max(1, Number(stored.penSize) || 4)),
    zoom: Math.min(200, Math.max(4, Number(stored.zoom) || 100)),
  };
}
function getStoredTrash<T>(key: string): T[] {
  return readStored<T[]>(key, []);
}
function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatFileName(name: string) {
  return name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function pointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const current = polygon[index];
    const prior = polygon[previous];
    const intersects = current.y > point.y !== prior.y > point.y && point.x < ((prior.x - current.x) * (point.y - current.y)) / (prior.y - current.y) + current.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function distanceToSegment(point: Point, start: Point, end: Point) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const progress = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (start.x + progress * dx), point.y - (start.y + progress * dy));
}

function getStrokeBounds(strokes: Stroke[], indexes: number[]) {
  const points = indexes.flatMap((index) => strokes[index]?.points ?? []);
  if (!points.length) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(1, Math.max(...xs) - Math.min(...xs)), height: Math.max(1, Math.max(...ys) - Math.min(...ys)) };
}

export default function Home() {
  const [notebooks, setNotebooks] = useState<Notebook[]>(getStoredNotebooks);
  const [folders, setFolders] = useState<Folder[]>(getStoredFolders);
  const [trashFolders, setTrashFolders] = useState<Folder[]>(() => getStoredTrash<Folder>("paperflow-trash-folders"));
  const [trashNotebooks, setTrashNotebooks] = useState<Notebook[]>(() => getStoredTrash<Notebook>("paperflow-trash-notebooks"));
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<string[]>([]);
  const [currentView, setCurrentView] = useState<"library" | "notebook" | "editor" | "trash" | "templates">("library");
  const [selectedNotebookIds, setSelectedNotebookIds] = useState<string[]>([]);
  const [selectedNotebook, setSelectedNotebook] = useState("biology");
  const [activeBoardId, setActiveBoardId] = useState("bio-cellular-respiration");
  const [tool, setTool] = useState<Tool>("pen");
  const [selectedColor, setSelectedColor] = useState(() => getStoredSettings().selectedColor);
  const [penSize, setPenSize] = useState(() => getStoredSettings().penSize);
  const [zoom, setZoom] = useState(() => getStoredSettings().zoom);
  const [workspaceScroll, setWorkspaceScroll] = useState({ top: 0, scrollHeight: 20000, clientHeight: 720 });
  const [minimapOpen, setMinimapOpen] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>(starterStrokes);
  const [history, setHistory] = useState<Stroke[][]>([]);
  const [redoStack, setRedoStack] = useState<Stroke[][]>([]);
  const [imageHistory, setImageHistory] = useState<ImageLayout[]>([]);
  const [imageRedoStack, setImageRedoStack] = useState<ImageLayout[]>([]);
  const [activePdf, setActivePdf] = useState<File | null>(null);
  const [activeImage, setActiveImage] = useState<File | null>(null);
  const pendingImportedFilesRef = useRef(new Map<string, File>());
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);
  const [imagePageKeys, setImagePageKeys] = useState<Record<string, boolean>>(() => readStored(IMAGE_PAGE_STORAGE_KEY, {}));
  const [imageLayouts, setImageLayouts] = useState<Record<string, ImageLayout>>(() => readStored(IMAGE_LAYOUT_STORAGE_KEY, {}));
  const [pageImages, setPageImages] = useState<Record<string, ImageItem[]>>(() => readStored(IMAGE_ITEMS_STORAGE_KEY, {}));
  const [activePageImages, setActivePageImages] = useState<Array<{ item: ImageItem; file: File; url: string }>>([]);
  const [selectedPageImageId, setSelectedPageImageId] = useState<string | null>(null);
  const [pageImageMenuId, setPageImageMenuId] = useState<string | null>(null);
  const [pageImageHistory, setPageImageHistory] = useState<ImageItem[][]>([]);
  const [pageImageRedoStack, setPageImageRedoStack] = useState<ImageItem[][]>([]);
  const [imageScale, setImageScale] = useState(100);
  const [imagePosition, setImagePosition] = useState({ x: 0, y: 0 });
  const [imageSelected, setImageSelected] = useState(false);
  const [pageText, setPageText] = useState<Record<string, string>>(getStoredPageText);
  const [lassoPoints, setLassoPoints] = useState<Point[]>([]);
  const [selectedStrokeIndexes, setSelectedStrokeIndexes] = useState<number[]>([]);
  const [lastSaved, setLastSaved] = useState("just now");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "offline">("saved");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [displayPreferences, setDisplayPreferences] = useState<DisplayPreferences>(() => readStored(DISPLAY_PREFS_KEY, defaultDisplayPreferences));
  const [sortOrder, setSortOrder] = useState<"recent" | "name" | "pages">("recent");
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [eraserCursor, setEraserCursor] = useState<Point | null>(null);
  const [boardCreatorOpen, setBoardCreatorOpen] = useState(false);
  const [boardCreatorNotebookId, setBoardCreatorNotebookId] = useState<string | null>(null);
  const [boardCreatorTemplateId, setBoardCreatorTemplateId] = useState("lined");
  const [boardCreatorCount, setBoardCreatorCount] = useState(1);
  const [boardCreatorColor, setBoardCreatorColor] = useState("#fffdf8");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingStrokeRef = useRef<Stroke | null>(null);
  const strokesRef = useRef<Stroke[]>(strokes);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const movingRef = useRef<{ last: Point } | null>(null);
  const selectionBeforeRef = useRef<Stroke[] | null>(null);
  const eraserPointRef = useRef<Point | null>(null);
  const strokePagesRef = useRef<Record<string, Stroke[]>>(getStoredStrokePages());
  const pageKeyRef = useRef("");
  const touchPanRef = useRef<{ lastX: number; lastY: number; workspace: HTMLElement } | null>(null);
  const touchPointersRef = useRef<Record<number, { x: number; y: number }>>({});
  const pinchRef = useRef<{ startDistance: number; startZoom: number; startCenterX: number; startCenterY: number; startScrollLeft: number; startScrollTop: number; workspace: HTMLElement } | null>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const imageDragRef = useRef<{ mode: "move" | "resize"; startX: number; startY: number; startLeft: number; startTop: number; startScale: number; paper: HTMLElement; pointerId: number } | null>(null);
  const pageImagesRef = useRef<ImageItem[]>([]);
  const imageLayoutRef = useRef<ImageLayout>({ x: 0, y: 0, scale: 100 });
  const pageImageDragRef = useRef<{ id: string; mode: "move" | "resize"; startX: number; startY: number; start: ImageLayout; paper: HTMLElement; pointerId: number } | null>(null);
  const pageImageHoldTimer = useRef<number | null>(null);

  const activeNotebook = notebooks.find((notebook) => notebook.id === selectedNotebook) ?? notebooks[0];
  const activeBoardIndex = activeNotebook?.boards.findIndex((board) => board.id === activeBoardId) ?? -1;
  const activeBoard = activeBoardIndex >= 0 ? activeNotebook?.boards[activeBoardIndex] : activeNotebook?.boards[0];
  const activePageKey = activeNotebook && activeBoard ? `${activeNotebook.id}:${activeBoard.id}` : "";
  const filteredNotebooks = notebooks.filter((notebook) =>
    `${notebook.title} ${notebook.subtitle} ${notebook.boards.map((board) => board.title).join(" ")}`.toLowerCase().includes(search.toLowerCase()),
  ).sort((a, b) => sortOrder === "name" ? a.title.localeCompare(b.title) : sortOrder === "pages" ? b.boards.length - a.boards.length : 0);
  const selectedBounds = getStrokeBounds(strokes, selectedStrokeIndexes);
  const activePageImageIds = activePageKey ? (pageImages[activePageKey] ?? []).map((item) => item.id).join(",") : "";

  useEffect(() => {
    strokesRef.current = strokes;
    renderCanvas(strokes);
    if (pageKeyRef.current) {
      strokePagesRef.current[pageKeyRef.current] = strokes;
      writeStored(STROKE_STORAGE_KEY, strokePagesRef.current);
    }
    setSaveState("saving");
    const timer = window.setTimeout(() => { setLastSaved("just now"); setSaveState("saved"); }, 450);
    return () => window.clearTimeout(timer);
  }, [strokes]);

  useEffect(() => {
    if (!activeNotebook || !activeBoard) return;
    const pageKey = `${activeNotebook.id}:${activeBoard.id}`;
    if (pageKeyRef.current === pageKey) return;
    pageKeyRef.current = pageKey;
    const stored = strokePagesRef.current[pageKey];
    const next = stored ?? (activeBoard.id === "bio-cellular-respiration" ? starterStrokes : []);
    strokesRef.current = next;
    setStrokes(next);
    setHistory([]);
    setRedoStack([]);
    setSelectedStrokeIndexes([]);
    setLassoPoints([]);
  }, [activeNotebook?.id, activeBoard?.id]);

  useEffect(() => {
    if (currentView !== "editor") return;
    const frame = window.requestAnimationFrame(() => renderCanvas(strokesRef.current));
    return () => window.cancelAnimationFrame(frame);
  }, [currentView, activePageKey]);

  function updatePageText(value: string) {
    if (!activePageKey) return;
    const next = { ...pageText, [activePageKey]: value };
    setPageText(next);
    writeStored("paperflow-page-text", next);
    setLastSaved("saving…");
    setSaveState("saving");
  }

  useEffect(() => {
    writeStored("paperflow-notebooks", notebooks);
  }, [notebooks]);
  useEffect(() => {
    writeStored("paperflow-folders", folders);
  }, [folders]);
  useEffect(() => {
    writeStored("paperflow-trash-folders", trashFolders);
    writeStored("paperflow-trash-notebooks", trashNotebooks);
  }, [trashFolders, trashNotebooks]);
  useEffect(() => {
    writeStored("paperflow-page-text", pageText);
  }, [pageText]);
  useEffect(() => {
    writeStored(IMAGE_PAGE_STORAGE_KEY, imagePageKeys);
  }, [imagePageKeys]);
  useEffect(() => {
    writeStored(IMAGE_LAYOUT_STORAGE_KEY, imageLayouts);
  }, [imageLayouts]);
  useEffect(() => {
    writeStored(IMAGE_ITEMS_STORAGE_KEY, pageImages);
  }, [pageImages]);
  useEffect(() => {
    if (!activePageKey) return;
    const layout = imageLayouts[activePageKey] ?? { x: 0, y: 0, scale: 100 };
    imageLayoutRef.current = layout;
    setImagePosition({ x: layout.x, y: layout.y });
    setImageScale(layout.scale);
    setImageSelected(false);
    setImageHistory([]);
    setImageRedoStack([]);
    setPageImageHistory([]);
    setPageImageRedoStack([]);
  }, [activePageKey]);
  useEffect(() => {
    writeStored(SETTINGS_STORAGE_KEY, { selectedColor, penSize, zoom } satisfies DrawingSettings);
  }, [selectedColor, penSize, zoom]);
  useEffect(() => {
    writeStored(DISPLAY_PREFS_KEY, displayPreferences);
    document.documentElement.dataset.displayTheme = displayPreferences.theme;
    document.documentElement.classList.toggle("large-text", displayPreferences.largeText);
    document.documentElement.classList.toggle("reduce-motion", displayPreferences.reducedMotion);
    document.documentElement.classList.toggle("compact-toolbar", displayPreferences.compactToolbar);
    document.documentElement.classList.toggle("left-handed", displayPreferences.leftHanded);
  }, [displayPreferences]);
  useEffect(() => {
    let cancelled = false;
    const isImportedNotebook = activeNotebook?.subtitle.includes("Imported PDF") || activeNotebook?.subtitle.includes("Imported image");
    const storageKey = isImportedNotebook ? activeNotebook?.id : activePageKey ? `image:${activePageKey}` : "";
    if (!storageKey) {
      setActivePdf(null);
      setActiveImage(null);
      return () => { cancelled = true; };
    }
    loadImportedFile(storageKey).then((storedFile) => {
      if (cancelled) return;
      // IndexedDB can finish saving just after the notebook becomes active.
      // Keep the file selected during that short window instead of replacing it
      // with null and leaving the editor blank.
      const file = storedFile ?? pendingImportedFilesRef.current.get(storageKey) ?? null;
      if (activeNotebook?.subtitle.includes("Imported image") || (!isImportedNotebook && Boolean(file))) {
        setActiveImage(file);
        setActivePdf(null);
      } else {
        setActivePdf(file);
        setActiveImage(null);
      }
    }).catch(() => {
      if (!cancelled) {
        setActivePdf(null);
        setActiveImage(null);
      }
    });
    return () => { cancelled = true; };
  }, [activeNotebook?.id, activeNotebook?.subtitle, activePageKey]);

  useEffect(() => {
    if (!activeImage) {
      setActiveImageUrl(null);
      return;
    }
    const url = URL.createObjectURL(activeImage);
    setActiveImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [activeImage]);

  useEffect(() => {
    let cancelled = false;
    const items = activePageKey ? (pageImages[activePageKey] ?? []) : [];
    pageImagesRef.current = items;
    setActivePageImages([]);
    Promise.all(items.map(async (item) => {
      const file = await loadImportedFile(`image:${activePageKey}:${item.id}`);
      return file ? { item, file, url: URL.createObjectURL(file) } : null;
    })).then((loaded) => {
      if (cancelled) {
        loaded.forEach((entry) => entry && URL.revokeObjectURL(entry.url));
        return;
      }
      setActivePageImages(loaded.filter((entry): entry is { item: ImageItem; file: File; url: string } => Boolean(entry)));
    }).catch(() => { if (!cancelled) setActivePageImages([]); });
    return () => {
      cancelled = true;
      setActivePageImages((current) => { current.forEach((entry) => URL.revokeObjectURL(entry.url)); return []; });
    };
  }, [activePageKey, activePageImageIds]);

  function updateImageLayout(next: Partial<ImageLayout>) {
    if (!activePageKey) return;
    const current = imageLayouts[activePageKey] ?? { x: 0, y: 0, scale: 100 };
    const layout = { ...current, ...next };
    imageLayoutRef.current = layout;
    setImageLayouts((layouts) => ({ ...layouts, [activePageKey]: layout }));
    setImagePosition({ x: layout.x, y: layout.y });
    setImageScale(layout.scale);
  }

  function snapshotPageImages() {
    return pageImagesRef.current.map((item) => ({ ...item, layout: { ...item.layout } }));
  }

  function commitPageImages(next: ImageItem[], previous = pageImagesRef.current) {
    if (!activePageKey) return;
    pageImagesRef.current = next;
    setPageImages((current) => ({ ...current, [activePageKey]: next }));
    setPageImageHistory((current) => [...current, previous.map((item) => ({ ...item, layout: { ...item.layout } }))]);
    setPageImageRedoStack([]);
    setLastSaved("saving…");
  }

  function beginPageImageInteraction(event: React.PointerEvent<HTMLDivElement>, id: string, mode: "move" | "resize") {
    if (tool !== "select") return;
    const paper = event.currentTarget.closest(".paper-frame") as HTMLElement | null;
    const item = pageImagesRef.current.find((entry) => entry.id === id);
    if (!paper || !item) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectedPageImageId(id);
    pageImageDragRef.current = { id, mode, startX: event.clientX, startY: event.clientY, start: { ...item.layout }, paper, pointerId: event.pointerId };
  }

  function startPageImageHold(id: string) {
    if (pageImageHoldTimer.current) window.clearTimeout(pageImageHoldTimer.current);
    pageImageHoldTimer.current = window.setTimeout(() => setPageImageMenuId(id), 550);
  }

  function clearPageImageHold() {
    if (pageImageHoldTimer.current) window.clearTimeout(pageImageHoldTimer.current);
    pageImageHoldTimer.current = null;
  }

  function movePageImageInteraction(event: React.PointerEvent<HTMLDivElement>) {
    const drag = pageImageDragRef.current;
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = drag.paper.getBoundingClientRect();
    const dx = ((event.clientX - drag.startX) / bounds.width) * 100;
    const dy = ((event.clientY - drag.startY) / bounds.height) * 100;
    const next = pageImagesRef.current.map((item) => item.id !== drag.id ? item : { ...item, layout: drag.mode === "resize" ? { ...item.layout, scale: Math.min(300, Math.max(20, drag.start.scale + dx)) } : { ...item.layout, x: Math.min(100, Math.max(-100, drag.start.x + dx)), y: Math.min(100, Math.max(-100, drag.start.y + dy)) } });
    pageImagesRef.current = next;
    setPageImages((current) => ({ ...current, [activePageKey]: next }));
  }

  function endPageImageInteraction(event?: React.PointerEvent<HTMLDivElement>) {
    const drag = pageImageDragRef.current;
    if (!drag) return;
    if (event && event.currentTarget.hasPointerCapture(drag.pointerId)) event.currentTarget.releasePointerCapture(drag.pointerId);
    const current = pageImagesRef.current.find((item) => item.id === drag.id)?.layout;
    if (current && (current.x !== drag.start.x || current.y !== drag.start.y || current.scale !== drag.start.scale)) {
      setPageImageHistory((historyItems) => [...historyItems, pageImagesRef.current.map((item) => item.id === drag.id ? { ...item, layout: { ...drag.start } } : { ...item, layout: { ...item.layout } })]);
      setPageImageRedoStack([]);
    }
    pageImageDragRef.current = null;
    setLastSaved("saving…");
  }

  function deletePageImage(id: string) {
    const item = pageImagesRef.current.find((entry) => entry.id === id);
    if (!item || !activePageKey || !window.confirm(`Delete imported image “${item.name}”?`)) return;
    commitPageImages(pageImagesRef.current.filter((entry) => entry.id !== id));
    void deleteImportedPdf(`image:${activePageKey}:${id}`);
    setSelectedPageImageId(null);
    setActivePageImages((current) => current.filter((entry) => entry.item.id !== id));
  }

  function beginImageInteraction(event: React.PointerEvent<HTMLDivElement>, mode: "move" | "resize") {
    if (tool !== "select" || !activeImageUrl) return;
    const paper = event.currentTarget.closest(".paper-frame") as HTMLElement | null;
    if (!paper) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    imageDragRef.current = { mode, startX: event.clientX, startY: event.clientY, startLeft: imagePosition.x, startTop: imagePosition.y, startScale: imageScale, paper, pointerId: event.pointerId };
    setImageSelected(true);
  }

  function moveImageInteraction(event: React.PointerEvent<HTMLDivElement>) {
    const drag = imageDragRef.current;
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = drag.paper.getBoundingClientRect();
    const dx = ((event.clientX - drag.startX) / bounds.width) * 100;
    const dy = ((event.clientY - drag.startY) / bounds.height) * 100;
    if (drag.mode === "resize") {
      updateImageLayout({ scale: Math.min(300, Math.max(20, drag.startScale + dx)) });
    } else {
      updateImageLayout({ x: Math.min(100, Math.max(-100, drag.startLeft + dx)), y: Math.min(100, Math.max(-100, drag.startTop + dy)) });
    }
  }

  function endImageInteraction(event?: React.PointerEvent<HTMLDivElement>) {
    const drag = imageDragRef.current;
    if (drag && event && event.currentTarget.hasPointerCapture(drag.pointerId)) event.currentTarget.releasePointerCapture(drag.pointerId);
    if (drag && activePageKey) {
      const before = { x: drag.startLeft, y: drag.startTop, scale: drag.startScale };
      const after = { ...imageLayoutRef.current };
      if (before.x !== after.x || before.y !== after.y || before.scale !== after.scale) {
        setImageHistory((current) => [...current, before]);
        setImageRedoStack([]);
        setLastSaved("saving…");
      }
    }
    imageDragRef.current = null;
  }

  function renderCanvas(nextStrokes = strokesRef.current) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    context.lineCap = "round";
    context.lineJoin = "round";
    nextStrokes.forEach((stroke) => {
      if (stroke.points.length < 1) return;
      context.save();
      context.globalAlpha = stroke.opacity;
      context.strokeStyle = stroke.color;
      context.lineWidth = stroke.width;
      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.stroke();
      context.restore();
    });
  }

  function normalizePoint(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * CANVAS_WIDTH,
      y: ((event.clientY - bounds.top) / bounds.height) * CANVAS_HEIGHT,
      p: event.pressure || 0.5,
    };
  }

  function drawSegment(stroke: Stroke, point: Point) {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const previous = stroke.points[stroke.points.length - 1];
    context.save();
    context.globalAlpha = stroke.opacity;
    context.strokeStyle = stroke.color;
    context.lineWidth = Math.max(1.5, stroke.width * (0.72 + point.p * 0.42));
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    context.restore();
  }

  function eraseAtPoint(point: Point, previousPoint: Point | null = null) {
    const radius = 42;
    const remaining = strokesRef.current.filter((stroke) => {
      const hit = stroke.points.some((strokePoint, index) => {
        if (Math.hypot(strokePoint.x - point.x, strokePoint.y - point.y) < radius) return true;
        if (!previousPoint) return false;
        const priorStrokePoint = stroke.points[Math.max(0, index - 1)];
        return distanceToSegment(strokePoint, previousPoint, point) < radius || distanceToSegment(priorStrokePoint, previousPoint, point) < radius;
      });
      return !hit;
    });
    if (remaining.length === strokesRef.current.length) return;
    strokesRef.current = remaining;
    setStrokes(remaining);
    setRedoStack([]);
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (tool === "eraser" && event.pointerType !== "touch") setEraserCursor(normalizePoint(event));
    if (event.pointerType === "touch") {
      const workspace = event.currentTarget.closest(".paper-workspace") as HTMLElement | null;
      if (workspace) {
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        touchPointersRef.current[event.pointerId] = { x: event.clientX, y: event.clientY };
        const pointers = Object.values(touchPointersRef.current);
        if (pointers.length >= 2) {
          const [first, second] = pointers;
          const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
          pinchRef.current = { startDistance: distance, startZoom: zoom, startCenterX: (first.x + second.x) / 2, startCenterY: (first.y + second.y) / 2, startScrollLeft: workspace.scrollLeft, startScrollTop: workspace.scrollTop, workspace };
          touchPanRef.current = null;
        } else {
          touchPanRef.current = { lastX: event.clientX, lastY: event.clientY, workspace };
        }
      }
      return;
    }
    if ((event.pointerType === "mouse" && event.button !== 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDrawing(true);
    const point = normalizePoint(event);
    if (tool === "text") {
      setIsDrawing(false);
      return;
    }
    if (tool === "lasso") {
      setLassoPoints([point]);
      setSelectedStrokeIndexes([]);
      return;
    }
    if (tool === "select") {
      if (selectedStrokeIndexes.length) {
        selectionBeforeRef.current = strokesRef.current.map((stroke) => ({ ...stroke, points: stroke.points.map((entry) => ({ ...entry })) }));
        movingRef.current = { last: point };
      }
      return;
    }
    if (tool === "eraser") {
      setHistory((current) => [...current, strokesRef.current]);
      eraserPointRef.current = point;
      eraseAtPoint(point);
      return;
    }
    const stroke: Stroke = {
      points: [point],
      color: tool === "highlight" ? "#f3b949" : selectedColor,
      width: tool === "highlight" ? 28 : penSize,
      opacity: tool === "highlight" ? 0.23 : 0.96,
    };
    drawingStrokeRef.current = stroke;
    setHistory((current) => [...current, strokesRef.current]);
    setRedoStack([]);
    strokesRef.current = [...strokesRef.current, stroke];
    setStrokes(strokesRef.current);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (tool === "eraser" && event.pointerType !== "touch") setEraserCursor(normalizePoint(event));
    if (event.pointerType === "touch") {
      const pointer = touchPointersRef.current[event.pointerId];
      if (pointer) { pointer.x = event.clientX; pointer.y = event.clientY; }
      const pointers = Object.values(touchPointersRef.current);
      if (pinchRef.current && pointers.length >= 2) {
        event.preventDefault();
        const [first, second] = pointers;
        const pinch = pinchRef.current;
        const distance = Math.max(1, Math.hypot(second.x - first.x, second.y - first.y));
        const centerX = (first.x + second.x) / 2;
        const centerY = (first.y + second.y) / 2;
        const nextZoom = Math.min(200, Math.max(4, pinch.startZoom * (distance / pinch.startDistance)));
        pinch.workspace.scrollLeft = Math.max(0, pinch.startScrollLeft - (centerX - pinch.startCenterX));
        pinch.workspace.scrollTop = Math.max(0, pinch.startScrollTop - (centerY - pinch.startCenterY));
        setZoom(nextZoom);
        return;
      }
      if (touchPanRef.current) {
        event.preventDefault();
        const pan = touchPanRef.current;
        pan.workspace.scrollLeft -= event.clientX - pan.lastX;
        pan.workspace.scrollTop -= event.clientY - pan.lastY;
        pan.lastX = event.clientX;
        pan.lastY = event.clientY;
        return;
      }
    }
    if (!isDrawing) return;
    const point = normalizePoint(event);
    if (tool === "lasso") {
      setLassoPoints((current) => [...current, point]);
      return;
    }
    if (tool === "select") {
      const moving = movingRef.current;
      if (!moving || !selectedStrokeIndexes.length) return;
      const dx = point.x - moving.last.x;
      const dy = point.y - moving.last.y;
      const next = strokesRef.current.map((stroke, index) => selectedStrokeIndexes.includes(index) ? { ...stroke, points: stroke.points.map((strokePoint) => ({ ...strokePoint, x: strokePoint.x + dx, y: strokePoint.y + dy })) } : stroke);
      moving.last = point;
      strokesRef.current = next;
      setStrokes(next);
      return;
    }
    if (tool === "eraser") {
      const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
      events.forEach((nativeEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const bounds = canvas.getBoundingClientRect();
        const nextPoint: Point = {
          x: ((nativeEvent.clientX - bounds.left) / bounds.width) * CANVAS_WIDTH,
          y: ((nativeEvent.clientY - bounds.top) / bounds.height) * CANVAS_HEIGHT,
          p: nativeEvent.pressure || 0.5,
        };
        eraseAtPoint(nextPoint, eraserPointRef.current);
        eraserPointRef.current = nextPoint;
      });
      return;
    }
    const current = drawingStrokeRef.current;
    if (!current) return;
    if (tool === "line") {
      const start = current.points[0];
      current.points = [start, point];
      strokesRef.current = [...strokesRef.current.slice(0, -1), current];
      setStrokes(strokesRef.current);
      return;
    }
    const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    events.forEach((nativeEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const bounds = canvas.getBoundingClientRect();
      const point: Point = {
        x: ((nativeEvent.clientX - bounds.left) / bounds.width) * CANVAS_WIDTH,
        y: ((nativeEvent.clientY - bounds.top) / bounds.height) * CANVAS_HEIGHT,
        p: nativeEvent.pressure || 0.5,
      };
      drawSegment(current, point);
      current.points.push(point);
    });
  }

  function finishStroke(event?: React.PointerEvent<HTMLCanvasElement>) {
    if (event?.pointerType !== "touch") setEraserCursor(null);
    eraserPointRef.current = null;
    if (event?.pointerType === "touch") {
      delete touchPointersRef.current[event.pointerId];
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      const remaining = Object.values(touchPointersRef.current);
      pinchRef.current = null;
      touchPanRef.current = remaining.length === 1 ? { lastX: remaining[0].x, lastY: remaining[0].y, workspace: workspaceRef.current! } : null;
      return;
    }
    if (event && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const finishingStroke = drawingStrokeRef.current;
    if (event && finishingStroke && (tool === "pen" || tool === "highlight" || tool === "line")) {
      const finalPoint = normalizePoint(event);
      const lastPoint = finishingStroke.points[finishingStroke.points.length - 1];
      if (!lastPoint || lastPoint.x !== finalPoint.x || lastPoint.y !== finalPoint.y) {
        if (tool === "line") finishingStroke.points = [finishingStroke.points[0], finalPoint];
        else {
          drawSegment(finishingStroke, finalPoint);
          finishingStroke.points.push(finalPoint);
        }
        strokesRef.current = [...strokesRef.current.slice(0, -1), finishingStroke];
        setStrokes(strokesRef.current);
      }
    }
    if (tool === "lasso" && lassoPoints.length > 2) {
      const selected = strokesRef.current.reduce<number[]>((indexes, stroke, index) => {
        if (stroke.points.some((point) => pointInPolygon(point, lassoPoints))) indexes.push(index);
        return indexes;
      }, []);
      const imageTarget = pageImagesRef.current.find((item) => pointInPolygon({ x: (item.layout.x / 100) * CANVAS_WIDTH, y: (item.layout.y / 100) * CANVAS_HEIGHT, p: 0.5 }, lassoPoints));
      setSelectedStrokeIndexes(selected);
      setSelectedPageImageId(imageTarget?.id ?? null);
      setLassoPoints([]);
      setTool("select");
      toast(selected.length || imageTarget ? `${selected.length + (imageTarget ? 1 : 0)} object${selected.length + (imageTarget ? 1 : 0) === 1 ? "" : "s"} selected` : "Nothing selected", { description: selected.length || imageTarget ? "Drag the selection to move it." : "Draw around a mark or image to select it." });
    }
    if (tool === "select" && movingRef.current) {
      if (selectionBeforeRef.current) setHistory((current) => [...current, selectionBeforeRef.current!]);
      setRedoStack([]);
      movingRef.current = null;
      selectionBeforeRef.current = null;
      setLastSaved("saving…");
    }
    setIsDrawing(false);
    drawingStrokeRef.current = null;
    setLastSaved("saving…");
    window.setTimeout(() => setLastSaved("just now"), 450);
  }

  function deleteSelectedStrokes() {
    if (!selectedStrokeIndexes.length) return;
    const indexes = new Set(selectedStrokeIndexes);
    setHistory((current) => [...current, strokesRef.current]);
    const next = strokesRef.current.filter((_, index) => !indexes.has(index));
    strokesRef.current = next;
    setStrokes(next);
    setSelectedStrokeIndexes([]);
    setLastSaved("saving…");
  }
  function duplicateSelectedStrokes() {
    if (!selectedStrokeIndexes.length) return;
    const copies = selectedStrokeIndexes.map((index) => strokesRef.current[index]).filter(Boolean).map((stroke) => ({ ...stroke, points: stroke.points.map((point) => ({ ...point, x: point.x + 32, y: point.y + 32 })) }));
    setHistory((current) => [...current, strokesRef.current]);
    const next = [...strokesRef.current, ...copies];
    strokesRef.current = next;
    setStrokes(next);
    setLastSaved("saving…");
  }
  function resetZoom() { setZoom(100); }
  function fitZoom() { setZoom(75); }
  function handleWorkspaceWheel(event: React.WheelEvent<HTMLDivElement>) {
    // Trackpad pinch is exposed by browsers as a wheel event with ctrl/meta.
    // Use a multiplicative curve so tiny trackpad deltas feel smooth at every zoom level.
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY;
    const factor = Math.exp(-delta * 0.012);
    setZoom((value) => Math.min(200, Math.max(4, value * factor)));
  }
  function undo() {
    const previousPageImages = pageImageHistory[pageImageHistory.length - 1];
    if (previousPageImages && activePageKey) {
      setPageImageRedoStack((current) => [...current, snapshotPageImages()]);
      setPageImageHistory((current) => current.slice(0, -1));
      pageImagesRef.current = previousPageImages;
      setPageImages((current) => ({ ...current, [activePageKey]: previousPageImages }));
      setSelectedPageImageId(null);
      return;
    }
    const previousImage = imageHistory[imageHistory.length - 1];
    if (previousImage && activePageKey) {
      const currentImage = { x: imagePosition.x, y: imagePosition.y, scale: imageScale };
      setImageRedoStack((current) => [...current, currentImage]);
      setImageHistory((current) => current.slice(0, -1));
      updateImageLayout(previousImage);
      setImageSelected(true);
      return;
    }
    const previous = history[history.length - 1];
    if (!previous) return;
    setRedoStack((current) => [...current, strokesRef.current]);
    setHistory((current) => current.slice(0, -1));
    strokesRef.current = previous;
    setStrokes(previous);
  }

  function redo() {
    const nextPageImages = pageImageRedoStack[pageImageRedoStack.length - 1];
    if (nextPageImages && activePageKey) {
      setPageImageHistory((current) => [...current, snapshotPageImages()]);
      setPageImageRedoStack((current) => current.slice(0, -1));
      pageImagesRef.current = nextPageImages;
      setPageImages((current) => ({ ...current, [activePageKey]: nextPageImages }));
      setSelectedPageImageId(null);
      return;
    }
    const nextImage = imageRedoStack[imageRedoStack.length - 1];
    if (nextImage && activePageKey) {
      const currentImage = { x: imagePosition.x, y: imagePosition.y, scale: imageScale };
      setImageHistory((current) => [...current, currentImage]);
      setImageRedoStack((current) => current.slice(0, -1));
      updateImageLayout(nextImage);
      setImageSelected(true);
      return;
    }
    const next = redoStack[redoStack.length - 1];
    if (!next) return;
    setHistory((current) => [...current, strokesRef.current]);
    setRedoStack((current) => current.slice(0, -1));
    strokesRef.current = next;
    setStrokes(next);
  }

  function createNotebook() {
    const notebook: Notebook = {
      id: makeId(),
      title: "New notebook",
      subtitle: "A fresh space for your ideas",
      pages: 0,
      updated: "Edited just now",
      color: "navy",
      icon: "NEW",
      boards: [],
    };
    setNotebooks((current) => [notebook, ...current]);
    setSelectedNotebook(notebook.id);
    setActivePdf(null);
    setCurrentView("notebook");
    toast.success("New notebook created", { description: "Add a whiteboard whenever you're ready to write." });
  }

  function openNotebook(notebook: Notebook) {
    setSelectedNotebook(notebook.id);
    setSelectedNotebookIds([]);
    if (!notebook.subtitle.includes("Imported PDF")) setActivePdf(null);
    if (!notebook.subtitle.includes("Imported image")) setActiveImage(null);
    setCurrentView("notebook");
  }

  function openBoardCreator(notebookOverride?: Notebook, templateId = "lined") {
    const notebook = notebookOverride ?? activeNotebook;
    if (!notebook) return;
    const template = pageTemplates.find((item) => item.id === templateId) ?? pageTemplates[0];
    setBoardCreatorNotebookId(notebook.id);
    setBoardCreatorTemplateId(template.id);
    setBoardCreatorColor(template.color);
    setBoardCreatorCount(1);
    setBoardCreatorOpen(true);
  }

  function createWhiteboards() {
    const notebook = notebooks.find((item) => item.id === boardCreatorNotebookId);
    const template = pageTemplates.find((item) => item.id === boardCreatorTemplateId) ?? pageTemplates[0];
    if (!notebook) return;
    const count = Math.min(20, Math.max(1, boardCreatorCount));
    const firstNumber = notebook.boards.length + 1;
    const boards: Board[] = Array.from({ length: count }, (_, index) => ({ id: makeId(), title: `${template.name} ${firstNumber + index}`, updated: "Edited just now", templateId: template.id, color: boardCreatorColor }));
    setNotebooks((current) => current.map((item) => item.id === notebook.id ? { ...item, boards: [...item.boards, ...boards], pages: item.boards.length + boards.length, updated: "Edited just now" } : item));
    setSelectedNotebook(notebook.id);
    setActiveBoardId(boards[0].id);
    setBoardCreatorOpen(false);
    setCurrentView("editor");
    toast.success(`${count} ${template.name.toLowerCase()} page${count === 1 ? "" : "s"} added`);
  }

  function openWhiteboard(board: Board) {
    setActiveBoardId(board.id);
    setCurrentView("editor");
  }

  function deleteWhiteboard(notebookId: string, boardId: string) {
    const notebook = notebooks.find((item) => item.id === notebookId);
    if (!notebook) return;
    if (!window.confirm("Delete this whiteboard? This can't be undone.")) return;
    setNotebooks((current) => current.map((item) => item.id === notebookId ? { ...item, boards: item.boards.filter((board) => board.id !== boardId), pages: Math.max(0, item.boards.length - 1) } : item));
    delete strokePagesRef.current[`${notebookId}:${boardId}`];
    writeStored(STROKE_STORAGE_KEY, strokePagesRef.current);
    toast.success("Whiteboard deleted");
  }

  function renameWhiteboard(notebookId: string, boardId: string) {
    const notebook = notebooks.find((item) => item.id === notebookId);
    const board = notebook?.boards.find((item) => item.id === boardId);
    if (!board) return;
    const title = window.prompt("Rename whiteboard", board.title)?.trim();
    if (!title || title === board.title) return;
    setNotebooks((current) => current.map((item) => item.id === notebookId ? { ...item, boards: item.boards.map((entry) => entry.id === boardId ? { ...entry, title, updated: "Edited just now" } : entry), updated: "Edited just now" } : item));
    toast.success("Whiteboard renamed");
  }

  function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const file = files[0];
    if (!file) return;
    setImportStatus({ name: file.name, progress: 15, message: "Checking file…" });
    const isImage = file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(file.name);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isSupported = isPdf || isImage;
    if (!isSupported) {
      setImportStatus({ name: file.name, progress: 100, message: "Unsupported file type", error: true });
      toast.error("That file type is not supported", { description: "Import a PDF, PNG, JPG, WEBP, or GIF file." });
      return;
    }
    if (isImage && currentView === "editor" && activeNotebook && activeBoard) {
      const imageFiles = files.filter((entry) => entry.type.startsWith("image/") || /\.(png|jpe?g|webp|gif)$/i.test(entry.name));
      const pageKey = activePageKey;
      const additions = imageFiles.map((entry) => ({ id: makeId(), name: entry.name, layout: { x: 0, y: 0, scale: 100 } }));
      const next = [...pageImagesRef.current, ...additions];
      commitPageImages(next);
      setImagePageKeys((current) => ({ ...current, [pageKey]: true }));
      setActivePdf(null);
      setImportStatus({ name: imageFiles.length > 1 ? `${imageFiles.length} images` : file.name, progress: 55, message: "Saving locally…" });
      Promise.all(additions.map((item, index) => saveImportedFile(`image:${pageKey}:${item.id}`, imageFiles[index]))).then(() => { setImportStatus({ name: imageFiles.length > 1 ? `${imageFiles.length} images` : file.name, progress: 100, message: "Added to page" }); toast.success(`${additions.length} image${additions.length === 1 ? "" : "s"} added to this whiteboard`, { description: "Your existing handwriting and images were kept." }); }).catch(() => toast.error("One or more images could not be saved locally", { description: "You can still use them for this session." }));
      event.target.value = "";
      window.setTimeout(() => setImportStatus(null), 2600);
      return;
    }
    // pdf.js reports the real count after loading; start with one page instead
    // of inventing a 12-page placeholder that can hide or overwrite pages.
    const importedPageCount = 1;
    const imported: Notebook = {
      id: makeId(),
      title: formatFileName(file.name),
      subtitle: `${isPdf ? "Imported PDF" : "Imported image"} · ready to annotate`,
      pages: importedPageCount,
      updated: "Imported just now",
      color: isPdf ? "navy" : "sage",
      icon: isPdf ? "PDF" : "IMG",
      boards: makeBoards(importedPageCount, "Page", "Imported just now"),
    };
    setNotebooks((current) => [imported, ...current]);
    pendingImportedFilesRef.current.set(imported.id, file);
    setActivePdf(isPdf ? file : null);
    setActiveImage(isImage ? file : null);
    setImportStatus({ name: file.name, progress: 55, message: "Saving locally…" });
    saveImportedFile(imported.id, file).then(() => { setImportStatus({ name: file.name, progress: 100, message: "Added to library" }); toast.success("File saved for offline use", { description: "This import will be available after you reload Paperflow." }); }).catch(() => toast.error("File could not be saved locally", { description: "You can still annotate it for this session." }));
    setSelectedNotebook(imported.id);
    setActiveBoardId(imported.boards[0].id);
    setCurrentView("editor");
    toast.success("Document imported", { description: `${imported.title} is ready for handwriting and markup.` });
    event.target.value = "";
  }

  function handleNotebookDragStart(event: React.DragEvent, notebookId: string) {
    event.dataTransfer.setData("text/paperflow-notebook", notebookId);
    event.dataTransfer.effectAllowed = "move";
  }

  function toggleNotebookSelection(notebookId: string) {
    setSelectedNotebookIds((current) => current.includes(notebookId) ? current.filter((id) => id !== notebookId) : [...current, notebookId]);
  }

  function selectAllVisible() {
    setSelectedNotebookIds((current) => current.length === filteredNotebooks.length ? [] : filteredNotebooks.map((notebook) => notebook.id));
  }

  function moveSelectedNotebooks(folderId: string | null) {
    if (!selectedNotebookIds.length) return;
    setNotebooks((current) => current.map((notebook) => selectedNotebookIds.includes(notebook.id) ? { ...notebook, folderId: folderId ?? undefined } : notebook));
    setSelectedNotebookIds([]);
    toast.success("Notebooks organized", { description: "Your bulk move is saved locally." });
  }

  function deleteSelectedNotebooks() {
    if (!selectedNotebookIds.length) return;
    const ids = [...selectedNotebookIds];
    const removed = notebooks.filter((notebook) => ids.includes(notebook.id));
    setTrashNotebooks((current) => [...removed, ...current.filter((notebook) => !ids.includes(notebook.id))]);
    setNotebooks((current) => current.filter((notebook) => !ids.includes(notebook.id)));
    setSelectedNotebookIds([]);
    if (ids.includes(selectedNotebook)) {
      setSelectedNotebook(defaultNotebooks[0].id);
      setActivePdf(null);
      setCurrentView("library");
    }
    toast.success(`${ids.length} notebook${ids.length === 1 ? "" : "s"} moved to Trash`, { description: "Restore them any time from the Trash view." });
  }

  function renameNotebook(notebookId: string) {
    const notebook = notebooks.find((item) => item.id === notebookId);
    if (!notebook) return;
    const title = window.prompt("Rename notebook", notebook.title || "Untitled notebook")?.trim();
    if (!title || title === notebook.title) return;
    setNotebooks((current) => current.map((item) => item.id === notebookId ? { ...item, title, updated: "Edited just now" } : item));
    toast.success("Notebook renamed");
  }

  function deleteNotebook(notebookId: string) {
    const notebook = notebooks.find((item) => item.id === notebookId);
    if (!notebook || !window.confirm(`Move “${notebook.title || "Untitled notebook"}” to Trash?`)) return;
    setTrashNotebooks((current) => [notebook, ...current.filter((item) => item.id !== notebookId)]);
    setNotebooks((current) => current.filter((item) => item.id !== notebookId));
    setSelectedNotebookIds((current) => current.filter((id) => id !== notebookId));
    if (selectedNotebook === notebookId) {
      setSelectedNotebook(defaultNotebooks[0].id);
      setActivePdf(null);
      setActiveImage(null);
      setCurrentView("library");
    }
    toast.success("Notebook moved to Trash");
  }

  function renameFolder(folderId: string) {
    const folder = folders.find((item) => item.id === folderId);
    if (!folder) return;
    const name = window.prompt("Rename folder", folder.name)?.trim();
    if (!name || name === folder.name) return;
    setFolders((current) => current.map((item) => item.id === folderId ? { ...item, name } : item));
  }

  function createSubfolder(parentId: string) {
    const parent = folders.find((folder) => folder.id === parentId);
    const folder = { id: makeId(), name: `${parent?.name ?? "Folder"} · new`, color: parent?.color ?? "#7084a3", parentId };
    setFolders((current) => [...current, folder]);
    setActiveFolder(folder.id);
    toast.success("Nested folder created", { description: "You can rename it from the folder menu." });
  }

  function deleteFolder(folderId: string) {
    const ids = new Set<string>([folderId]);
    let changed = true;
    while (changed) {
      changed = false;
      folders.forEach((folder) => { if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) { ids.add(folder.id); changed = true; } });
    }
    const removedFolders = folders.filter((folder) => ids.has(folder.id));
    const removedNotebooks = notebooks.filter((notebook) => notebook.folderId && ids.has(notebook.folderId));
    setTrashFolders((current) => [...removedFolders, ...current.filter((folder) => !ids.has(folder.id))]);
    setTrashNotebooks((current) => [...removedNotebooks, ...current.filter((notebook) => !removedNotebooks.some((removed) => removed.id === notebook.id))]);
    setFolders((current) => current.filter((folder) => !ids.has(folder.id)));
    setNotebooks((current) => current.filter((notebook) => !(notebook.folderId && ids.has(notebook.folderId))));
    if (activeFolder && ids.has(activeFolder)) setActiveFolder(null);
    toast.success("Folder moved to Trash", { description: "Its nested folders and notebooks can be restored together." });
  }
  function restoreNotebook(notebook: Notebook) {
    setTrashNotebooks((current) => current.filter((item) => item.id !== notebook.id));
    setNotebooks((current) => [notebook, ...current.filter((item) => item.id !== notebook.id)]);
    toast.success("Notebook restored");
  }
  function restoreFolder(folder: Folder) {
    setTrashFolders((current) => current.filter((item) => item.id !== folder.id));
    setFolders((current) => [...current, folder]);
    toast.success("Folder restored");
  }
  function permanentlyDeleteNotebook(notebook: Notebook) {
    setTrashNotebooks((current) => current.filter((item) => item.id !== notebook.id));
    deleteImportedPdf(notebook.id).catch(() => undefined);
    toast.success("Notebook permanently deleted");
  }
  function permanentlyDeleteFolder(folder: Folder) {
    setTrashFolders((current) => current.filter((item) => item.id !== folder.id));
    toast.success("Folder permanently deleted");
  }
  function handleFolderDrop(event: React.DragEvent, folderId: string) {
    event.preventDefault();
    const draggedFolderId = event.dataTransfer.getData("text/paperflow-folder");
    if (draggedFolderId && draggedFolderId !== folderId) {
      setFolders((current) => {
        const dragged = current.find((folder) => folder.id === draggedFolderId);
        if (!dragged) return current;
        const without = current.filter((folder) => folder.id !== draggedFolderId);
        const targetIndex = without.findIndex((folder) => folder.id === folderId);
        without.splice(Math.max(0, targetIndex), 0, { ...dragged, parentId: current.find((folder) => folder.id === folderId)?.parentId ?? null });
        return without;
      });
      toast.success("Folders reordered", { description: "Your folder order is saved locally." });
      return;
    }
    const notebookId = event.dataTransfer.getData("text/paperflow-notebook");
    if (!notebookId) return;
    setNotebooks((current) => current.map((notebook) => notebook.id === notebookId ? { ...notebook, folderId } : notebook));
    setActiveFolder(folderId);
    toast.success("Notebook moved", { description: "Your folder organization is saved locally." });
  }
  function handleFolderDragStart(event: React.DragEvent, folderId: string) {
    event.dataTransfer.setData("text/paperflow-folder", folderId);
    event.dataTransfer.effectAllowed = "move";
  }

  function createFolder() {
    const folder = { id: makeId(), name: "New folder", color: "#7084a3", parentId: null };
    setFolders((current) => [...current, folder]);
    setActiveFolder(folder.id);
    toast.success("Folder created", { description: "Drag notebooks onto it to organize your library." });
  }

  function exportNotebook() {
    const exportData = {
      app: "Paperflow Notes",
      exportedAt: new Date().toISOString(),
      notebook: activeNotebook,
      whiteboard: activeBoard,
      strokes: strokesRef.current,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${activeNotebook?.title ?? "paperflow-note"}.paperflow.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Note exported", { description: "A portable Paperflow backup was downloaded." });
  }

  function printNote() {
    toast("Opening print / PDF export", { description: "Choose ‘Save as PDF’ in the system print dialog." });
    window.setTimeout(() => window.print(), 80);
  }
  async function exportAnnotatedPdf() {
    if (!activePdf || !activeNotebook) {
      printNote();
      return;
    }
    try {
      const pdf = await PDFDocument.load(await activePdf.arrayBuffer());
      const currentPageNumber = activeBoard?.pageNumber ?? 1;
      const page = pdf.getPage(Math.min(pdf.getPageCount() - 1, Math.max(0, currentPageNumber - 1)));
      const scaleX = page.getWidth() / CANVAS_WIDTH;
      const scaleY = page.getHeight() / CANVAS_HEIGHT;
      strokesRef.current.forEach((stroke) => {
        const value = stroke.color.replace("#", "");
        const red = Number.parseInt(value.slice(0, 2), 16) / 255;
        const green = Number.parseInt(value.slice(2, 4), 16) / 255;
        const blue = Number.parseInt(value.slice(4, 6), 16) / 255;
        for (let index = 1; index < stroke.points.length; index += 1) {
          const from = stroke.points[index - 1];
          const to = stroke.points[index];
          page.drawLine({ start: { x: from.x * scaleX, y: page.getHeight() - from.y * scaleY }, end: { x: to.x * scaleX, y: page.getHeight() - to.y * scaleY }, color: rgb(red, green, blue), thickness: Math.max(0.7, stroke.width * scaleX), opacity: stroke.opacity });
        }
      });
      const bytes = await pdf.save();
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${activeNotebook.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-annotated.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Annotated PDF downloaded", { description: `Original document plus page ${currentPageNumber} handwriting.` });
    } catch {
      toast.error("PDF export failed", { description: "The original document could not be composited." });
    }
  }

  function showComingSoon(label: string) {
    toast(`${label} is ready for the next update`, { description: "The interaction is reserved in the product shell." });
  }
  function handleSidebarAction(label: string) {
    if (label === "Trash") {
      setCurrentView("trash");
      setSelectedNotebookIds([]);
      return;
    }
    if (label === "My library") {
      setCurrentView("library");
      return;
    }
    if (label === "Settings") { setSettingsOpen(true); return; }
    if (label === "Templates") {
      setCurrentView("templates");
      setSelectedNotebookIds([]);
      return;
    }
    showComingSoon(label);
  }

  return (
    <div className={`app-shell min-h-screen bg-[#f4f1ea] text-[#252628] ${displayPreferences.leftHanded ? "is-left-handed" : ""}`}>
      <input ref={fileInputRef} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/*" className="hidden" onChange={handleImport} />
      {showMobileNav && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-[#22252a]/40 backdrop-blur-sm" onClick={() => setShowMobileNav(false)} aria-label="Close menu" />
          <aside className="relative flex h-full w-[285px] flex-col bg-[#24272b] px-5 py-6 text-white shadow-2xl">
            <div className="mb-8 flex items-center justify-between">
              <Brand dark />
              <button className="rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white" onClick={() => setShowMobileNav(false)} aria-label="Close menu"><X size={18} /></button>
            </div>
            <SidebarContent onImport={() => fileInputRef.current?.click()} onCreate={createNotebook} onAction={handleSidebarAction} />
          </aside>
        </div>
      )}
      <div className="mx-auto grid min-h-screen max-w-[1680px] lg:grid-cols-[262px_minmax(0,1fr)]">
        <aside className="hidden bg-[#24272b] px-5 py-7 text-white lg:flex lg:flex-col">
          <Brand dark />
          <div className="mt-10 flex-1"><SidebarContent onImport={() => fileInputRef.current?.click()} onCreate={createNotebook} onAction={handleSidebarAction} /></div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45"><Sparkles size={13} /> Pro tip</div>
            <p className="text-sm leading-5 text-white/75">Use your Apple Pencil or any active stylus for the most natural ink response.</p>
            <button className="mt-3 text-xs font-semibold text-[#f7a48f]" onClick={() => showComingSoon("Pencil settings")}>Tune pen response <ChevronRight className="ml-1 inline" size={12} /></button>
          </div>
        </aside>

        <main className="min-w-0 overflow-hidden">
          <header className="flex h-[74px] items-center justify-between border-b border-[#ddd8ce] bg-[#f8f6f1]/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
            <div className="flex min-w-0 items-center gap-3">
              <button className="rounded-xl p-2 text-[#6d6f70] hover:bg-[#e9e5dc] lg:hidden" onClick={() => setShowMobileNav(true)} aria-label="Open menu"><Menu size={22} /></button>
              <div className="lg:hidden"><Brand /></div>
              <div className="hidden items-center gap-2 text-sm text-[#81817f] sm:flex">
                <button onClick={() => setCurrentView("library")} className={currentView === "library" ? "font-semibold text-[#292a2c]" : "transition hover:text-[#454640]"}>Library</button>
                {(currentView === "notebook" || currentView === "editor") && <><ChevronRight size={15} /><button onClick={() => setCurrentView("notebook")} className={currentView === "notebook" ? "font-semibold text-[#292a2c]" : "transition hover:text-[#454640]"}>{activeNotebook?.title ?? "Notebook"}</button></>}
                {currentView === "editor" && <><ChevronRight size={15} /><span className="font-semibold text-[#292a2c]">{activeBoard?.title ?? "Whiteboard"}</span></>}
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 text-xs font-semibold text-[#888983] md:flex"><Cloud size={15} className={saveState === "saving" ? "text-[#d69a53]" : "text-[#6b9a7c]"} /> {saveState === "saving" ? "Saving…" : saveState === "offline" ? "Offline — saved locally" : `Saved ${lastSaved}`}</div>
              <button onClick={() => setSearchOpen(true)} className="rounded-xl p-2.5 text-[#777976] transition hover:bg-[#e8e4db] hover:text-[#272829]" aria-label="Search"><Search size={19} /></button>
              <button onClick={() => fileInputRef.current?.click()} className="hidden items-center gap-2 rounded-xl bg-[#25282c] px-3.5 py-2.5 text-sm font-semibold text-white shadow-[0_5px_14px_rgba(37,40,44,0.16)] transition hover:-translate-y-0.5 hover:bg-[#3b3e42] sm:flex"><FileUp size={16} /> Import</button>
              <button onClick={() => setSettingsOpen(true)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#d8a59a] text-sm font-bold text-[#543d3b] ring-4 ring-[#ece7de]">JD</button>
            </div>
          </header>

          {currentView === "trash" ? <TrashPanel trashFolders={trashFolders} trashNotebooks={trashNotebooks} onRestoreFolder={restoreFolder} onRestoreNotebook={restoreNotebook} onDeleteFolder={permanentlyDeleteFolder} onDeleteNotebook={permanentlyDeleteNotebook} onBack={() => setCurrentView("library")} /> : currentView === "templates" ? <TemplateGallery notebooks={notebooks} onBack={() => setCurrentView("library")} onChoose={(notebookId, templateId) => { const notebook = notebooks.find((item) => item.id === notebookId); if (notebook) openBoardCreator(notebook, templateId); }} /> : currentView === "notebook" && activeNotebook ? <NotebookBoardsView notebook={activeNotebook} onBack={() => setCurrentView("library")} onOpenBoard={openWhiteboard} onAddBoard={() => openBoardCreator(activeNotebook)} onDeleteBoard={(boardId) => deleteWhiteboard(activeNotebook.id, boardId)} onRenameBoard={(boardId) => renameWhiteboard(activeNotebook.id, boardId)} onImport={() => fileInputRef.current?.click()} isPdf={activeNotebook.subtitle.includes("Imported PDF") || activeNotebook.subtitle.includes("Imported image")} /> : currentView === "editor" ? (
            <div className="editor-view flex min-h-[calc(100vh-74px)] flex-col px-0 pb-0 pt-0" onContextMenu={(event) => event.preventDefault()}>
              <button onClick={() => setCurrentView("notebook")} className="mx-5 mt-4 flex w-fit items-center gap-2 rounded-xl border border-[#d8d0c4] bg-[#fffaf5] px-4 py-2.5 text-sm font-bold text-[#656660] transition hover:border-[#d49483] sm:mx-8 lg:mx-10"><ChevronLeft size={15} /> Back to whiteboards</button>
              <section className="mt-4 flex min-h-[calc(100vh-126px)] flex-1 flex-col overflow-hidden border-y border-[#dcd6ca] bg-[#ebe5da] shadow-[0_14px_35px_rgba(87,72,55,0.06)]">
                <div className="flex flex-col justify-between gap-5 border-b border-[#d7cfc1] px-5 py-5 sm:flex-row sm:items-center sm:px-7">
                  <div><div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#a56555]"><NotebookPen size={14} /> {activeNotebook?.title ?? "Notebook"}</div><h2 className="font-display text-2xl tracking-[-0.03em]">{activeBoard?.title ?? "Whiteboard"}</h2></div>
                  <div className="flex items-center gap-2"><span className="hidden rounded-full bg-[#f8f5ef]/75 px-3 py-1.5 text-xs font-semibold text-[#77776f] sm:inline-flex">Whiteboard {activeBoardIndex + 1} of {activeNotebook?.boards.length ?? 1}</span><button onClick={() => setMinimapOpen((open) => !open)} className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${minimapOpen ? "border-[#d66f59] bg-[#fff0e9] text-[#a95544]" : "border-[#cfc5b7] bg-[#f8f5ef]/75 text-[#464743] hover:bg-white"}`} aria-pressed={minimapOpen} aria-label="Toggle canvas overview"><MapIcon size={15} /> <span className="hidden sm:inline">Overview</span></button><button onClick={exportNotebook} className="flex items-center gap-2 rounded-xl border border-[#cfc5b7] bg-[#f8f5ef]/75 px-3.5 py-2 text-sm font-semibold text-[#464743] transition hover:bg-white"><Download size={15} /> Export</button><button onClick={exportAnnotatedPdf} className="flex items-center gap-2 rounded-xl bg-[#25282c] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#3b3e42]"><FileDown size={15} /> PDF</button></div>
                </div>
                <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_240px]">
                  <div ref={workspaceRef} className="paper-workspace relative flex min-h-[calc(100vh-190px)] items-start justify-center overflow-auto bg-[#dcd4c7] p-3 sm:p-6 lg:p-8" onWheel={handleWorkspaceWheel} onScroll={(event) => { const element = event.currentTarget; setWorkspaceScroll({ top: element.scrollTop, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight }); }}>
                    <div className="absolute left-5 top-5 flex items-center gap-1 rounded-xl border border-[#c9c0b3] bg-[#eee8de]/85 p-1 shadow-sm backdrop-blur-sm sm:left-8 sm:top-8">
                      <ToolButton icon={<Undo2 size={16} />} label="Undo" disabled={!history.length && !imageHistory.length} onClick={undo} />
                      <ToolButton icon={<Redo2 size={16} />} label="Redo" disabled={!redoStack.length && !imageRedoStack.length} onClick={redo} />
                      <span className="mx-1 h-5 w-px bg-[#cfc4b5]" />
                      {(activeImage || activePageImages.length > 0) && <span className="ml-1 rounded-lg px-1.5 text-[10px] font-bold text-[#6e6c67]"><ImageIcon size={14} className="inline" /> {activePageImages.length || 1} image{(activePageImages.length || 1) === 1 ? "" : "s"}</span>}
                    </div>
                    {minimapOpen && <div className="canvas-minimap" aria-label="Canvas overview navigation">
                      <div className="minimap-label"><span>Overview</span><span>{Math.round(zoom)}%</span></div>
                      <button className="minimap-track" aria-label="Jump to canvas position" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const fraction = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)); const workspace = workspaceRef.current; if (workspace) workspace.scrollTo({ top: fraction * Math.max(0, workspace.scrollHeight - workspace.clientHeight), behavior: "smooth" }); }}>
                        <span className="minimap-paper" />
                        <span className="minimap-viewport" style={{ top: `${Math.min(100, Math.max(0, (workspaceScroll.top / Math.max(1, workspaceScroll.scrollHeight - workspaceScroll.clientHeight)) * 100))}%`, height: `${Math.min(88, Math.max(18, (workspaceScroll.clientHeight / Math.max(1, workspaceScroll.scrollHeight)) * 150))}px` }} />
                      </button>
                      <span className="minimap-hint">Tap to jump · drag canvas to pan</span>
                    </div>}
                    <div className="zoom-dock" aria-label="Canvas zoom controls">
                      <button onClick={() => setZoom((value) => Math.max(4, value - 5))} aria-label="Zoom out" title="Zoom out"><ZoomOut size={15} /></button>
                      <button className="zoom-value" onClick={resetZoom} aria-label="Reset zoom to 100 percent" title="Reset zoom">{Math.round(zoom)}%</button>
                      <button onClick={() => setZoom((value) => Math.min(200, value + 5))} aria-label="Zoom in" title="Zoom in"><ZoomIn size={15} /></button>
                      <span className="zoom-dock-divider" />
                      <button onClick={fitZoom} aria-label="Fit canvas" title="Fit canvas"><Maximize2 size={14} /></button>
                    </div>
                    {activePdf ? <PdfDocumentViewer file={activePdf} pageNumber={activeBoard?.pageNumber ?? 1} onPageCount={(count) => setNotebooks((current) => current.map((notebook) => {
                      if (notebook.id !== activeNotebook?.id) return notebook;
                      if (notebook.boards.length === count) return { ...notebook, pages: count };
                      return { ...notebook, pages: count, boards: makeBoards(count, "Page", "Imported") };
                    }))} onPageChange={(pageNumber) => {
                      const targetBoard = activeNotebook?.boards.find((board) => board.pageNumber === pageNumber);
                      if (targetBoard) setActiveBoardId(targetBoard.id);
                    }} /> : <div className="paper-frame relative mt-14 min-h-[calc(100vh-210px)] w-full max-w-[1100px] origin-top overflow-hidden shadow-[0_18px_34px_rgba(61,51,42,0.18)]" style={{ backgroundColor: activeBoard?.color ?? "#fffdf8", transform: `scale(${zoom / 100})`, marginBottom: `${Math.max(0, (zoom - 100) * 3)}px` }}>
                      {activeImageUrl && <div className={`image-layer absolute z-30 ${tool === "select" ? "cursor-move" : "pointer-events-none"} ${imageSelected ? "image-layer-selected" : ""}`} style={{ left: `${imagePosition.x}%`, top: `${imagePosition.y}%`, width: `${imageScale}%` }} onClick={() => tool === "select" && setImageSelected(true)} onPointerDown={(event) => beginImageInteraction(event, "move")} onPointerMove={moveImageInteraction} onPointerUp={endImageInteraction} onPointerCancel={endImageInteraction}>
                        <img src={activeImageUrl} alt={activeImage?.name ? `Imported ${activeImage.name}` : "Imported image"} className="block h-auto w-full select-none object-contain object-top" draggable={false} onError={() => toast.error("The imported image could not be displayed", { description: "Try importing the image again." })} />
                        {tool === "select" && imageSelected && <div className="image-resize-handle" role="slider" aria-label="Resize imported image" tabIndex={0} onPointerDown={(event) => beginImageInteraction(event, "resize")} />}
                      </div>}
                      {activePageImages.map(({ item, url }) => <div key={item.id} className={`image-layer absolute z-30 ${tool === "select" ? "cursor-move" : "pointer-events-none"} ${selectedPageImageId === item.id ? "image-layer-selected" : ""}`} style={{ left: `${item.layout.x}%`, top: `${item.layout.y}%`, width: `${item.layout.scale}%` }} onClick={() => tool === "select" && setSelectedPageImageId(item.id)} onPointerDown={(event) => { startPageImageHold(item.id); beginPageImageInteraction(event, item.id, "move"); }} onPointerMove={movePageImageInteraction} onPointerUp={(event) => { clearPageImageHold(); endPageImageInteraction(event); }} onPointerCancel={(event) => { clearPageImageHold(); endPageImageInteraction(event); }}>
                        <img src={url} alt={`Imported ${item.name}`} className="block h-auto w-full select-none object-contain object-top" draggable={false} onError={() => toast.error("The imported image could not be displayed")} />
                        {tool === "select" && selectedPageImageId === item.id && <><div className="image-resize-handle" role="slider" aria-label={`Resize ${item.name}`} tabIndex={0} onPointerDown={(event) => { clearPageImageHold(); beginPageImageInteraction(event, item.id, "resize"); }} /><button type="button" className="image-delete-button" onPointerDown={(event) => event.stopPropagation()} onClick={() => deletePageImage(item.id)} aria-label={`Delete ${item.name}`}><Trash2 size={13} /> Delete</button>{pageImageMenuId === item.id && <div className="image-hold-menu">Image selected · choose Delete</div>}</>}
                      </div>)}
{activeBoard?.id === "bio-cellular-respiration" ? <div className="paper-content pointer-events-none absolute inset-0 overflow-hidden px-[13%] py-[12%] text-[#39465d]">
                        <div className="mb-8 flex items-start justify-between"><div><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#bf6958]">Biology · Unit 04</p><h3 className="font-display text-[clamp(20px,3vw,34px)] leading-none text-[#25344f]">Cellular respiration</h3><p className="mt-3 text-[11px] font-semibold text-[#7a8494]">Tuesday 24 September · Lecture 06</p></div><div className="rounded-lg border border-[#e2b8ab] bg-[#fdf5ed] px-2 py-1 text-[10px] font-bold text-[#c46c5a]">4 / 38</div></div>
                        <div className="space-y-5 text-[clamp(11px,1.4vw,15px)] leading-[1.65]"><div className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#d8745e]" /><p><strong className="font-bold text-[#2d3b58]">Glycolysis</strong> happens in the cytoplasm — one glucose becomes two pyruvate molecules.</p></div><div className="ml-5 rounded-xl border border-[#dce1e5] bg-[#f7f9f7]/70 p-4"><p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#768698]">Remember</p><p className="font-semibold text-[#31415d]">Net yield: <span className="text-[#ce6b56]">2 ATP</span> + 2 NADH</p></div><div className="flex gap-3"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#799882]" /><p><strong className="font-bold text-[#2d3b58]">Krebs cycle</strong> takes place in the mitochondrial matrix. It releases CO₂ and loads electron carriers.</p></div><div className="relative ml-2 mt-8 h-36 rounded-2xl border border-dashed border-[#a8bac0] bg-[#edf4f0]/55"><div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center"><div className="mx-auto mb-2 flex h-14 w-20 items-center justify-center rounded-full border-2 border-[#789c8c] text-[10px] font-bold text-[#658574]">MITOCHONDRION</div><div className="h-5 w-px bg-[#789c8c] mx-auto" /><p className="mt-1 text-[9px] font-semibold text-[#789c8c]">inner membrane = ATP synthase</p></div></div><div className="mt-6 flex items-center gap-3 border-t border-[#e6d7cf] pt-4 text-[11px] font-semibold text-[#c46c5a]"><CheckCircle2 size={15} /> Exam connection: compare aerobic vs anaerobic respiration</div></div>
                      </div> : <div className="paper-content pointer-events-none absolute inset-0 overflow-hidden px-[13%] py-[12%] text-[#39465d]"><div className={`h-full ${tool === "text" ? "pointer-events-auto" : "pointer-events-none"}`}><textarea value={pageText[activePageKey] ?? ""} onChange={(event) => updatePageText(event.target.value)} readOnly={tool !== "text"} placeholder="Tap Text to type, or choose Pen to write by hand…" aria-label="Typed notes for this page" className="h-[66%] w-full resize-none bg-transparent pt-1 text-[clamp(16px,2vw,24px)] leading-[1.45] text-[#39465d] outline-none placeholder:text-[#b9b0a4]" /></div></div>}
                      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="relative z-20 block h-auto w-full touch-none rounded-[3px] bg-transparent" style={{ pointerEvents: (activeImageUrl || activePageImages.length) && tool === "select" ? "none" : "auto" }} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={finishStroke} onPointerCancel={finishStroke} onPointerLeave={(event) => { setEraserCursor(null); if (isDrawing && event.buttons === 0) finishStroke(event); }} aria-label="Handwriting canvas" onContextMenu={(event) => event.preventDefault()} />
                      {tool === "select" && selectedBounds && <><div className="selection-context-toolbar" style={{ left: `${(selectedBounds.left / CANVAS_WIDTH) * 100}%`, top: `${Math.max(0, (selectedBounds.top / CANVAS_HEIGHT) * 100 - 4)}%` }}><span>{selectedStrokeIndexes.length} stroke{selectedStrokeIndexes.length === 1 ? "" : "s"} selected</span><button onClick={duplicateSelectedStrokes} aria-label="Duplicate selection"><Copy size={13} /></button><button onClick={deleteSelectedStrokes} aria-label="Delete selection"><Trash2 size={13} /></button></div><div className="selection-handles" style={{ left: `${(selectedBounds.left / CANVAS_WIDTH) * 100}%`, top: `${(selectedBounds.top / CANVAS_HEIGHT) * 100}%`, width: `${(selectedBounds.width / CANVAS_WIDTH) * 100}%`, height: `${(selectedBounds.height / CANVAS_HEIGHT) * 100}%` }}><i /><i /><i /><i /></div><div className="lasso-selection-bubble" style={{ left: `${(selectedBounds.left / CANVAS_WIDTH) * 100}%`, top: `${(selectedBounds.top / CANVAS_HEIGHT) * 100}%`, width: `${(selectedBounds.width / CANVAS_WIDTH) * 100}%`, height: `${(selectedBounds.height / CANVAS_HEIGHT) * 100}%` }}><span>Drag to move</span></div></>}
                      {tool === "eraser" && eraserCursor && <div aria-hidden="true" className="pointer-events-none absolute z-20 rounded-full border-2 border-[#d66f59] bg-[#d66f59]/10 shadow-[0_0_0_1px_rgba(255,255,255,.8)]" style={{ left: `${(eraserCursor.x / CANVAS_WIDTH) * 100}%`, top: `${(eraserCursor.y / CANVAS_HEIGHT) * 100}%`, width: `${(84 / CANVAS_WIDTH) * 100}%`, aspectRatio: "1", transform: "translate(-50%, -50%)" }} />}
                      {lassoPoints.length > 1 && <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`} preserveAspectRatio="none"><polyline points={lassoPoints.map((point) => `${point.x},${point.y}`).join(" ")} fill="rgba(214,111,89,0.08)" stroke="#d66f59" strokeWidth="5" strokeDasharray="18 14" /></svg>}
                    </div>}
                  </div>
                  <aside className="editor-toolbar border-t border-[#d2c8ba] bg-[#f4efe7]/80 lg:border-l lg:border-t-0">
                    <div className="flex items-center justify-between border-b border-[#d9d0c3] px-5 py-4"><span className="text-xs font-bold uppercase tracking-[0.18em] text-[#88837a]">Writing tools</span><button className="rounded-lg p-1.5 text-[#929089] hover:bg-[#e6dfd5]" onClick={() => showComingSoon("Toolbar settings")} aria-label="Toolbar settings"><Settings2 size={16} /></button></div>
                    <div className="grid grid-cols-3 gap-2 px-5 py-4 lg:grid-cols-2"><EditorTool active={false} icon={<Undo2 size={18} />} label="Undo" onClick={undo} /><EditorTool active={false} icon={<Redo2 size={18} />} label="Redo" onClick={redo} /><EditorTool active={tool === "select"} icon={<Pencil size={18} />} label="Select" onClick={() => setTool("select")} /><EditorTool active={tool === "pen"} icon={<PenLine size={18} />} label="Pen" onClick={() => setTool("pen")} /><EditorTool active={tool === "text"} icon={<FileText size={18} />} label="Text" onClick={() => setTool("text")} /><EditorTool active={tool === "highlight"} icon={<Highlighter size={18} />} label="Highlight" onClick={() => setTool("highlight")} /><EditorTool active={tool === "eraser"} icon={<Eraser size={18} />} label="Eraser" onClick={() => setTool("eraser")} /><EditorTool active={tool === "line"} icon={<Minus size={18} />} label="Line" onClick={() => setTool("line")} /><EditorTool active={tool === "lasso"} icon={<Lasso size={18} />} label="Lasso" onClick={() => setTool("lasso")} /><EditorTool active={false} icon={<FileUp size={18} />} label="Import" onClick={() => fileInputRef.current?.click()} /><label className="editor-quick-color flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#d5cbbd] bg-[#fffaf5] text-[#6f6d66]" title="Choose ink color"><Palette size={16} /><input type="color" value={selectedColor} onChange={(event) => setSelectedColor(event.target.value)} className="absolute h-0 w-0 opacity-0" aria-label="Choose ink color" /></label><label className="editor-quick-size flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[#d5cbbd] bg-[#fffaf5] px-2 text-[10px] font-bold text-[#6f6d66]" title="Adjust brush size"><span>Size</span><input type="range" min="1" max="40" step="1" value={penSize} onChange={(event) => setPenSize(Number(event.target.value))} className="w-20 cursor-pointer accent-[#d66f59]" aria-label="Brush size" /><output>{penSize}</output></label></div>
                    <div className="space-y-5 px-5 pb-5"><div><div className="mb-3 flex items-center justify-between text-xs font-semibold text-[#77766f]"><span>Ink colour</span><span className="font-mono text-[10px] text-[#aaa59b]">{selectedColor.toUpperCase()}</span></div><div className="flex flex-wrap items-center gap-2"><ColorDot color="#2f456f" active={selectedColor === "#2f456f"} onClick={() => setSelectedColor("#2f456f")} /><ColorDot color="#d66f59" active={selectedColor === "#d66f59"} onClick={() => setSelectedColor("#d66f59")} /><ColorDot color="#6e927e" active={selectedColor === "#6e927e"} onClick={() => setSelectedColor("#6e927e")} /><ColorDot color="#d2a73b" active={selectedColor === "#d2a73b"} onClick={() => setSelectedColor("#d2a73b")} /><ColorDot color="#25282c" active={selectedColor === "#25282c"} onClick={() => setSelectedColor("#25282c")} /><label className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-[#bdb4a9] bg-[#fffaf5] text-[#8e8a81]" title="Choose a custom ink color"><Palette size={13} /><input type="color" value={selectedColor} onChange={(event) => setSelectedColor(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Choose a custom ink color" /></label></div></div><div><div className="mb-3 flex items-center justify-between text-xs font-semibold text-[#77766f]"><span>Brush size</span><span className="font-mono text-[10px] text-[#aaa59b]">{penSize}px</span></div><input type="range" min="1" max="40" step="1" value={penSize} onChange={(event) => setPenSize(Number(event.target.value))} className="h-2 w-full cursor-pointer accent-[#d66f59]" aria-label="Brush size" /><div className="mt-2 flex items-center justify-between text-[10px] text-[#aaa59b]"><span>1px</span><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f9f6f0]" aria-hidden="true"><span className="rounded-full bg-[#2f456f]" style={{ width: `${Math.min(18, Math.max(2, penSize))}px`, height: `${Math.min(18, Math.max(2, penSize))}px` }} /></span><span>40px</span></div></div><div className="rounded-xl border border-[#ded4c6] bg-[#faf7f2] p-3"><div className="mb-2 flex items-center gap-2 text-xs font-bold text-[#686861]"><Tablet size={14} className="text-[#c56b58]" /> Tablet ready</div><p className="text-[11px] leading-4 text-[#98958d]">Pressure-aware ink, palm-friendly input, and offline saves work across iPadOS, Android, and desktop.</p></div></div>
                    <div className="border-t border-[#d9d0c3] p-5"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.18em] text-[#88837a]">Whiteboards</span><button onClick={() => openBoardCreator(activeNotebook)} disabled={Boolean(activePdf)} className="rounded-lg p-1.5 text-[#77766f] hover:bg-[#e6dfd5] disabled:cursor-not-allowed disabled:opacity-30" aria-label="Add whiteboard"><Plus size={16} /></button></div><div className="flex items-center gap-2"><button onClick={() => { const board = activeNotebook?.boards[Math.max(0, activeBoardIndex - 1)]; if (board) setActiveBoardId(board.id); }} disabled={activeBoardIndex <= 0} className="rounded-lg p-2 text-[#83817a] hover:bg-[#e6dfd5] disabled:cursor-not-allowed disabled:opacity-30" aria-label="Previous whiteboard"><ChevronLeft size={16} /></button><div className="flex-1 truncate rounded-lg border border-[#c9705c] bg-[#fffaf5] px-3 py-2 text-center text-sm font-bold text-[#4d4d48]">{activeBoard?.title ?? "Whiteboard"}</div><button onClick={() => { const board = activeNotebook?.boards[Math.min((activeNotebook.boards.length ?? 1) - 1, activeBoardIndex + 1)]; if (board) setActiveBoardId(board.id); }} disabled={activeBoardIndex < 0 || activeBoardIndex >= (activeNotebook?.boards.length ?? 1) - 1} className="rounded-lg p-2 text-[#83817a] hover:bg-[#e6dfd5] disabled:cursor-not-allowed disabled:opacity-30" aria-label="Next whiteboard"><ChevronRight size={16} /></button></div></div>
                  </aside>
                </div>
              </section>
            </div>
          ) : (
          <div className="space-y-10 px-5 pb-14 pt-8 sm:px-8 lg:px-10 lg:pt-10">
            <section className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#c56854]"><span className="h-1.5 w-1.5 rounded-full bg-[#d56f5a]" /> Your library</div>
                <h1 className="font-display text-4xl leading-none tracking-[-0.04em] text-[#252628] sm:text-5xl">Make space for<br /><em className="font-display text-[#c56854]">better thinking.</em></h1>
                <p className="mt-4 max-w-lg text-[15px] leading-6 text-[#737571]">A quiet place for handwritten notes, past papers, and the ideas worth keeping.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setViewMode("grid")} className={`rounded-xl p-2.5 transition ${viewMode === "grid" ? "bg-[#e5dfd5] text-[#292b2e]" : "text-[#9a9993] hover:bg-[#e9e5dc]"}`} aria-label="Grid view"><Grid2X2 size={18} /></button>
                <button onClick={() => setViewMode("list")} className={`rounded-xl p-2.5 transition ${viewMode === "list" ? "bg-[#e5dfd5] text-[#292b2e]" : "text-[#9a9993] hover:bg-[#e9e5dc]"}`} aria-label="List view"><LayoutList size={18} /></button>
                <button onClick={createNotebook} className="ml-2 flex items-center gap-2 rounded-xl bg-[#d66f59] px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(208,103,80,0.18)] transition hover:-translate-y-0.5 hover:bg-[#c5604d]"><Plus size={17} /> New notebook</button>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-3">
              <StatCard icon={<BookOpen size={18} />} value="3" label="Notebooks" detail="12.4 MB stored" color="coral" />
              <StatCard icon={<PenLine size={18} />} value="79" label="Pages written" detail="+8 this week" color="sage" />
              <StatCard icon={<CalendarDays size={18} />} value="6.5h" label="Focus time" detail="Since Monday" color="lilac" />
            </section>

            <section className="rounded-[22px] border border-[#ded8cd] bg-[#f9f6f0] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#88847b]"><Folder size={14} className="text-[#c66d59]" /> Organize</div><p className="mt-1 text-sm text-[#8a8982]">Drag notebooks or past papers into a folder. <span className="font-semibold text-[#c56854]">Long-press for actions.</span></p></div><button onClick={createFolder} className="flex items-center gap-2 rounded-lg border border-[#d8d0c4] bg-[#fffaf5] px-3 py-2 text-xs font-bold text-[#67675f] transition hover:border-[#d49483] hover:text-[#bf6551]"><Plus size={14} /> New folder</button></div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {folders.filter((folder) => !folder.parentId || !collapsedFolderIds.includes(folder.parentId)).map((folder) => <FolderCard key={folder.id} folder={folder} notebookCount={notebooks.filter((notebook) => notebook.folderId === folder.id).length} active={activeFolder === folder.id} hasChildren={folders.some((child) => child.parentId === folder.id)} collapsed={collapsedFolderIds.includes(folder.id)} onDragStart={handleFolderDragStart} onDrop={handleFolderDrop} onToggle={() => setActiveFolder(activeFolder === folder.id ? null : folder.id)} onToggleCollapse={() => setCollapsedFolderIds((current) => current.includes(folder.id) ? current.filter((id) => id !== folder.id) : [...current, folder.id])} onRename={() => renameFolder(folder.id)} onCreateSubfolder={() => createSubfolder(folder.id)} onDelete={() => deleteFolder(folder.id)} />)}
              </div>
            </section>

            <section>
              <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                <div><h2 className="font-display text-2xl tracking-[-0.03em]">Your notebooks</h2><p className="mt-1 text-sm text-[#8a8a85]">Pick up where you left off.</p></div>
                <div className="flex flex-wrap items-center gap-2"><button onClick={selectAllVisible} className="rounded-lg border border-[#ddd6cb] bg-[#faf7f1] px-3 py-2 text-xs font-bold text-[#76766f] transition hover:border-[#d49a8b]">{selectedNotebookIds.length === filteredNotebooks.length && filteredNotebooks.length ? "Clear selection" : "Select all"}</button>{selectedNotebookIds.length > 0 && <><select defaultValue="" onChange={(event) => { if (event.target.value) moveSelectedNotebooks(event.target.value === "root" ? null : event.target.value); }} className="rounded-lg border border-[#ddd6cb] bg-[#faf7f1] px-3 py-2 text-xs font-bold text-[#76766f] outline-none"><option value="">Move selected to…</option><option value="root">No folder</option>{folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.parentId ? "↳ " : ""}{folder.name}</option>)}</select><button onClick={deleteSelectedNotebooks} className="flex items-center gap-1.5 rounded-lg border border-[#edc9c0] bg-[#fff4f0] px-3 py-2 text-xs font-bold text-[#bf6551] transition hover:bg-[#fee9e2]"><Trash2 size={14} /> Trash {selectedNotebookIds.length}</button></>}<label className="hidden items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#7d7d77] sm:flex"><SlidersHorizontal size={15} /><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as typeof sortOrder)} className="bg-transparent outline-none"><option value="recent">Recently edited</option><option value="name">Name</option><option value="pages">Page count</option></select></label></div>
              </div>
              <div className={viewMode === "grid" ? "grid gap-5 md:grid-cols-2 xl:grid-cols-3" : "space-y-3"}>
                {filteredNotebooks.map((notebook, index) => (
                  <NotebookCard key={notebook.id} notebook={notebook} index={index} viewMode={viewMode} selected={selectedNotebook === notebook.id || selectedNotebookIds.includes(notebook.id)} onDragStart={handleNotebookDragStart} onSelect={() => toggleNotebookSelection(notebook.id)} onOpen={() => openNotebook(notebook)} onRename={() => renameNotebook(notebook.id)} onDelete={() => deleteNotebook(notebook.id)} />
                ))}
                <button onClick={createNotebook} className={viewMode === "grid" ? "group flex min-h-[250px] flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-[#d6d0c5] bg-[#f7f4ee]/50 p-6 text-center transition hover:border-[#d79284] hover:bg-[#f9f5ef]" : "flex items-center gap-4 rounded-2xl border-2 border-dashed border-[#d6d0c5] bg-[#f7f4ee]/50 p-4 text-left transition hover:border-[#d79284]"}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d0c8bd] text-[#b17a6d] transition group-hover:scale-105 group-hover:bg-[#fff8f3]"><Plus size={19} /></span>
                  <div className={viewMode === "grid" ? "mt-4" : ""}><p className="font-semibold text-[#656660]">Create a notebook</p><p className="mt-1 text-xs text-[#9b9a93]">Start with a blank page</p></div>
                </button>
              </div>
            </section>
          </div>
          )}
        </main>
        {importStatus && <ImportStatusToast status={importStatus} onDismiss={() => setImportStatus(null)} />}
        {settingsOpen && <SettingsPanel preferences={displayPreferences} onChange={setDisplayPreferences} onClose={() => setSettingsOpen(false)} />}
        {searchOpen && <SearchPanel query={search} onQueryChange={setSearch} notebooks={notebooks} onClose={() => setSearchOpen(false)} onOpen={(notebook) => { openNotebook(notebook); setSearchOpen(false); }} />}
        {boardCreatorOpen && <BoardCreator templateId={boardCreatorTemplateId} count={boardCreatorCount} color={boardCreatorColor} onTemplateChange={(id) => { setBoardCreatorTemplateId(id); const template = pageTemplates.find((item) => item.id === id); if (template) setBoardCreatorColor(template.color); }} onCountChange={setBoardCreatorCount} onColorChange={setBoardCreatorColor} onCancel={() => setBoardCreatorOpen(false)} onCreate={createWhiteboards} />}
      </div>
    </div>
  );
}

function TemplateGallery({ notebooks, onBack, onChoose }: { notebooks: Notebook[]; onBack: () => void; onChoose: (notebookId: string, templateId: string) => void }) {
  const [notebookId, setNotebookId] = useState(notebooks[0]?.id ?? "");
  return <div className="space-y-8 px-5 pb-14 pt-8 sm:px-8 lg:px-10 lg:pt-10"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><button onClick={onBack} className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#c56854] transition hover:text-[#a8523f]"><ChevronLeft size={14} /> Library</button><div className="flex items-center gap-3"><LayoutTemplate size={26} className="text-[#c56854]" /><div><h1 className="font-display text-4xl tracking-[-0.04em]">Page templates</h1><p className="mt-2 max-w-xl text-[15px] leading-6 text-[#737571]">Choose a page style, then create one or more whiteboards from it.</p></div></div></div><label className="flex items-center gap-2 rounded-xl border border-[#d8d0c4] bg-[#fffaf5] px-3 py-2 text-xs font-bold text-[#67675f]">Add to<select value={notebookId} onChange={(event) => setNotebookId(event.target.value)} className="max-w-[180px] bg-transparent outline-none">{notebooks.map((notebook) => <option key={notebook.id} value={notebook.id}>{notebook.title || "Untitled notebook"}</option>)}</select></label></div><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{pageTemplates.map((template) => <button key={template.id} onClick={() => notebookId && onChoose(notebookId, template.id)} className="group overflow-hidden rounded-[22px] border border-[#ded8cd] bg-[#f9f6f0] text-left shadow-[0_4px_12px_rgba(111,91,68,0.03)] transition hover:-translate-y-1 hover:border-[#d49382] hover:shadow-[0_12px_25px_rgba(111,91,68,0.1)]"><div className="relative h-44 overflow-hidden p-5" style={{ backgroundColor: template.color, backgroundImage: template.preview, backgroundSize: template.id === "graph" || template.id === "dot-grid" ? "18px 18px" : undefined }}><span className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-[#d66f59] text-xl font-bold text-white shadow-sm">{template.icon}</span><div className="absolute bottom-5 left-5 right-5 h-20 rounded-lg border border-[#c9c0b3]/60 bg-white/35 backdrop-blur-[1px]" /></div><div className="p-4"><h2 className="font-display text-2xl text-[#383936]">{template.name}</h2><p className="mt-1 text-sm leading-5 text-[#88867e]">{template.description}</p><span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#c56854]">Use this template <ChevronRight size={13} /></span></div></button>)}</div></div>;
}

function BoardCreator({ templateId, count, color, onTemplateChange, onCountChange, onColorChange, onCancel, onCreate }: { templateId: string; count: number; color: string; onTemplateChange: (id: string) => void; onCountChange: (count: number) => void; onColorChange: (color: string) => void; onCancel: () => void; onCreate: () => void }) {
  const template = pageTemplates.find((item) => item.id === templateId) ?? pageTemplates[0];
  const colors = ["#fffdf8", "#fff5ed", "#f1f7f0", "#f4f0f8", "#eef5f7", "#fffbe8"];
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#24272b]/45 p-4 backdrop-blur-sm"><div className="w-full max-w-2xl rounded-[26px] border border-[#ded5c9] bg-[#fbf8f2] p-5 shadow-[0_24px_70px_rgba(46,37,29,0.24)] sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#c56854]">New whiteboard pages</p><h2 className="mt-2 font-display text-3xl text-[#333432]">Choose your page setup</h2></div><button onClick={onCancel} className="rounded-lg p-2 text-[#8f8b83] hover:bg-[#eee6dc]" aria-label="Close"><X size={18} /></button></div><div className="mt-6 grid gap-3 sm:grid-cols-3">{pageTemplates.map((item) => <button key={item.id} onClick={() => onTemplateChange(item.id)} className={`rounded-xl border p-3 text-left transition ${item.id === template.id ? "border-[#d78672] bg-[#fff0e9]" : "border-[#e2dacf] bg-[#fffdf9] hover:border-[#d7b0a4]"}`}><div className="mb-2 h-16 rounded-lg border border-[#d8d0c4]" style={{ backgroundColor: item.color, backgroundImage: item.preview, backgroundSize: item.id === "graph" || item.id === "dot-grid" ? "12px 12px" : undefined }} /><p className="truncate text-sm font-bold text-[#4c4c47]">{item.name}</p></button>)}</div><div className="mt-6 grid gap-5 sm:grid-cols-2"><label className="block"><span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#88847b]">Number of pages</span><input type="number" min="1" max="20" value={count} onChange={(event) => onCountChange(Math.min(20, Math.max(1, Number(event.target.value) || 1)))} className="w-full rounded-xl border border-[#d8d0c4] bg-[#fffdf9] px-3 py-2.5 text-sm font-semibold text-[#4c4c47] outline-none focus:border-[#d78672]" /></label><div><span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-[#88847b]">Page color</span><div className="flex flex-wrap items-center gap-2">{colors.map((swatch) => <button key={swatch} onClick={() => onColorChange(swatch)} className={`h-8 w-8 rounded-full border-2 ${color === swatch ? "border-[#c56854] ring-2 ring-[#f0c2b5] ring-offset-2" : "border-[#d0c8bd]"}`} style={{ backgroundColor: swatch }} aria-label={`Use ${swatch} page color`} />)}<label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-[#bdb4a9] bg-[#fffaf5]"><Palette size={14} className="absolute inset-0 m-auto text-[#8e8a81]" /><input type="color" value={color} onChange={(event) => onColorChange(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label="Choose custom page color" /></label></div></div></div><div className="mt-7 flex justify-end gap-2"><button onClick={onCancel} className="rounded-xl px-4 py-2.5 text-sm font-bold text-[#77746e] hover:bg-[#eee6dc]">Cancel</button><button onClick={onCreate} className="flex items-center gap-2 rounded-xl bg-[#d66f59] px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(208,103,80,0.18)] hover:bg-[#c5604d]"><Plus size={16} /> Create {count} page{count === 1 ? "" : "s"}</button></div></div></div>;
}

function NotebookBoardsView({ notebook, onBack, onOpenBoard, onAddBoard, onDeleteBoard, onRenameBoard, onImport, isPdf }: { notebook: Notebook; onBack: () => void; onOpenBoard: (board: Board) => void; onAddBoard: () => void; onDeleteBoard: (boardId: string) => void; onRenameBoard: (boardId: string) => void; onImport: () => void; isPdf: boolean }) {
  const palette: Record<string, string> = { coral: "from-[#f4c2b4] via-[#e79783] to-[#ca6e58]", sage: "from-[#c8d8c6] via-[#a7c0a8] to-[#718c7a]", lilac: "from-[#d7c9db] via-[#bca9c9] to-[#8e7697]", navy: "from-[#cad4e3] via-[#8fa4bd] to-[#526d8b]" };
  return (
    <div className="space-y-8 px-5 pb-14 pt-8 sm:px-8 lg:px-10 lg:pt-10">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <button onClick={onBack} className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#c56854] transition hover:text-[#a8523f]"><ChevronLeft size={14} /> Library</button>
          <div className="flex items-center gap-4">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${palette[notebook.color] ?? palette.navy} text-xs font-black text-white shadow-inner`}>{notebook.icon}</div>
            <div>
              <h1 className="font-display text-4xl tracking-[-0.04em]">{notebook.title}</h1>
              <p className="mt-2 max-w-xl text-[15px] leading-6 text-[#737571]">{notebook.subtitle}</p>
            </div>
          </div>
        </div>
        {!isPdf && <button onClick={onAddBoard} className="flex items-center gap-2 self-start rounded-xl bg-[#d66f59] px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(208,103,80,0.18)] transition hover:-translate-y-0.5 hover:bg-[#c5604d]"><Plus size={17} /> New whiteboard</button>}
      </div>

      <section>
        <div className="mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div><h2 className="font-display text-2xl tracking-[-0.03em]">Whiteboards</h2><p className="mt-1 text-sm text-[#8a8a85]">{notebook.boards.length} whiteboard{notebook.boards.length === 1 ? "" : "s"} · pick one up or start a fresh sheet.</p></div>
          {isPdf && <div className="flex items-center gap-2 rounded-lg border border-[#ddd6cb] bg-[#faf7f1] px-3 py-2 text-xs font-bold text-[#76766f]"><FileText size={14} /> Pages come from the imported document</div>}
        </div>
        {notebook.boards.length ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {notebook.boards.map((board) => (
              <WhiteboardCard key={board.id} board={board} color={notebook.color} onOpen={() => onOpenBoard(board)} onRename={() => onRenameBoard(board.id)} onDelete={isPdf ? undefined : () => onDeleteBoard(board.id)} />
            ))}
            {!isPdf && (
              <button onClick={onAddBoard} className="group flex min-h-[210px] flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-[#d6d0c5] bg-[#f7f4ee]/50 p-6 text-center transition hover:border-[#d79284] hover:bg-[#f9f5ef]">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d0c8bd] text-[#b17a6d] transition group-hover:scale-105 group-hover:bg-[#fff8f3]"><Plus size={19} /></span>
                <div className="mt-4"><p className="font-semibold text-[#656660]">New whiteboard</p><p className="mt-1 text-xs text-[#9b9a93]">Start with a blank sheet</p></div>
              </button>
            )}
          </div>
        ) : (
          <div className="flex min-h-[240px] flex-col items-center justify-center rounded-[26px] border-2 border-dashed border-[#d6d0c5] bg-[#f7f4ee]/50 p-8 text-center">
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#d0c8bd] text-[#b17a6d]"><LayoutList size={20} /></span>
            <p className="font-semibold text-[#656660]">No whiteboards yet</p>
            <p className="mt-1 max-w-xs text-sm text-[#9b9a93]">Create your first blank whiteboard to start writing, sketching, or pasting in ideas.</p>
            <button onClick={onAddBoard} className="mt-5 flex items-center gap-2 rounded-xl bg-[#d66f59] px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(208,103,80,0.18)] transition hover:-translate-y-0.5 hover:bg-[#c5604d]"><Plus size={17} /> New whiteboard</button>
          </div>
        )}
      </section>

      <section className="rounded-[22px] border border-dashed border-[#d6d0c5] bg-[#f9f6f0] p-4 sm:p-5">
        <button onClick={onImport} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#d8d0c4] bg-[#fffaf5] px-4 py-3 text-sm font-bold text-[#67675f] transition hover:border-[#d49483] hover:text-[#bf6551]"><FileUp size={16} /> Import a PDF or image into a new notebook</button>
      </section>
    </div>
  );
}

function WhiteboardCard({ board, color, onOpen, onRename, onDelete }: { board: Board; color: string; onOpen: () => void; onRename: () => void; onDelete?: () => void }) {
  const palette: Record<string, string> = { coral: "#e79783", sage: "#a7c0a8", lilac: "#bca9c9", navy: "#8fa4bd" };
  const [showMenu, setShowMenu] = useState(false);
  const holdTimerRef = useRef<number | null>(null);
  const longPressRef = useRef(false);

  function clearHoldTimer() {
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  }

  function startHold() {
    clearHoldTimer();
    holdTimerRef.current = window.setTimeout(() => {
      longPressRef.current = true;
      setShowMenu(true);
      navigator.vibrate?.(10);
    }, 550);
  }

  function handleOpen() {
    clearHoldTimer();
    if (longPressRef.current) {
      longPressRef.current = false;
      return;
    }
    onOpen();
  }

  return (
    <div className="notebook-card group relative rounded-[22px] border border-[#ded8cd] bg-[#f8f5ef] p-3 shadow-[0_4px_12px_rgba(111,91,68,0.03)] transition duration-200 hover:-translate-y-1">
      <button onClick={handleOpen} onPointerDown={startHold} onPointerUp={clearHoldTimer} onPointerCancel={clearHoldTimer} onPointerLeave={clearHoldTimer} onContextMenu={(event) => { event.preventDefault(); clearHoldTimer(); setShowMenu(true); }} className="relative flex h-[172px] w-full touch-manipulation flex-col justify-between overflow-hidden rounded-[16px] bg-[#fffdf8] p-4 text-left shadow-inner" style={{ borderTop: `4px solid ${palette[color] ?? palette.navy}` }}>
        <div className="space-y-2.5">
          <div className="h-1.5 w-3/4 rounded-full bg-[#ece5d8]" />
          <div className="h-1.5 w-full rounded-full bg-[#ece5d8]" />
          <div className="h-1.5 w-5/6 rounded-full bg-[#ece5d8]" />
          <div className="h-1.5 w-2/3 rounded-full bg-[#ece5d8]" />
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#a09c92]"><PenLine size={12} /> Whiteboard</div>
      </button>
      <div className="flex items-center gap-3 px-2 pb-1 pt-4">
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#383936]">{board.title}</p><p className="mt-1 truncate text-xs text-[#98968e]">{board.updated}</p></div>
        {onDelete && <button onClick={(event) => { event.stopPropagation(); onDelete(); }} className="rounded-lg p-2 text-[#a09e96] opacity-0 transition hover:bg-[#fee9e2] hover:text-[#bf6551] group-hover:opacity-100" aria-label="Delete whiteboard"><Trash2 size={16} /></button>}
      </div>
      {showMenu && <div className="absolute right-4 top-14 z-30 w-44 rounded-xl border border-[#d8d0c4] bg-[#fffaf5] p-1.5 shadow-[0_14px_30px_rgba(61,51,42,0.18)]" role="menu" onPointerDown={(event) => event.stopPropagation()}><button onClick={() => { setShowMenu(false); onRename(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#5e5e58] hover:bg-[#f0e8dd]" role="menuitem"><Pencil size={15} /> Rename</button>{onDelete && <button onClick={() => { setShowMenu(false); onDelete(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#bf6551] hover:bg-[#fee9e2]" role="menuitem"><Trash2 size={15} /> Delete</button>}<button onClick={() => setShowMenu(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#9a978f] hover:bg-[#f0e8dd]">Cancel</button></div>}
    </div>
  );
}

function TrashPanel({ trashFolders, trashNotebooks, onRestoreFolder, onRestoreNotebook, onDeleteFolder, onDeleteNotebook, onBack }: { trashFolders: Folder[]; trashNotebooks: Notebook[]; onRestoreFolder: (folder: Folder) => void; onRestoreNotebook: (notebook: Notebook) => void; onDeleteFolder: (folder: Folder) => void; onDeleteNotebook: (notebook: Notebook) => void; onBack: () => void }) {
  return <div className="space-y-8 px-5 pb-14 pt-8 sm:px-8 lg:px-10 lg:pt-10"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-[#c56854]"><Trash2 size={14} /> Recycle bin</div><h1 className="font-display text-4xl tracking-[-0.04em]">Trash, without the panic.</h1><p className="mt-3 max-w-xl text-[15px] leading-6 text-[#737571]">Deleted notebooks and folders stay here until you restore them or permanently remove them.</p></div><button onClick={onBack} className="flex items-center gap-2 self-start rounded-xl border border-[#d8d0c4] bg-[#fffaf5] px-4 py-2.5 text-sm font-bold text-[#656660] transition hover:border-[#d49483]"><RotateCcw size={15} /> Back to library</button></div><section className="overflow-hidden rounded-[26px] border border-[#dcd6ca] bg-[#f8f5ef] shadow-[0_14px_35px_rgba(87,72,55,0.06)]"><div className="flex items-center justify-between border-b border-[#e0d9ce] px-5 py-4"><div><h2 className="font-display text-2xl">Deleted notebooks</h2><p className="mt-1 text-xs text-[#929088]">{trashNotebooks.length} item{trashNotebooks.length === 1 ? "" : "s"}</p></div></div><div className="divide-y divide-[#e8e1d7]">{trashNotebooks.length ? trashNotebooks.map((notebook) => <div key={notebook.id} className="flex items-center justify-between gap-3 px-5 py-4"><div className="min-w-0"><p className="truncate font-semibold text-[#454640]">{notebook.title}</p><p className="mt-1 text-xs text-[#96928a]">{notebook.subtitle}</p></div><div className="flex shrink-0 gap-2"><button onClick={() => onRestoreNotebook(notebook)} className="flex items-center gap-1.5 rounded-lg border border-[#cfe0d2] bg-[#f4faf4] px-3 py-2 text-xs font-bold text-[#5f8668]"><RotateCcw size={13} /> Restore</button><button onClick={() => onDeleteNotebook(notebook)} className="rounded-lg border border-[#edc9c0] bg-[#fff4f0] px-3 py-2 text-xs font-bold text-[#bf6551]">Delete forever</button></div></div>) : <p className="px-5 py-10 text-center text-sm text-[#99968e]">No deleted notebooks.</p>}</div></section><section className="overflow-hidden rounded-[26px] border border-[#dcd6ca] bg-[#f8f5ef] shadow-[0_14px_35px_rgba(87,72,55,0.06)]"><div className="border-b border-[#e0d9ce] px-5 py-4"><h2 className="font-display text-2xl">Deleted folders</h2><p className="mt-1 text-xs text-[#929088]">{trashFolders.length} item{trashFolders.length === 1 ? "" : "s"}</p></div><div className="divide-y divide-[#e8e1d7]">{trashFolders.length ? trashFolders.map((folder) => <div key={folder.id} className="flex items-center justify-between gap-3 px-5 py-4"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${folder.color}18`, color: folder.color }}><Folder size={17} /></span><p className="truncate font-semibold text-[#454640]">{folder.name}</p></div><div className="flex shrink-0 gap-2"><button onClick={() => onRestoreFolder(folder)} className="flex items-center gap-1.5 rounded-lg border border-[#cfe0d2] bg-[#f4faf4] px-3 py-2 text-xs font-bold text-[#5f8668]"><RotateCcw size={13} /> Restore</button><button onClick={() => onDeleteFolder(folder)} className="rounded-lg border border-[#edc9c0] bg-[#fff4f0] px-3 py-2 text-xs font-bold text-[#bf6551]">Delete forever</button></div></div>) : <p className="px-5 py-10 text-center text-sm text-[#99968e]">No deleted folders.</p>}</div></section></div>;
}
function Brand({ dark = false }: { dark?: boolean }) {
  return <div className={`flex items-center gap-2.5 ${dark ? "text-white" : "text-[#25272a]"}`}><span className={`flex h-9 w-9 items-center justify-center rounded-[11px] ${dark ? "bg-[#d8755f]" : "bg-[#d8755f]"} shadow-[0_7px_14px_rgba(211,105,84,0.2)]`}><NotebookPen size={18} className="text-white" /></span><div><p className="font-display text-[19px] leading-none tracking-[-0.04em]">paperflow</p><p className={`mt-1 text-[9px] font-bold uppercase tracking-[0.25em] ${dark ? "text-white/40" : "text-[#9b9a93]"}`}>notes studio</p></div></div>;
}

function SidebarContent({ onImport, onCreate, onAction }: { onImport: () => void; onCreate: () => void; onAction: (label: string) => void }) {
  return <div className="flex flex-col gap-7"><nav className="space-y-1"><SidebarItem active icon={<BookOpen size={17} />} label="My library" onClick={() => onAction("My library")} /><SidebarItem icon={<ClockIcon />} label="Recent" onClick={() => onAction("Recent notes")} /><SidebarItem icon={<Folder size={17} />} label="Collections" onClick={() => onAction("Collections")} /><SidebarItem icon={<Trash2 size={17} />} label="Trash" onClick={() => onAction("Trash")} /></nav><div><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Quick actions</p><SidebarItem icon={<Plus size={17} />} label="New notebook" onClick={onCreate} /><SidebarItem icon={<UploadCloud size={17} />} label="Import document" onClick={onImport} /><SidebarItem icon={<FileText size={17} />} label="Templates" onClick={() => onAction("Templates")} /></div><div><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Workspace</p><SidebarItem icon={<Wifi size={17} />} label="Offline ready" detail="On" /><SidebarItem icon={<Settings2 size={17} />} label="Settings" onClick={() => onAction("Settings")} /></div></div>;
}

function SidebarItem({ icon, label, active, detail, onClick }: { icon: React.ReactNode; label: string; active?: boolean; detail?: string; onClick?: () => void }) {
  return <button onClick={onClick} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${active ? "bg-white/10 font-semibold text-white" : "text-white/55 hover:bg-white/[0.06] hover:text-white"}`}><span className={`${active ? "text-[#f2a08d]" : "text-white/45 group-hover:text-[#f2a08d]"}`}>{icon}</span><span className="flex-1">{label}</span>{detail && <span className="text-xs font-bold text-[#82b890]">{detail}</span>}</button>;
}

function NotebookCard({ notebook, index, selected, viewMode, onDragStart, onSelect, onOpen, onRename, onDelete }: { notebook: Notebook; index: number; selected: boolean; viewMode: "grid" | "list"; onDragStart: (event: React.DragEvent, notebookId: string) => void; onSelect: () => void; onOpen: () => void; onRename: () => void; onDelete: () => void }) {
  const palette: Record<string, string> = { coral: "from-[#f4c2b4] via-[#e79783] to-[#ca6e58]", sage: "from-[#c8d8c6] via-[#a7c0a8] to-[#718c7a]", lilac: "from-[#d7c9db] via-[#bca9c9] to-[#8e7697]", navy: "from-[#cad4e3] via-[#8fa4bd] to-[#526d8b]" };
  const boardCount = notebook.boards?.length ?? notebook.pages;
  const title = notebook.title || "Untitled notebook";
  const [showMenu, setShowMenu] = useState(false);
  const holdTimerRef = useRef<number | null>(null);
  const longPressRef = useRef(false);
  const clearHold = () => { if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current); holdTimerRef.current = null; };
  const startHold = () => { clearHold(); holdTimerRef.current = window.setTimeout(() => { longPressRef.current = true; setShowMenu(true); navigator.vibrate?.(10); }, 550); };
  const finishOpen = () => { clearHold(); if (longPressRef.current) { longPressRef.current = false; return; } onOpen(); };
  const menu = <div className="absolute right-4 top-14 z-30 w-48 rounded-xl border border-[#d8d0c4] bg-[#fffaf5] p-1.5 shadow-[0_14px_30px_rgba(61,51,42,0.18)]" role="menu" onPointerDown={(event) => event.stopPropagation()}><button onClick={() => { setShowMenu(false); onRename(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#5e5e58] hover:bg-[#f0e8dd]" role="menuitem"><Pencil size={15} /> Rename</button><button onClick={() => { setShowMenu(false); onDelete(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#bf6551] hover:bg-[#fee9e2]" role="menuitem"><Trash2 size={15} /> Delete</button><button onClick={() => setShowMenu(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#9a978f] hover:bg-[#f0e8dd]">Cancel</button></div>;
  if (viewMode === "list") return <div draggable onDragStart={(event) => onDragStart(event, notebook.id)} onPointerDown={startHold} onPointerUp={clearHold} onPointerCancel={clearHold} onPointerLeave={clearHold} onContextMenu={(event) => { event.preventDefault(); clearHold(); setShowMenu(true); }} className={`group relative flex w-full items-center gap-4 rounded-2xl border p-3 text-left transition ${selected ? "border-[#d58a79] bg-[#fff9f3] shadow-[0_8px_20px_rgba(115,74,59,0.08)]" : "border-[#ded8cd] bg-[#f8f5ef] hover:-translate-y-0.5 hover:border-[#d2b6ab]"}`}><button onClick={finishOpen} className="flex min-w-0 flex-1 items-center gap-4 text-left"><div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${palette[notebook.color] ?? palette.navy} text-xs font-black text-white shadow-inner`}>{notebook.icon || "NOTE"}</div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate font-semibold text-[#363735]">{title}</p><span className="shrink-0 text-xs text-[#99978f]">{boardCount} whiteboard{boardCount === 1 ? "" : "s"}</span></div><p className="mt-1 truncate text-sm text-[#8b8981]">{notebook.subtitle || "A space for your notes"}</p></div></button><button onClick={(event) => { event.stopPropagation(); onSelect(); }} className={`rounded-lg p-2 transition ${selected ? "bg-[#fff0ea] text-[#cb6b56]" : "text-[#a09e96] opacity-0 group-hover:opacity-100 hover:bg-[#ebe4da]"}`} aria-label="Select notebook"><Check size={16} /></button><button onClick={(event) => { event.stopPropagation(); setShowMenu(true); }} className="rounded-lg p-2 text-[#a09e96] opacity-0 transition hover:bg-[#ebe4da] group-hover:opacity-100" aria-label={`Actions for ${title}`}><MoreHorizontal size={17} /></button>{showMenu && menu}</div>;
  return <div draggable onDragStart={(event) => onDragStart(event, notebook.id)} onPointerDown={startHold} onPointerUp={clearHold} onPointerCancel={clearHold} onPointerLeave={clearHold} onContextMenu={(event) => { event.preventDefault(); clearHold(); setShowMenu(true); }} className={`notebook-card group relative rounded-[22px] border p-3 transition duration-200 hover:-translate-y-1 ${selected ? "border-[#d58a79] bg-[#fffaf5] shadow-[0_12px_28px_rgba(115,74,59,0.1)]" : "border-[#ded8cd] bg-[#f8f5ef] shadow-[0_4px_12px_rgba(111,91,68,0.03)]"}`}><button onClick={finishOpen} className={`cover-surface relative flex h-[172px] w-full items-end overflow-hidden rounded-[16px] bg-gradient-to-br ${palette[notebook.color] ?? palette.navy} p-5 text-left shadow-inner`}><span className="absolute -right-5 -top-8 h-36 w-36 rounded-full border-[18px] border-white/10" /><span className="absolute -bottom-16 -left-12 h-32 w-32 rounded-full bg-white/10 blur-xl" /><div className="relative z-10"><span className="mb-2 inline-flex rounded-full bg-white/20 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-white/90">{notebook.icon || "NOTE"}</span><p className="max-w-[190px] font-display text-[23px] leading-6 tracking-[-0.04em] text-white">{title.split(" · ")[0]}<br /><em className="font-display text-white/80">{title.split(" · ")[1] ?? "notes"}</em></p></div><div className="absolute bottom-4 right-4 rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold text-white/80 backdrop-blur-sm">{boardCount} whiteboard{boardCount === 1 ? "" : "s"}</div></button><div className="flex items-center gap-3 px-2 pb-1 pt-4"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#383936]">{title}</p><p className="mt-1 truncate text-xs text-[#98968e]">{notebook.updated || "Edited just now"}</p></div><button onClick={(event) => { event.stopPropagation(); onSelect(); }} className={`rounded-lg p-2 transition ${selected ? "bg-[#fff0ea] text-[#cb6b56]" : "text-[#a09e96] opacity-0 group-hover:opacity-100 hover:bg-[#ebe4da]"}`} aria-label="Select notebook"><Check size={16} /></button><button onClick={(event) => { event.stopPropagation(); setShowMenu(true); }} className="rounded-lg p-2 text-[#a09e96] opacity-0 transition hover:bg-[#ebe4da] group-hover:opacity-100" aria-label={`Actions for ${title}`}><MoreHorizontal size={17} /></button></div>{showMenu && menu}</div>;
}

function FolderCard({ folder, notebookCount, active, hasChildren, collapsed, onDragStart, onDrop, onToggle, onToggleCollapse, onRename, onCreateSubfolder, onDelete }: { folder: Folder; notebookCount: number; active: boolean; hasChildren: boolean; collapsed: boolean; onDragStart: (event: React.DragEvent, folderId: string) => void; onDrop: (event: React.DragEvent, folderId: string) => void; onToggle: () => void; onToggleCollapse: () => void; onRename: () => void; onCreateSubfolder: () => void; onDelete: () => void }) {
  const name = folder.name || "Untitled folder";
  const [showMenu, setShowMenu] = useState(false);
  const holdTimerRef = useRef<number | null>(null);
  const longPressRef = useRef(false);
  const clearHold = () => { if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current); holdTimerRef.current = null; };
  const startHold = () => { clearHold(); holdTimerRef.current = window.setTimeout(() => { longPressRef.current = true; setShowMenu(true); navigator.vibrate?.(10); }, 550); };
  const finishToggle = () => { clearHold(); if (longPressRef.current) { longPressRef.current = false; return; } onToggle(); };
  return <div draggable onDragStart={(event) => onDragStart(event, folder.id)} onClick={finishToggle} onPointerDown={startHold} onPointerUp={clearHold} onPointerCancel={clearHold} onPointerLeave={clearHold} onContextMenu={(event) => { event.preventDefault(); clearHold(); setShowMenu(true); }} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onDrop(event, folder.id)} className={`group relative flex min-w-[172px] items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${folder.parentId ? "ml-5 border-dashed" : ""} ${active ? "border-[#d98d7c] bg-[#fff2eb]" : "border-[#e4ddd2] bg-[#fffdf9] hover:border-[#d4b3a9]"}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${folder.color || "#78947e"}18`, color: folder.color || "#78947e" }}><Folder size={17} /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold leading-5 text-[#454640]">{name}</span><span className="mt-0.5 block truncate text-[10px] font-semibold text-[#8f8b83]">{notebookCount} notebook{notebookCount === 1 ? "" : "s"}</span></span><span className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100"><button onClick={(event) => { event.stopPropagation(); if (hasChildren) onToggleCollapse(); }} className={`rounded-md p-1 text-[#9a9188] hover:bg-[#eee6dc] hover:text-[#bf6551] ${hasChildren ? "" : "invisible"}`} aria-label={`${collapsed ? "Expand" : "Collapse"} ${name}`}><ChevronDown size={12} className={collapsed ? "-rotate-90 transition" : "transition"} /></button><button onClick={(event) => { event.stopPropagation(); onRename(); }} className="rounded-md p-1 text-[#9a9188] hover:bg-[#eee6dc] hover:text-[#bf6551]" aria-label={`Rename ${name}`}><Pencil size={12} /></button><button onClick={(event) => { event.stopPropagation(); onCreateSubfolder(); }} className="rounded-md p-1 text-[#9a9188] hover:bg-[#eee6dc] hover:text-[#bf6551]" aria-label={`Create subfolder in ${name}`}><Plus size={13} /></button><button onClick={(event) => { event.stopPropagation(); onDelete(); }} className="rounded-md p-1 text-[#9a9188] hover:bg-[#fee9e2] hover:text-[#bf6551]" aria-label={`Move ${name} to Trash`}><Trash2 size={12} /></button></span>{showMenu && <div className="absolute right-3 top-12 z-30 w-48 rounded-xl border border-[#d8d0c4] bg-[#fffaf5] p-1.5 shadow-[0_14px_30px_rgba(61,51,42,0.18)]" role="menu" onPointerDown={(event) => event.stopPropagation()}><button onClick={() => { setShowMenu(false); onRename(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#5e5e58] hover:bg-[#f0e8dd]"><Pencil size={15} /> Rename</button><button onClick={() => { setShowMenu(false); onDelete(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#bf6551] hover:bg-[#fee9e2]"><Trash2 size={15} /> Delete</button><button onClick={() => setShowMenu(false)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#9a978f] hover:bg-[#f0e8dd]">Cancel</button></div>}</div>;
}

function StatCard({ icon, value, label, detail, color }: { icon: React.ReactNode; value: string; label: string; detail: string; color: string }) {
  const styles: Record<string, string> = { coral: "bg-[#fae8e1] text-[#c96e59]", sage: "bg-[#e4eee5] text-[#70947b]", lilac: "bg-[#ece6ef] text-[#9277a0]" };
  return <div className="flex items-center gap-4 rounded-2xl border border-[#e2dbd0] bg-[#f9f6f0] px-4 py-4"><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles[color]}`}>{icon}</div><div><div className="flex items-baseline gap-2"><span className="font-display text-2xl tracking-[-0.04em]">{value}</span><span className="text-xs font-semibold text-[#777870]">{label}</span></div><p className="mt-0.5 text-[11px] text-[#9c9a92]">{detail}</p></div></div>;
}

function EditorTool({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-[11px] font-semibold transition ${active ? "border-[#d78672] bg-[#fff7f2] text-[#c86d58] shadow-sm" : "border-transparent text-[#8a8880] hover:border-[#ded4c7] hover:bg-[#f9f5ef]"}`}>{icon}<span>{label}</span></button>;
}

function ToolButton({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return <button disabled={disabled} onClick={onClick} className="rounded-lg p-2 text-[#77736c] transition hover:bg-[#e1d8cb] hover:text-[#373735] disabled:cursor-not-allowed disabled:opacity-30" aria-label={label}>{icon}</button>;
}

function ColorDot({ color, active, onClick }: { color: string; active: boolean; onClick: () => void }) {
  return <button onClick={onClick} className={`flex h-7 w-7 items-center justify-center rounded-full transition ${active ? "ring-2 ring-[#c8705d] ring-offset-2 ring-offset-[#f4efe7]" : "hover:scale-110"}`} style={{ backgroundColor: color }} aria-label={`Choose ${color}`}><span className="sr-only">{color}</span></button>;
}

function ImportStatusToast({ status, onDismiss }: { status: ImportStatus; onDismiss: () => void }) {
  return <div className={`fixed bottom-5 right-5 z-[80] w-[min(360px,calc(100vw-32px))] rounded-2xl border p-4 shadow-[0_18px_50px_rgba(61,51,42,0.2)] ${status.error ? "border-[#e4b7ad] bg-[#fff3ef]" : "border-[#cfe0d2] bg-[#f5fbf4]"}`} role="status" aria-live="polite">
    <div className="flex items-start gap-3"><span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${status.error ? "bg-[#f3d2ca] text-[#b75b4d]" : "bg-[#dcecdf] text-[#5f8668]"}`}>{status.error ? <X size={16} /> : status.progress === 100 ? <CheckCircle size={16} /> : <UploadCloud size={16} />}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-bold text-[#454640]">{status.name}</p><button onClick={onDismiss} className="rounded-md p-1 text-[#99968e] hover:bg-black/5" aria-label="Dismiss import status"><X size={14} /></button></div><p className="mt-1 text-xs text-[#777870]">{status.message}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10"><div className={`h-full rounded-full transition-all ${status.error ? "bg-[#c75f4e]" : "bg-[#6f9c78]"}`} style={{ width: `${status.progress}%` }} /></div></div></div>
  </div>;
}

function SearchPanel({ query, onQueryChange, notebooks, onClose, onOpen }: { query: string; onQueryChange: (value: string) => void; notebooks: Notebook[]; onClose: () => void; onOpen: (notebook: Notebook) => void }) {
  const results = notebooks.filter((notebook) => `${notebook.title} ${notebook.subtitle} ${notebook.boards.map((board) => board.title).join(" ")}`.toLowerCase().includes(query.toLowerCase())).slice(0, 12);
  return <div className="fixed inset-0 z-[70] flex items-start justify-center bg-[#24272b]/35 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}><div className="w-full max-w-2xl overflow-hidden rounded-[24px] border border-[#ded5c9] bg-[#fbf8f2] shadow-[0_24px_70px_rgba(46,37,29,0.24)]" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-center gap-3 border-b border-[#e3dbd0] px-5 py-4"><Search size={19} className="text-[#c56854]" /><input autoFocus value={query} onChange={(event) => onQueryChange(event.target.value)} onKeyDown={(event) => event.key === "Escape" && onClose()} placeholder="Search notebooks, whiteboards, and typed notes…" className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#383936] outline-none placeholder:text-[#aaa59b]" /><kbd className="hidden rounded-md border border-[#ddd4c8] bg-[#f3eee6] px-2 py-1 text-[10px] font-bold text-[#98948b] sm:inline">ESC</kbd></div><div className="max-h-[55vh] overflow-auto p-3">{query && results.length ? results.map((notebook) => <button key={notebook.id} onClick={() => onOpen(notebook)} className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-[#f0e8dd]"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e9ddd2] text-xs font-black text-[#9a5f52]">{notebook.icon || "NOTE"}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#454640]">{notebook.title}</span><span className="mt-1 block truncate text-xs text-[#8f8b83]">{notebook.subtitle} · {notebook.boards.length} whiteboards</span></span><ChevronRight size={16} className="text-[#aaa197]" /></button>) : <div className="px-4 py-12 text-center"><Search size={24} className="mx-auto text-[#cfc5b8]" /><p className="mt-3 text-sm font-semibold text-[#77746e]">{query ? "No matching notes" : "Search across your local library"}</p><p className="mt-1 text-xs text-[#aaa59b]">Use the title, subtitle, or whiteboard name.</p></div>}</div></div></div>;
}

function SettingsPanel({ preferences, onChange, onClose }: { preferences: DisplayPreferences; onChange: React.Dispatch<React.SetStateAction<DisplayPreferences>>; onClose: () => void }) {
  const update = <K extends keyof DisplayPreferences>(key: K, value: DisplayPreferences[K]) => onChange((current) => ({ ...current, [key]: value }));
  return <div className="fixed inset-0 z-[70] flex justify-end bg-[#24272b]/30 backdrop-blur-sm" onMouseDown={onClose}><section className="h-full w-full max-w-[440px] overflow-auto border-l border-[#ded5c9] bg-[#fbf8f2] p-5 shadow-[-18px_0_55px_rgba(46,37,29,0.18)]" onMouseDown={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c56854]">Workspace</p><h2 className="mt-2 font-display text-3xl text-[#333432]">Settings</h2><p className="mt-2 text-sm leading-5 text-[#858178]">Your preferences are stored locally on this device.</p></div><button onClick={onClose} className="rounded-xl p-2 text-[#8f8b83] hover:bg-[#eee6dc]" aria-label="Close settings"><X size={18} /></button></div><div className="mt-8 space-y-6"><section><h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#88847b]">Theme</h3><div className="grid grid-cols-3 gap-2">{([["light", <Sun size={15} />, "Light"], ["dark", <Moon size={15} />, "Dark"], ["contrast", <Contrast size={15} />, "High contrast"]] as const).map(([value, icon, label]) => <button key={value} onClick={() => update("theme", value)} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-bold transition ${preferences.theme === value ? "border-[#d78672] bg-[#fff0e9] text-[#c56854]" : "border-[#ded6cb] bg-[#fffdf9] text-[#77746e] hover:border-[#d6b1a5]"}`}>{icon}{label}</button>)}</div></section><section className="space-y-2"><h3 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#88847b]">Display preferences</h3>{([["largeText", <Type size={16} />, "Larger text", "Increase reading size across the workspace"], ["reducedMotion", <RotateCw size={16} />, "Reduced motion", "Minimize transitions and animations"], ["compactToolbar", <SlidersHorizontal size={16} />, "Compact toolbar", "Keep more editor tools visible on small screens"], ["leftHanded", <MoveHorizontal size={16} />, "Left-handed layout", "Move the editor controls closer to the left side"]] as const).map(([key, icon, label, description]) => <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#e2dbd0] bg-[#fffdf9] p-3"><span className="text-[#c56854]">{icon}</span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#55554e]">{label}</span><span className="mt-0.5 block text-xs text-[#96928a]">{description}</span></span><input type="checkbox" checked={preferences[key]} onChange={(event) => update(key, event.target.checked)} className="h-4 w-4 accent-[#d66f59]" /></label>)}</section><section className="rounded-2xl border border-[#ded6cb] bg-[#f6f1e9] p-4"><div className="flex items-center gap-2 text-sm font-bold text-[#56564f]"><Save size={16} className="text-[#6f9c78]" /> Autosave</div><p className="mt-2 text-xs leading-5 text-[#89857d]">Changes are written to local storage automatically. Imported files are kept in IndexedDB for offline access.</p><div className="mt-3 flex items-center gap-2 text-xs font-bold text-[#66846d]"><CheckCircle2 size={14} /> Saved locally on this device</div></section></div></section></div>;
}

function ClockIcon() { return <CalendarDays size={17} />; }
