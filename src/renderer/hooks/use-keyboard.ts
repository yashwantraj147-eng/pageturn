import { useEffect } from 'react';

export type KeyCombo = string;

interface ShortcutMap {
  [key: string]: () => void;
}

export function useKeyboard(shortcuts: ShortcutMap, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if focus is in an input or textarea
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        if (e.key === 'Escape') {
          target.blur();
        }
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;
      const key = e.key;

      for (const [shortcut, handler] of Object.entries(shortcuts)) {
        const parts = shortcut.toLowerCase().split('+').map((s) => s.trim());
        const hasCtrl = parts.includes('ctrl') || parts.includes('cmd');
        const hasShift = parts.includes('shift');
        const hasAlt = parts.includes('alt');
        const mainKey = parts.find(
          (p) => !['ctrl', 'cmd', 'shift', 'alt'].includes(p)
        );

        if (
          hasCtrl === ctrl &&
          hasShift === shift &&
          hasAlt === alt &&
          mainKey &&
          (mainKey === key.toLowerCase() ||
            (mainKey === '=' && (key === '=' || key === '+')) ||
            (mainKey === '-' && (key === '-' || key === '_')) ||
            (mainKey === 'space' && key === ' '))
        ) {
          e.preventDefault();
          handler();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
}

