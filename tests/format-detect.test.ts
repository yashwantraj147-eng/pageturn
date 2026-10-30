import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fsp from 'fs/promises';
import path from 'path';
import os from 'os';
import JSZip from 'jszip';
import { detectFormat } from '../src/main/format-detect';

describe('format-detect', () => {
  let tempDir: string;
  let epubPath: string;
  let epubDrmPath: string;
  let pdfPath: string;
  let mobiPath: string;
  let txtPath: string;
  let htmlPath: string;
  let binPath: string;

  beforeAll(async () => {
    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pageturn-detect-test-'));

    // 1. Valid EPUB
    const epubZip = new JSZip();
    epubZip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    epubZip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>');
    epubZip.file('OEBPS/content.opf', '<package><metadata><dc:title>Test Book</dc:title></metadata></package>');
    const epubBuf = await epubZip.generateAsync({ type: 'nodebuffer' });
    epubPath = path.join(tempDir, 'test.epub');
    await fsp.writeFile(epubPath, epubBuf);

    // 2. EPUB with DRM
    const drmZip = new JSZip();
    drmZip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
    drmZip.file('META-INF/container.xml', '<container><rootfiles><rootfile full-path="OEBPS/content.opf"/></rootfiles></container>');
    drmZip.file(
      'META-INF/encryption.xml',
      '<encryption xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><EncryptedData><EncryptionMethod Algorithm="http://www.w3.org/2001/04/xmlenc#aes128-cbc"/></EncryptedData></encryption>'
    );
    const drmBuf = await drmZip.generateAsync({ type: 'nodebuffer' });
    epubDrmPath = path.join(tempDir, 'drm.epub');
    await fsp.writeFile(epubDrmPath, drmBuf);

    // 3. PDF
    pdfPath = path.join(tempDir, 'test.pdf');
    await fsp.writeFile(pdfPath, '%PDF-1.4\n1 0 obj\n<< /Title (Test PDF) >>\nendobj\ntrailer\n<<>>\n%%EOF');

    // 4. MOBI
    mobiPath = path.join(tempDir, 'test.mobi');
    const mobiBuf = Buffer.alloc(128);
    mobiBuf.write('BOOKMOBI', 60, 'ascii');
    await fsp.writeFile(mobiPath, mobiBuf);

    // 5. TXT
    txtPath = path.join(tempDir, 'test.txt');
    await fsp.writeFile(txtPath, 'This is a simple plain text book.\nChapter 1\nOnce upon a time.');

    // 6. HTML
    htmlPath = path.join(tempDir, 'test.html');
    await fsp.writeFile(htmlPath, '<!DOCTYPE html><html><head><title>Test</title></head><body>Hello</body></html>');

    // 7. Unknown random binary
    binPath = path.join(tempDir, 'random.bin');
    const binBuf = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x00, 0xaa]);
    await fsp.writeFile(binPath, binBuf);
  });

  afterAll(async () => {
    try {
      await fsp.rm(tempDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('should detect EPUB format', async () => {
    const res = await detectFormat(epubPath);
    expect(res).not.toBeNull();
    expect(res?.format).toBe('epub');
    expect(res?.drm).toBe(false);
  });

  it('should detect DRM in encrypted EPUB', async () => {
    const res = await detectFormat(epubDrmPath);
    expect(res).not.toBeNull();
    expect(res?.format).toBe('epub');
    expect(res?.drm).toBe(true);
  });

  it('should detect PDF format', async () => {
    const res = await detectFormat(pdfPath);
    expect(res).not.toBeNull();
    expect(res?.format).toBe('pdf');
  });

  it('should detect MOBI format', async () => {
    const res = await detectFormat(mobiPath);
    expect(res).not.toBeNull();
    expect(res?.format).toBe('mobi');
  });

  it('should detect plain text format', async () => {
    const res = await detectFormat(txtPath);
    expect(res).not.toBeNull();
    expect(res?.format).toBe('txt');
  });

  it('should detect HTML format', async () => {
    const res = await detectFormat(htmlPath);
    expect(res).not.toBeNull();
    expect(res?.format).toBe('html');
  });

  it('should return null for unknown binary file', async () => {
    const res = await detectFormat(binPath);
    expect(res).toBeNull();
  });
});

