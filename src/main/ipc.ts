import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import fsp from 'fs/promises';
import path from 'path';
import JSZip from 'jszip';
import * as db from './database';
import { importFile, scanFolder, getCoversDir } from './file-import';
import { detectFormat } from './format-detect';
import { extractMetadata } from './metadata';
import { seedSampleBooks } from './sample-books';
import { DIALOG_FILTERS, DB_FILENAME } from '../shared/constants';

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  // Sample books seeder
  ipcMain.handle('sample:load-defaults', async () => {
    return await seedSampleBooks();
  });
  // File operations
  ipcMain.handle('file:open-dialog', async () => {
    const win = getMainWindow();
    const res = await dialog.showOpenDialog(win!, {
      title: 'Import E-Books',
      properties: ['openFile', 'multiSelections'],
      filters: DIALOG_FILTERS,
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0];
  });

  ipcMain.handle('file:open-path', async (_, filePath: string) => {
    return await fsp.readFile(filePath);
  });

  ipcMain.handle('file:read', async (_, filePath: string) => {
    const buf = await fsp.readFile(filePath);
    return new Uint8Array(buf);
  });

  ipcMain.handle('file:scan-folder', async (_, folderPath?: string) => {
    let target = folderPath;
    if (!target) {
      const win = getMainWindow();
      const res = await dialog.showOpenDialog(win!, {
        title: 'Scan Folder for Books',
        properties: ['openDirectory'],
      });
      if (res.canceled || res.filePaths.length === 0) return [];
      target = res.filePaths[0];
    }
    return await scanFolder(target);
  });

  ipcMain.handle('file:detect-format', async (_, filePath: string) => {
    return await detectFormat(filePath);
  });

  ipcMain.handle('file:extract-cover', async (_, filePath: string, destDir?: string) => {
    const detection = await detectFormat(filePath);
    if (!detection) return null;
    const targetDir = destDir || getCoversDir();
    const meta = await extractMetadata(filePath, detection.format, targetDir);
    return meta.coverPath || null;
  });

  // DB - Books
  ipcMain.handle('db:get-books', async () => {
    return db.getBooks();
  });

  ipcMain.handle('db:get-book', async (_, id: string) => {
    return db.getBook(id);
  });

  ipcMain.handle('db:add-book', async (_, data) => {
    return db.addBook(data);
  });

  ipcMain.handle('db:update-book', async (_, id: string, updates) => {
    db.updateBook(id, updates);
  });

  ipcMain.handle('db:delete-book', async (_, id: string) => {
    db.deleteBook(id);
  });

  ipcMain.handle('db:import-file', async (_, filePath: string) => {
    return await importFile(filePath);
  });

  // DB - Collections
  ipcMain.handle('db:get-collections', async () => {
    return db.getCollections();
  });

  ipcMain.handle('db:add-collection', async (_, name: string, color?: string) => {
    return db.addCollection(name, color);
  });

  ipcMain.handle('db:delete-collection', async (_, id: string) => {
    db.deleteCollection(id);
  });

  ipcMain.handle('db:update-collection', async (_, id: string, updates) => {
    db.updateCollection(id, updates);
  });

  // DB - Annotations
  ipcMain.handle('db:get-annotations', async (_, bookId: string) => {
    return db.getAnnotations(bookId);
  });

  ipcMain.handle('db:add-annotation', async (_, data) => {
    return db.addAnnotation(data);
  });

  ipcMain.handle('db:update-annotation', async (_, id: string, updates) => {
    db.updateAnnotation(id, updates);
  });

  ipcMain.handle('db:delete-annotation', async (_, id: string) => {
    db.deleteAnnotation(id);
  });

  ipcMain.handle('db:export-annotations', async (_, bookId: string, format: 'markdown' | 'json') => {
    return db.exportAnnotations(bookId, format);
  });

  // DB - Reading stats
  ipcMain.handle('db:add-reading-session', async (_, data) => {
    db.addReadingSession(data);
  });

  ipcMain.handle('db:get-reading-sessions', async (_, bookId: string) => {
    return db.getReadingSessions(bookId);
  });

  ipcMain.handle('db:get-stats', async () => {
    return db.getStats();
  });

  // Settings
  ipcMain.handle('settings:get', async () => {
    return db.getSettings();
  });

  ipcMain.handle('settings:set', async (_, updates) => {
    db.setSettings(updates);
  });

  // Backup & Restore
  ipcMain.handle('backup:export', async (_, destinationPath?: string) => {
    let dest = destinationPath;
    if (!dest) {
      const win = getMainWindow();
      const res = await dialog.showSaveDialog(win!, {
        title: 'Export PageTurn Backup',
        defaultPath: `pageturn-backup-${new Date().toISOString().slice(0, 10)}.zip`,
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
      });
      if (res.canceled || !res.filePath) return;
      dest = res.filePath;
    }

    const zip = new JSZip();
    const dbPath = path.join(app.getPath('userData'), DB_FILENAME);
    try {
      const dbBuf = await fsp.readFile(dbPath);
      zip.file(DB_FILENAME, dbBuf);
    } catch (e) {
      console.warn('Could not read db file for backup:', e);
    }

    const coversDir = getCoversDir();
    try {
      const covers = await fsp.readdir(coversDir);
      const coversFolder = zip.folder('covers');
      for (const file of covers) {
        const coverBuf = await fsp.readFile(path.join(coversDir, file));
        coversFolder?.file(file, coverBuf);
      }
    } catch {
      // covers dir may not exist yet
    }

    const content = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    await fsp.writeFile(dest, content);
  });

  ipcMain.handle('backup:import', async (_, sourcePath?: string) => {
    let src = sourcePath;
    if (!src) {
      const win = getMainWindow();
      const res = await dialog.showOpenDialog(win!, {
        title: 'Import PageTurn Backup',
        filters: [{ name: 'Zip Archive', extensions: ['zip'] }],
        properties: ['openFile'],
      });
      if (res.canceled || res.filePaths.length === 0) return;
      src = res.filePaths[0];
    }

    const zipBuf = await fsp.readFile(src);
    const zip = await JSZip.loadAsync(zipBuf);

    // Restore DB
    const dbFile = zip.file(DB_FILENAME);
    if (dbFile) {
      const dbPath = path.join(app.getPath('userData'), DB_FILENAME);
      const data = await dbFile.async('nodebuffer');
      await fsp.writeFile(dbPath, data);
    }

    // Restore covers
    const coversDir = getCoversDir();
    await fsp.mkdir(coversDir, { recursive: true });
    for (const [filename, file] of Object.entries(zip.files)) {
      if (!file.dir && filename.startsWith('covers/')) {
        const name = path.basename(filename);
        const data = await file.async('nodebuffer');
        await fsp.writeFile(path.join(coversDir, name), data);
      }
    }
  });

  // App
  ipcMain.handle('app:get-version', () => app.getVersion());

  ipcMain.handle('app:toggle-fullscreen', () => {
    const win = getMainWindow();
    if (win) {
      win.setFullScreen(!win.isFullScreen());
    }
  });

  ipcMain.handle('app:get-path', (_, name: 'userData' | 'temp' | 'downloads') => {
    return app.getPath(name);
  });
}

