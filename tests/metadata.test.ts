import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import JSZip from 'jszip';
import { extractMetadata } from '../src/main/metadata';

describe('metadata extraction', () => {
  let tempDir: string;
  let coversDir: string;
  let epubPath: string;
  let pdfPath: string;
  let txtPath: string;
  let htmlPath: string;

  beforeAll(async () => {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pageturn-meta-test-'));
    coversDir = path.join(tempDir, 'covers');

    // Create a mock EPUB with rich metadata
    const zip = new JSZip();
    zip.file('mimetype', 'application/epub+zip');
    zip.file(
      'META-INF/container.xml',
      '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>'
    );
    zip.file(
      'content.opf',
      `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="2.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>The Great Gatsby</dc:title>
    <dc:creator>F. Scott Fitzgerald</dc:creator>
    <dc:publisher>Scribner</dc:publisher>
    <dc:language>en</dc:language>
    <dc:description>A story of the fabulously wealthy Jay Gatsby.</dc:description>
  </metadata>
  <manifest>
    <item id="cover" href="cover.jpg" media-type="image/jpeg" />
  </manifest>
</package>`
    );
    // 1x1 dummy jpeg buffer
    const dummyJpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9]);
    zip.file('cover.jpg', dummyJpg);

    const epubBuf = await zip.generateAsync({ type: 'nodebuffer' });
    epubPath = path.join(tempDir, 'gatsby.epub');
    await fsp.writeFile(epubPath, epubBuf);

    // Mock PDF
    pdfPath = path.join(tempDir, 'sample.pdf');
    await fsp.writeFile(
      pdfPath,
      '%PDF-1.4\n1 0 obj\n<< /Title (Moby Dick) /Author (Herman Melville) >>\nendobj\ntrailer\n<<>>\n%%EOF'
    );

    // Mock TXT with Markdown title
    txtPath = path.join(tempDir, 'war-and-peace.txt');
    await fsp.writeFile(txtPath, '# War and Peace\n\nChapter 1\nWell, Prince, so Genoa and Lucca are now no more...');

    // Mock HTML
    htmlPath = path.join(tempDir, 'dracula.html');
    await fsp.writeFile(
      htmlPath,
      '<!DOCTYPE html><html><head><title>Dracula</title><meta name="author" content="Bram Stoker"></head><body><h1>Chapter 1</h1></body></html>'
    );
  });

  afterAll(async () => {
    try {
      await fsp.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('should extract title, author, and cover from EPUB', async () => {
    const meta = await extractMetadata(epubPath, 'epub', coversDir);
    expect(meta.title).toBe('The Great Gatsby');
    expect(meta.author).toBe('F. Scott Fitzgerald');
    expect(meta.publisher).toBe('Scribner');
    expect(meta.language).toBe('en');
    expect(meta.description).toContain('Jay Gatsby');
    expect(meta.coverPath).toBeDefined();
  });

  it('should extract title and author from PDF', async () => {
    const meta = await extractMetadata(pdfPath, 'pdf', coversDir);
    expect(meta.title).toBe('Moby Dick');
    expect(meta.author).toBe('Herman Melville');
  });

  it('should extract title from TXT header', async () => {
    const meta = await extractMetadata(txtPath, 'txt', coversDir);
    expect(meta.title).toBe('War and Peace');
  });

  it('should extract title and author from HTML tags', async () => {
    const meta = await extractMetadata(htmlPath, 'html', coversDir);
    expect(meta.title).toBe('Dracula');
    expect(meta.author).toBe('Bram Stoker');
  });
});

