import React from 'react';
import {
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Columns,
  Square,
  Scroll,
  BookOpen,
} from 'lucide-react';
import { useReaderStore } from '../../stores/reader-store';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Switch } from '../ui/switch';
import type { ThemeName } from '../../../shared/types';

export const SettingsPanel: React.FC = () => {
  const { settings, updateSettings, toggleSettings } = useReaderStore();

  const fontFamilies = [
    { label: 'Georgia (Serif)', value: 'Georgia, serif' },
    { label: 'Palatino (Serif)', value: 'Palatino, "Palatino Linotype", serif' },
    { label: 'Times New Roman', value: '"Times New Roman", serif' },
    { label: 'Inter (Sans-serif)', value: 'Inter, system-ui, sans-serif' },
    { label: 'Helvetica / Arial', value: 'Helvetica, Arial, sans-serif' },
    { label: 'Consolas (Monospace)', value: 'Consolas, monospace' },
  ];

  const themes: { id: ThemeName; label: string; bg: string; fg: string }[] = [
    { id: 'light', label: 'Light', bg: '#ffffff', fg: '#111827' },
    { id: 'sepia', label: 'Sepia', bg: '#fbf0d9', fg: '#3b2f2f' },
    { id: 'dark', label: 'Dark', bg: '#0f172a', fg: '#f8fafc' },
    { id: 'night', label: 'OLED', bg: '#000000', fg: '#e2e8f0' },
  ];

  return (
    <aside className="w-80 border-l border-border bg-card/95 backdrop-blur flex flex-col h-full z-20 shrink-0 select-none animate-in slide-in-from-right-4 duration-200">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-sm font-semibold">Reading Settings</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => toggleSettings(false)}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 text-xs">
        {/* Theme */}
        <div>
          <label className="font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Theme
          </label>
          <div className="grid grid-cols-4 gap-1.5">
            {themes.map((t) => (
              <button
                key={t.id}
                onClick={() => updateSettings({ theme: t.id })}
                style={{ backgroundColor: t.bg, color: t.fg }}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border text-xs font-medium transition-all ${
                  settings.theme === t.id
                    ? 'ring-2 ring-primary border-primary shadow'
                    : 'border-border opacity-85 hover:opacity-100'
                }`}
              >
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
            <span className="text-muted-foreground">Auto-match system theme</span>
            <Switch
              checked={settings.autoTheme}
              onCheckedChange={(checked) => updateSettings({ autoTheme: checked })}
            />
          </div>
        </div>

        {/* View Mode (Paginated vs Scroll) */}
        <div>
          <label className="font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            View Mode
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => updateSettings({ viewMode: 'paginated' })}
              className={`flex items-center justify-center space-x-2 p-2.5 rounded-lg border transition-colors ${
                settings.viewMode === 'paginated'
                  ? 'bg-primary text-primary-foreground border-primary font-medium'
                  : 'bg-background hover:bg-muted text-foreground'
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span>Paginated</span>
            </button>
            <button
              onClick={() => updateSettings({ viewMode: 'scroll' })}
              className={`flex items-center justify-center space-x-2 p-2.5 rounded-lg border transition-colors ${
                settings.viewMode === 'scroll'
                  ? 'bg-primary text-primary-foreground border-primary font-medium'
                  : 'bg-background hover:bg-muted text-foreground'
              }`}
            >
              <Scroll className="h-4 w-4" />
              <span>Continuous</span>
            </button>
          </div>
        </div>

        {/* Spread Mode */}
        <div>
          <label className="font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Page Layout
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'single', label: 'Single', icon: Square },
              { id: 'double', label: 'Two Pages', icon: Columns },
              { id: 'auto', label: 'Auto Spread', icon: BookOpen },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => updateSettings({ spread: id as any })}
                className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-colors ${
                  settings.spread === id
                    ? 'bg-primary text-primary-foreground border-primary font-medium'
                    : 'bg-background hover:bg-muted text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 mb-1" />
                <span className="text-[10px]">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Font Family */}
        <div>
          <label className="font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Font Family
          </label>
          <div className="space-y-1">
            {fontFamilies.map((f) => (
              <button
                key={f.value}
                onClick={() => updateSettings({ fontFamily: f.value })}
                style={{ fontFamily: f.value }}
                className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${
                  settings.fontFamily === f.value
                    ? 'bg-secondary font-semibold text-foreground'
                    : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Font Size */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="font-semibold text-muted-foreground uppercase tracking-wider">
              Font Size
            </label>
            <span className="font-mono text-muted-foreground">{settings.fontSize}px</span>
          </div>
          <Slider
            value={[settings.fontSize]}
            min={12}
            max={36}
            step={1}
            onValueChange={([val]) => updateSettings({ fontSize: val })}
          />
        </div>

        {/* Line Spacing */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="font-semibold text-muted-foreground uppercase tracking-wider">
              Line Spacing
            </label>
            <span className="font-mono text-muted-foreground">{settings.lineSpacing.toFixed(1)}</span>
          </div>
          <Slider
            value={[settings.lineSpacing * 10]}
            min={10}
            max={25}
            step={1}
            onValueChange={([val]) => updateSettings({ lineSpacing: val / 10 })}
          />
        </div>

        {/* Margins */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="font-semibold text-muted-foreground uppercase tracking-wider">
              Margins
            </label>
            <span className="font-mono text-muted-foreground">{settings.margins}px</span>
          </div>
          <Slider
            value={[settings.margins]}
            min={10}
            max={100}
            step={5}
            onValueChange={([val]) => updateSettings({ margins: val })}
          />
        </div>

        {/* Text Alignment */}
        <div>
          <label className="font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Text Alignment
          </label>
          <div className="grid grid-cols-4 gap-1">
            {[
              { id: 'left', icon: AlignLeft },
              { id: 'center', icon: AlignCenter },
              { id: 'right', icon: AlignRight },
              { id: 'justify', icon: AlignJustify },
            ].map(({ id, icon: Icon }) => (
              <button
                key={id}
                onClick={() => updateSettings({ textAlign: id as any })}
                className={`flex items-center justify-center p-2 rounded-md border transition-colors ${
                  settings.textAlign === id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        {/* Right-to-Left (Manga) */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div>
            <span className="font-medium block">Right-to-Left</span>
            <span className="text-[10px] text-muted-foreground">For Manga & RTL languages</span>
          </div>
          <Switch
            checked={settings.rightToLeft}
            onCheckedChange={(checked) => updateSettings({ rightToLeft: checked })}
          />
        </div>
      </div>
    </aside>
  );
};

