import React, { useEffect, useRef, useState, useCallback } from 'react';
import JSZip from 'jszip';
import { marked } from 'marked';
import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import type { BookMeta, ReaderSettings, TocItem, HighlightColor } from '../../../shared/types';
import { THEMES } from '../../../shared/constants';
import { HighlightMenu } from '../annotations/HighlightMenu';
import { Loader2, AlertTriangle, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Button } from '../ui/button';

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).toString();
}

interface BookRendererProps {
  book: BookMeta;
  settings: ReaderSettings;
  ttsActiveSentence?: string;
  onProgressChange: (progress: number, lastPosition?: string) => void;
  onPageChange: (current: number, total: number) => void;
  onChapterChange: (chapter: string) => void;
  onTocLoaded: (toc: TocItem[]) => void;
  onHighlightCreated?: (color: HighlightColor, text: string) => void;
  onAddNoteRequested?: (text: string) => void;
  onLookupRequested?: (word: string) => void;
  onSpeakRequested?: (text: string) => void;
}

export const BookRenderer: React.FC<BookRendererProps> = ({
  book,
  settings,
  ttsActiveSentence,
  onProgressChange,
  onPageChange,
  onChapterChange,
  onTocLoaded,
  onHighlightCreated,
  onAddNoteRequested,
  onLookupRequested,
  onSpeakRequested,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // EPUB / Text state
  const [chapters, setChapters] = useState<{ id: string; title: string; html: string }[]>([]);
  const [currentChapterIdx, setCurrentChapterIdx] = useState(0);
  const [columnOffset, setColumnOffset] = useState(0);
  const [totalColumns, setTotalColumns] = useState(1);

  // PDF state
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfPageNum, setPdfPageNum] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.2);

  // Comic / CBZ state
  const [comicImages, setComicImages] = useState<string[]>([]);
  const [comicPageIdx, setComicPageIdx] = useState(0);

  // Selection & Highlight Menu
  const [selectionMenuPos, setSelectionMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState('');

  /* ─────────────────────────────────────────────────────────────
     1. Load Book Data based on format
     ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    let isMounted = true;

    async function loadBook() {
      setLoading(true);
      setError(null);
      setChapters([]);
      setComicImages([]);
      setPdfDoc(null);

      try {
        const fileData = await window.api.invoke('file:read', book.filePath);
        if (!isMounted) return;

        switch (book.format) {
          case 'epub':
            await loadEpub(fileData);
            break;
          case 'pdf':
            await loadPdf(fileData);
            break;
          case 'cbz':
          case 'cbr':
            await loadComic(fileData);
            break;
          case 'docx':
            await loadDocx(fileData);
            break;
          case 'fb2':
            await loadFb2(fileData);
            break;
          case 'markdown':
          case 'txt':
          case 'html':
          case 'mobi':
          case 'azw3':
          case 'kf8':
          default:
            await loadTextBased(fileData, book.format);
            break;
        }
      } catch (err: any) {
        console.error('Failed to load book:', err);
        if (isMounted) {
          setError(
            err?.message ||
              'Unable to render this book. The file may be corrupt or DRM-protected.'
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadBook();

    return () => {
      isMounted = false;
    };
  }, [book.filePath, book.format]);

  /* ─────────────────────────────────────────────────────────────
     EPUB Parser
     ───────────────────────────────────────────────────────────── */
  const loadEpub = async (data: Uint8Array) => {
    const zip = await JSZip.loadAsync(data);

    // 1. container.xml
    const container = zip.file('META-INF/container.xml');
    if (!container) throw new Error('Invalid EPUB: Missing container.xml');
    const containerText = await container.async('text');
    const opfMatch = containerText.match(/full-path\s*=\s*["']([^"']+)["']/i);
    if (!opfMatch) throw new Error('Invalid EPUB: Cannot find rootfile');

    const opfPath = opfMatch[1];
    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/')) : '';
    const opfFile = zip.file(opfPath);
    if (!opfFile) throw new Error('Invalid EPUB: OPF file not found');
    const opfText = await opfFile.async('text');

    // 2. Parse Manifest & Spine
    const manifestItems = new Map<string, { href: string; mediaType: string }>();
    const itemRegex = /<item[^>]+id\s*=\s*["']([^"']+)["'][^>]+href\s*=\s*["']([^"']+)["'][^>]+media-type\s*=\s*["']([^"']+)["'][^>]*\/?>/gi;
    let match;
    while ((match = itemRegex.exec(opfText)) !== null) {
      manifestItems.set(match[1], { href: match[2], mediaType: match[3] });
    }

    // Secondary regex for different attribute order
    const itemRegex2 = /<item[^>]+href\s*=\s*["']([^"']+)["'][^>]+id\s*=\s*["']([^"']+)["'][^>]+media-type\s*=\s*["']([^"']+)["'][^>]*\/?>/gi;
    while ((match = itemRegex2.exec(opfText)) !== null) {
      if (!manifestItems.has(match[2])) {
        manifestItems.set(match[2], { href: match[1], mediaType: match[3] });
      }
    }

    // Spine
    const spineItemRefs: string[] = [];
    const itemrefRegex = /<itemref[^>]+idref\s*=\s*["']([^"']+)["'][^>]*\/?>/gi;
    while ((match = itemrefRegex.exec(opfText)) !== null) {
      spineItemRefs.push(match[1]);
    }

    // 3. TOC Parsing
    const parsedToc: TocItem[] = [];
    // Try NCX
    const ncxItem = Array.from(manifestItems.values()).find(
      (i) => i.mediaType === 'application/x-dtbncx+xml' || i.href.endsWith('.ncx')
    );
    if (ncxItem) {
      const ncxPath = opfDir ? `${opfDir}/${ncxItem.href}` : ncxItem.href;
      const ncxFile = zip.file(ncxPath) || zip.file(decodeURIComponent(ncxPath));
      if (ncxFile) {
        const ncxXml = await ncxFile.async('text');
        const navPointRegex = /<navPoint[^>]*>[\s\S]*?<text>([^<]+)<\/text>[\s\S]*?<content[^>]+src\s*=\s*["']([^"']+)["'][\s\S]*?<\/navPoint>/gi;
        let npMatch;
        while ((npMatch = navPointRegex.exec(ncxXml)) !== null) {
          parsedToc.push({
            label: npMatch[1].trim(),
            href: npMatch[2].trim(),
          });
        }
      }
    }

    if (parsedToc.length > 0) {
      onTocLoaded(parsedToc);
    }

    // 4. Load spine chapters into memory
    const loadedChapters: { id: string; title: string; html: string }[] = [];

    for (let i = 0; i < spineItemRefs.length; i++) {
      const idref = spineItemRefs[i];
      const item = manifestItems.get(idref);
      if (!item) continue;

      const chapterPath = opfDir ? `${opfDir}/${item.href}` : item.href;
      const file = zip.file(chapterPath) || zip.file(decodeURIComponent(chapterPath));
      if (!file) continue;

      let chapterHtml = await file.async('text');

      // Inline images from zip as base64 data URIs so they display seamlessly
      const chapterDir = chapterPath.includes('/')
        ? chapterPath.substring(0, chapterPath.lastIndexOf('/'))
        : '';

      const imgRegex = /<img[^>]+src\s*=\s*["']([^"']+)["']/gi;
      let imgMatch;
      const imgSources = new Set<string>();
      while ((imgMatch = imgRegex.exec(chapterHtml)) !== null) {
        imgSources.add(imgMatch[1]);
      }

      for (const src of imgSources) {
        if (src.startsWith('data:') || src.startsWith('http')) continue;
        const resolvedPath = chapterDir ? `${chapterDir}/${src}` : src;
        const normalized = resolvedPath.replace(/\/\.\//g, '/').replace(/[^\/]+\/\.\.\//g, '');
        const imgFile = zip.file(normalized) || zip.file(decodeURIComponent(normalized));
        if (imgFile) {
          const imgExt = src.split('.').pop()?.toLowerCase() || 'jpeg';
          const mime = imgExt === 'png' ? 'image/png' : imgExt === 'gif' ? 'image/gif' : 'image/jpeg';
          const imgBase64 = await imgFile.async('base64');
          chapterHtml = chapterHtml.replaceAll(src, `data:${mime};base64,${imgBase64}`);
        }
      }

      // Clean HTML / extract body content
      const bodyMatch = chapterHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      const cleanHtml = bodyMatch ? bodyMatch[1] : chapterHtml;

      // Extract chapter heading
      const hMatch = cleanHtml.match(/<h[1-3][^>]*>([^<]+)<\/h[1-3]>/i);
      const title = hMatch ? hMatch[1].trim() : `Chapter ${i + 1}`;

      loadedChapters.push({
        id: idref,
        title,
        html: cleanHtml,
      });
    }

    if (loadedChapters.length === 0) {
      throw new Error('EPUB contains no readable spine chapters.');
    }

    setChapters(loadedChapters);
    setCurrentChapterIdx(0);
    onChapterChange(loadedChapters[0].title);
    onPageChange(1, loadedChapters.length);
  };

  /* ─────────────────────────────────────────────────────────────
     PDF Loader
     ───────────────────────────────────────────────────────────── */
  const loadPdf = async (data: Uint8Array) => {
    const loadingTask = pdfjsLib.getDocument({ data });
    const pdf = await loadingTask.promise;
    setPdfDoc(pdf);
    setPdfPageNum(1);
    setPdfTotalPages(pdf.numPages);
    onPageChange(1, pdf.numPages);

    // Extract PDF TOC / Outline
    try {
      const outline = await pdf.getOutline();
      if (outline && outline.length > 0) {
        const tocItems: TocItem[] = outline.map((item: any) => ({
          label: item.title,
          href: typeof item.dest === 'string' ? item.dest : String(item.dest?.[0]?.num || 1),
        }));
        onTocLoaded(tocItems);
      }
    } catch {
      // Outline not available
    }

    await renderPdfPage(pdf, 1, pdfScale);
  };

  const renderPdfPage = async (pdf: any, pageNum: number, scale: number) => {
    if (!canvasRef.current || !pdf) return;
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };
    await page.render(renderContext).promise;
    onChapterChange(`Page ${pageNum} of ${pdf.numPages}`);
    onProgressChange((pageNum - 1) / Math.max(1, pdf.numPages - 1));
  };

  /* ─────────────────────────────────────────────────────────────
     Comics / CBZ Loader
     ───────────────────────────────────────────────────────────── */
  const loadComic = async (data: Uint8Array) => {
    const zip = await JSZip.loadAsync(data);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    const imageNames = Object.keys(zip.files)
      .filter((name) => !zip.files[name].dir && imageExtensions.some((ext) => name.toLowerCase().endsWith(ext)))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    if (imageNames.length === 0) {
      throw new Error('No images found in comic book archive.');
    }

    const images: string[] = [];
    for (const name of imageNames) {
      const file = zip.file(name);
      if (file) {
        const base64 = await file.async('base64');
        const ext = name.split('.').pop()?.toLowerCase();
        const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
        images.push(`data:${mime};base64,${base64}`);
      }
    }

    setComicImages(images);
    setComicPageIdx(0);
    onPageChange(1, images.length);
    onChapterChange(`Page 1 of ${images.length}`);

    // Generate basic TOC for comic pages
    const tocItems: TocItem[] = images.map((_, idx) => ({
      label: `Page ${idx + 1}`,
      href: `${idx}`,
    }));
    onTocLoaded(tocItems);
  };

  /* ─────────────────────────────────────────────────────────────
     DOCX Loader
     ───────────────────────────────────────────────────────────── */
  const loadDocx = async (data: Uint8Array) => {
    const result = await mammoth.convertToHtml({ arrayBuffer: data.slice().buffer as ArrayBuffer });
    const html = result.value;
    setChapters([{ id: 'docx-main', title: book.title, html }]);
    setCurrentChapterIdx(0);
    onChapterChange(book.title);
    onPageChange(1, 1);
  };

  /* ─────────────────────────────────────────────────────────────
     FB2 Loader
     ───────────────────────────────────────────────────────────── */
  const loadFb2 = async (data: Uint8Array) => {
    let xmlText = '';
    // Check if FB2 zip
    if (data[0] === 0x50 && data[1] === 0x4b) {
      const zip = await JSZip.loadAsync(data);
      const fb2File = Object.keys(zip.files).find((f) => f.endsWith('.fb2'));
      if (fb2File) {
        xmlText = await zip.file(fb2File)!.async('text');
      }
    } else {
      const decoder = new TextDecoder('utf-8');
      xmlText = decoder.decode(data);
    }

    // Extract sections from FB2 body
    const bodyMatch = xmlText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : xmlText;

    // Convert FB2 tags to HTML
    let html = bodyContent
      .replace(/<section[^>]*>/gi, '<div class="fb2-section">')
      .replace(/<\/section>/gi, '</div>')
      .replace(/<title[^>]*>([\s\S]*?)<\/title>/gi, '<h2>$1</h2>')
      .replace(/<p[^>]*>/gi, '<p>')
      .replace(/<empty-line\s*\/>/gi, '<br/>');

    setChapters([{ id: 'fb2-main', title: book.title, html }]);
    setCurrentChapterIdx(0);
    onChapterChange(book.title);
    onPageChange(1, 1);
  };

  /* ─────────────────────────────────────────────────────────────
     TXT, Markdown, HTML Loader
     ───────────────────────────────────────────────────────────── */
  const loadTextBased = async (data: Uint8Array, fmt: string) => {
    const decoder = new TextDecoder('utf-8');
    const rawText = decoder.decode(data);

    let html = '';
    if (fmt === 'markdown') {
      html = await marked.parse(rawText);
    } else if (fmt === 'html') {
      const bodyMatch = rawText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      html = bodyMatch ? bodyMatch[1] : rawText;
    } else {
      // Plain text: escape HTML and wrap paragraphs
      const escaped = rawText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      html = escaped
        .split(/\r?\n\r?\n/)
        .map((p) => `<p>${p.replace(/\r?\n/g, '<br/>')}</p>`)
        .join('');
    }

    setChapters([{ id: 'text-main', title: book.title, html }]);
    setCurrentChapterIdx(0);
    onChapterChange(book.title);
    onPageChange(1, 1);
  };

  /* ─────────────────────────────────────────────────────────────
     Pagination Calculation & Navigation
     ───────────────────────────────────────────────────────────── */
  const calculateColumns = useCallback(() => {
    if (settings.viewMode === 'scroll') return;
    const el = contentRef.current;
    if (!el) return;

    const scrollWidth = el.scrollWidth;
    const clientWidth = el.clientWidth;
    if (clientWidth > 0) {
      const cols = Math.max(1, Math.ceil(scrollWidth / clientWidth));
      setTotalColumns(cols);
    }
  }, [settings.viewMode, currentChapterIdx]);

  useEffect(() => {
    calculateColumns();
    const handleResize = () => calculateColumns();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateColumns]);

  const goToNextPage = useCallback(() => {
    if (book.format === 'pdf' && pdfDoc) {
      if (pdfPageNum < pdfTotalPages) {
        const next = pdfPageNum + 1;
        setPdfPageNum(next);
        renderPdfPage(pdfDoc, next, pdfScale);
        onPageChange(next, pdfTotalPages);
      }
      return;
    }

    if ((book.format === 'cbz' || book.format === 'cbr') && comicImages.length > 0) {
      if (comicPageIdx < comicImages.length - 1) {
        const next = comicPageIdx + 1;
        setComicPageIdx(next);
        onPageChange(next + 1, comicImages.length);
        onChapterChange(`Page ${next + 1} of ${comicImages.length}`);
        onProgressChange(next / Math.max(1, comicImages.length - 1));
      }
      return;
    }

    // Paginated text mode
    if (settings.viewMode === 'paginated') {
      const el = contentRef.current;
      if (el) {
        const nextOffset = columnOffset + el.clientWidth;
        if (nextOffset < el.scrollWidth - 10) {
          el.scrollTo({ left: nextOffset, behavior: 'smooth' });
          setColumnOffset(nextOffset);
          return;
        }
      }

      // If at end of chapter, move to next chapter
      if (currentChapterIdx < chapters.length - 1) {
        const nextIdx = currentChapterIdx + 1;
        setCurrentChapterIdx(nextIdx);
        setColumnOffset(0);
        if (contentRef.current) contentRef.current.scrollTo({ left: 0 });
        onChapterChange(chapters[nextIdx].title);
        onPageChange(nextIdx + 1, chapters.length);
        onProgressChange(nextIdx / Math.max(1, chapters.length - 1));
      }
    }
  }, [
    book.format,
    pdfDoc,
    pdfPageNum,
    pdfTotalPages,
    pdfScale,
    comicImages,
    comicPageIdx,
    settings.viewMode,
    columnOffset,
    currentChapterIdx,
    chapters,
  ]);

  const goToPrevPage = useCallback(() => {
    if (book.format === 'pdf' && pdfDoc) {
      if (pdfPageNum > 1) {
        const prev = pdfPageNum - 1;
        setPdfPageNum(prev);
        renderPdfPage(pdfDoc, prev, pdfScale);
        onPageChange(prev, pdfTotalPages);
      }
      return;
    }

    if ((book.format === 'cbz' || book.format === 'cbr') && comicImages.length > 0) {
      if (comicPageIdx > 0) {
        const prev = comicPageIdx - 1;
        setComicPageIdx(prev);
        onPageChange(prev + 1, comicImages.length);
        onChapterChange(`Page ${prev + 1} of ${comicImages.length}`);
        onProgressChange(prev / Math.max(1, comicImages.length - 1));
      }
      return;
    }

    // Paginated text mode
    if (settings.viewMode === 'paginated') {
      const el = contentRef.current;
      if (el && columnOffset > 10) {
        const prevOffset = Math.max(0, columnOffset - el.clientWidth);
        el.scrollTo({ left: prevOffset, behavior: 'smooth' });
        setColumnOffset(prevOffset);
        return;
      }

      // If at start of chapter, move to previous chapter
      if (currentChapterIdx > 0) {
        const prevIdx = currentChapterIdx - 1;
        setCurrentChapterIdx(prevIdx);
        setColumnOffset(0);
        onChapterChange(chapters[prevIdx].title);
        onPageChange(prevIdx + 1, chapters.length);
        onProgressChange(prevIdx / Math.max(1, chapters.length - 1));
      }
    }
  }, [
    book.format,
    pdfDoc,
    pdfPageNum,
    pdfTotalPages,
    pdfScale,
    comicImages,
    comicPageIdx,
    settings.viewMode,
    columnOffset,
    currentChapterIdx,
    chapters,
  ]);

  /* ─────────────────────────────────────────────────────────────
     Seek progress directly (from slider)
     ───────────────────────────────────────────────────────────── */
  const seekProgress = useCallback(
    (fraction: number) => {
      if (book.format === 'pdf' && pdfDoc) {
        const page = Math.max(1, Math.min(pdfTotalPages, Math.round(fraction * pdfTotalPages)));
        setPdfPageNum(page);
        renderPdfPage(pdfDoc, page, pdfScale);
        onPageChange(page, pdfTotalPages);
        return;
      }

      if ((book.format === 'cbz' || book.format === 'cbr') && comicImages.length > 0) {
        const page = Math.max(0, Math.min(comicImages.length - 1, Math.round(fraction * (comicImages.length - 1))));
        setComicPageIdx(page);
        onPageChange(page + 1, comicImages.length);
        return;
      }

      if (chapters.length > 0) {
        const idx = Math.max(0, Math.min(chapters.length - 1, Math.round(fraction * (chapters.length - 1))));
        setCurrentChapterIdx(idx);
        setColumnOffset(0);
        if (contentRef.current) contentRef.current.scrollTo({ left: 0 });
        onChapterChange(chapters[idx].title);
        onPageChange(idx + 1, chapters.length);
      }
    },
    [book.format, pdfDoc, pdfTotalPages, pdfScale, comicImages, chapters]
  );

  // Expose pagination controls to parent window if needed
  useEffect(() => {
    (window as any).__readerNavigate = {
      next: goToNextPage,
      prev: goToPrevPage,
      seek: seekProgress,
      navigateToHref: (href: string) => {
        const cleanHref = href.split('#')[0];
        const foundIdx = chapters.findIndex((c) => c.id === cleanHref || c.html.includes(href));
        if (foundIdx !== -1) {
          setCurrentChapterIdx(foundIdx);
          setColumnOffset(0);
          onChapterChange(chapters[foundIdx].title);
        }
      },
    };
  }, [goToNextPage, goToPrevPage, seekProgress, chapters]);

  /* ─────────────────────────────────────────────────────────────
     Karaoke Sentence Highlighting
     ───────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!contentRef.current) return;

    const prev = contentRef.current.querySelectorAll('.tts-active-sentence');
    prev.forEach((el) => {
      el.classList.remove(
        'tts-active-sentence',
        'bg-amber-300/40',
        'dark:bg-amber-500/30',
        'rounded-md',
        'ring-2',
        'ring-amber-400/50'
      );
    });

    if (!ttsActiveSentence) return;

    const snippet = ttsActiveSentence.trim().slice(0, 45);
    if (!snippet) return;

    const walker = document.createTreeWalker(contentRef.current, NodeFilter.SHOW_TEXT);
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.nodeValue && node.nodeValue.includes(snippet)) {
        const parent = node.parentElement;
        if (parent) {
          parent.classList.add(
            'tts-active-sentence',
            'bg-amber-300/40',
            'dark:bg-amber-500/30',
            'rounded-md',
            'ring-2',
            'ring-amber-400/50',
            'transition-all'
          );
          parent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        break;
      }
    }
  }, [ttsActiveSentence]);

  /* ─────────────────────────────────────────────────────────────
     Text Selection for Annotations & Dictionary
     ───────────────────────────────────────────────────────────── */
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      setSelectionMenuPos(null);
      setSelectedText('');
      return;
    }

    const text = selection.toString().trim();
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setSelectedText(text);
    setSelectionMenuPos({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  };

  /* ─────────────────────────────────────────────────────────────
     Styling calculation based on ReaderSettings
     ───────────────────────────────────────────────────────────── */
  const currentChapter = chapters[currentChapterIdx];
  const isSepia = settings.theme === 'sepia';
  const isDark = settings.theme === 'dark';

  const themeColors = isSepia
    ? { bg: '#fbf0d9', text: '#2e241c' }
    : isDark
    ? { bg: '#0f172a', text: '#f1f5f9' }
    : { bg: '#ffffff', text: '#111827' };

  return (
    <div
      ref={containerRef}
      onMouseUp={handleMouseUp}
      style={{
        backgroundColor: themeColors.bg,
        color: themeColors.text,
      }}
      className="relative flex-1 w-full h-full overflow-hidden select-text"
    >
      {/* ─── Loading State ─── */}
      {loading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm z-30 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Opening {book.title}...</p>
        </div>
      )}

      {/* ─── Error State ─── */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-background z-30">
          <div className="rounded-full bg-destructive/10 p-4 text-destructive mb-4">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-semibold text-destructive mb-2">Unable to Open Book</h2>
          <p className="text-sm text-muted-foreground max-w-md mb-6">{error}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      )}

      {/* ─── PDF Viewer ─── */}
      {book.format === 'pdf' && !loading && !error && (
        <div className="h-full w-full overflow-auto flex flex-col items-center p-4">
          {/* PDF Zoom Controls */}
          <div className="sticky top-2 z-20 flex items-center space-x-2 bg-card/90 border border-border shadow-md rounded-full px-3 py-1 mb-4 backdrop-blur-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                const s = Math.max(0.5, pdfScale - 0.2);
                setPdfScale(s);
                renderPdfPage(pdfDoc, pdfPageNum, s);
              }}
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs font-mono">{Math.round(pdfScale * 100)}%</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                const s = Math.min(3.0, pdfScale + 0.2);
                setPdfScale(s);
                renderPdfPage(pdfDoc, pdfPageNum, s);
              }}
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setPdfScale(1.2);
                renderPdfPage(pdfDoc, pdfPageNum, 1.2);
              }}
              title="Reset Zoom"
            >
              <Maximize className="h-3.5 w-3.5" />
            </Button>
          </div>

          <canvas ref={canvasRef} className="shadow-2xl rounded-sm border border-border/50" />
        </div>
      )}

      {/* ─── Comics / CBZ Viewer ─── */}
      {(book.format === 'cbz' || book.format === 'cbr') && !loading && !error && (
        <div
          className={`h-full w-full flex items-center justify-center overflow-auto p-4 ${
            settings.rightToLeft ? 'flex-row-reverse' : 'flex-row'
          }`}
        >
          {comicImages.length > 0 && (
            <img
              src={comicImages[comicPageIdx]}
              alt={`Page ${comicPageIdx + 1}`}
              className="max-h-full max-w-full object-contain rounded shadow-lg select-none"
            />
          )}
        </div>
      )}

      {/* ─── Reflowable EPUB / Text / DOCX / HTML / FB2 Viewer ─── */}
      {book.format !== 'pdf' &&
        book.format !== 'cbz' &&
        book.format !== 'cbr' &&
        !loading &&
        !error && (
          <div
            ref={contentRef}
            style={{
              padding: `20px ${settings.margins}px`,
              fontFamily: settings.fontFamily,
              fontSize: `${settings.fontSize}px`,
              lineHeight: settings.lineSpacing,
              textAlign: settings.textAlign,
              direction: settings.rightToLeft ? 'rtl' : 'ltr',
              // Multi-column paginated reading mode
              ...(settings.viewMode === 'paginated'
                ? {
                    height: '100%',
                    width: '100%',
                    columnWidth: settings.spread === 'double' ? '45vw' : '85vw',
                    columnGap: `${settings.margins * 1.5}px`,
                    columnFill: 'auto',
                    overflowX: 'hidden',
                    overflowY: 'hidden',
                  }
                : {
                    height: '100%',
                    width: '100%',
                    maxWidth: '850px',
                    margin: '0 auto',
                    overflowY: 'auto',
                  }),
            }}
            className="prose prose-neutral dark:prose-invert max-w-none transition-colors duration-200 select-text"
            dangerouslySetInnerHTML={{ __html: currentChapter?.html || '' }}
          />
        )}

      {/* ─── Floating Text Selection Menu ─── */}
      <HighlightMenu
        position={selectionMenuPos}
        selectedText={selectedText}
        onHighlight={(color) => {
          if (onHighlightCreated) onHighlightCreated(color, selectedText);
          setSelectionMenuPos(null);
        }}
        onAddNote={() => {
          if (onAddNoteRequested) onAddNoteRequested(selectedText);
          setSelectionMenuPos(null);
        }}
        onLookup={(word) => {
          if (onLookupRequested) onLookupRequested(word);
          setSelectionMenuPos(null);
        }}
        onSpeak={(text) => {
          if (onSpeakRequested) onSpeakRequested(text);
          setSelectionMenuPos(null);
        }}
        onClose={() => setSelectionMenuPos(null)}
      />
    </div>
  );
};
