import { app, BrowserWindow, Menu, MenuItemConstructorOptions } from 'electron';
import path from 'path';
import { initDatabase, getSettings, setSettings, closeDatabase, getBooks } from './database';
import { registerIpcHandlers } from './ipc';
import { seedSampleBooks } from './sample-books';

let mainWindow: BrowserWindow | null = null;
let pendingFilePath: string | null = null;

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();

      // Look for a book file in command line arguments
      const fileArg = findFileArg(argv);
      if (fileArg) {
        mainWindow.webContents.send('open-file', fileArg);
      }
    }
  });
}

import fs from 'fs';
import { SUPPORTED_EXTENSIONS } from '../shared/constants';

function findFileArg(args: string[]): string | null {
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg && !arg.startsWith('--') && !arg.startsWith('-')) {
      try {
        const fullPath = path.resolve(arg);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          const ext = path.extname(fullPath).toLowerCase();
          if (SUPPORTED_EXTENSIONS.includes(ext) || fullPath.toLowerCase().endsWith('.fb2.zip')) {
            return fullPath;
          }
        }
      } catch {
        // ignore
      }
    }
  }
  return null;
}

function createWindow(): void {
  initDatabase();

  // If library is completely empty, populate with classic starter books
  try {
    const existing = getBooks();
    if (existing.length === 0) {
      seedSampleBooks().catch((err) => console.warn('Failed to seed sample books:', err));
    }
  } catch (err) {
    console.warn('Error checking sample books:', err);
  }

  const settings = getSettings();
  const bounds = settings.windowBounds;

  // Preload script resolution
  const preloadPath = path.join(__dirname, '../preload/index.mjs');
  const fallbackPreload = path.join(__dirname, '../preload/preload.js');
  const actualPreload = require('fs').existsSync(preloadPath) ? preloadPath : fallbackPreload;

  mainWindow = new BrowserWindow({
    x: bounds?.x,
    y: bounds?.y,
    width: bounds?.width || 1200,
    height: bounds?.height || 800,
    minWidth: 800,
    minHeight: 600,
    title: 'PageTurn',
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: actualPreload,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
    },
  });

  registerIpcHandlers(() => mainWindow);

  // Debounced window bounds persistence
  let resizeTimeout: NodeJS.Timeout | null = null;
  const saveBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isFullScreen()) return;
    if (resizeTimeout) clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const b = mainWindow.getBounds();
      setSettings({ windowBounds: b });
    }, 500);
  };

  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);

  // Native Menu
  buildAppMenu();

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    if (pendingFilePath) {
      mainWindow?.webContents.send('open-file', pendingFilePath);
      pendingFilePath = null;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }
}

function buildAppMenu(): void {
  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ role: 'appMenu' as const }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Book...',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow?.webContents.send('menu:open-file');
          },
        },
        {
          label: 'Scan Folder...',
          click: () => {
            mainWindow?.webContents.send('menu:scan-folder');
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About PageTurn',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow!, {
              type: 'info',
              title: 'About PageTurn',
              message: 'PageTurn v1.0.0',
              detail: 'A cross-platform e-book reader supporting EPUB, PDF, Kindle formats, Comics, and more.',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// macOS open-file event
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow && mainWindow.webContents) {
    mainWindow.webContents.send('open-file', filePath);
  } else {
    pendingFilePath = filePath;
  }
});

// App lifecycle
app.whenReady().then(() => {
  // Check CLI arguments for files passed on start
  const initialFile = findFileArg(process.argv);
  if (initialFile) {
    pendingFilePath = initialFile;
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
