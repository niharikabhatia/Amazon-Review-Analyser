import { X } from 'lucide-react';
import type { Health, Settings } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onChange: (s: Settings) => void;
  health: Health | null;
}

export function SettingsDrawer({ open, onClose, settings, onChange, health }: Props) {
  if (!open) return null;
  const models = health?.models ?? ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o', 'gpt-4o-mini'];
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/20 no-print" onClick={onClose}>
      <aside
        className="h-full w-full max-w-sm overflow-y-auto border-l border-rule bg-paper p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Settings"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-serif text-2xl font-semibold">Settings</h2>
          <button onClick={onClose} aria-label="Close settings" className="text-muted hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>

        <label className="block text-sm font-semibold">OpenAI API key</label>
        <input
          type="password"
          autoComplete="off"
          placeholder={health?.server_key ? 'Optional: the app has its own key' : 'sk-…'}
          value={settings.apiKey}
          onChange={(e) => onChange({ ...settings, apiKey: e.target.value })}
          className="mt-1.5 w-full rounded-md border border-rule bg-white px-3 py-2 text-sm outline-none focus:border-ink"
        />
        <p className="mt-1.5 text-xs text-muted">
          Only needed if the app's credits run out. Kept in this tab's memory, sent only with your
          requests, and never stored.
        </p>

        <label className="mt-6 block text-sm font-semibold">Model</label>
        <select
          value={settings.model}
          onChange={(e) => onChange({ ...settings, model: e.target.value })}
          className="mt-1.5 w-full rounded-md border border-rule bg-white px-3 py-2 text-sm outline-none focus:border-ink"
        >
          {models.map((m) => (
            <option key={m} value={m}>
              {m}
              {m === health?.default_model ? ' (default)' : ''}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-muted">Larger models catch subtler errors but are slower.</p>

        <label className="mt-6 block text-sm font-semibold">
          Max claims to check: <span className="font-serif">{settings.maxClaims}</span>
        </label>
        <input
          type="range"
          min={5}
          max={40}
          value={settings.maxClaims}
          onChange={(e) => onChange({ ...settings, maxClaims: Number(e.target.value) })}
          className="mt-2 w-full accent-pen"
        />
      </aside>
    </div>
  );
}
