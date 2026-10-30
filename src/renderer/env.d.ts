/// <reference types="vite/client" />
import type { IpcChannels } from '../shared/types';

declare global {
  interface Window {
    api: {
      invoke<K extends keyof IpcChannels>(
        channel: K,
        ...args: IpcChannels[K]['args']
      ): Promise<IpcChannels[K]['result']>;
      on(channel: string, callback: (...args: any[]) => void): void;
      off(channel: string, callback: (...args: any[]) => void): void;
      onOpenFile(callback: (filePath: string) => void): void;
    };
  }
}

export {};

