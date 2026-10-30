import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { IpcChannels } from '../shared/types';

const listeners = new Map<Function, (event: IpcRendererEvent, ...args: any[]) => void>();

contextBridge.exposeInMainWorld('api', {
  invoke<K extends keyof IpcChannels>(
    channel: K,
    ...args: IpcChannels[K]['args']
  ): Promise<IpcChannels[K]['result']> {
    return ipcRenderer.invoke(channel, ...args);
  },

  on(channel: string, callback: (...args: any[]) => void): void {
    const wrapped = (_event: IpcRendererEvent, ...args: any[]) => callback(...args);
    listeners.set(callback, wrapped);
    ipcRenderer.on(channel, wrapped);
  },

  off(channel: string, callback: (...args: any[]) => void): void {
    const wrapped = listeners.get(callback);
    if (wrapped) {
      ipcRenderer.removeListener(channel, wrapped);
      listeners.delete(callback);
    } else {
      ipcRenderer.removeListener(channel, callback);
    }
  },

  onOpenFile(callback: (filePath: string) => void): void {
    const wrapped = (_event: IpcRendererEvent, filePath: string) => callback(filePath);
    ipcRenderer.on('open-file', wrapped);
  },
});

