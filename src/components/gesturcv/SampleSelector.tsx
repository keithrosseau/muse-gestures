'use client';

// SampleSelector: dropdown for picking the active sample.
//
// Native <select> + outline button — both square (no rounded corners),
// thin border, monochrome, matching the landing/play aesthetic.
//
// Samples are loaded from a static manifest at /samples/manifest.json.
// Active sample id persists in localStorage.

import { useEffect, useCallback, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useGesturCVStore } from '@/lib/gesturcv-store';

const LS_KEY = 'gesturcv.activeSampleId';
const MANIFEST_URL = '/samples/manifest.json';

interface ManifestEntry {
  id: string;
  name: string;
  filename: string;
  baseNote: number;
}

export function SampleSelector() {
  const samples = useGesturCVStore((s) => s.samples);
  const activeSample = useGesturCVStore((s) => s.activeSample);
  const setSamples = useGesturCVStore((s) => s.setSamples);
  const setActiveSample = useGesturCVStore((s) => s.setActiveSample);
  const setSampleLoading = useGesturCVStore((s) => s.setSampleLoading);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const list: ManifestEntry[] = Array.isArray(data?.harpSamples) ? data.harpSamples : [];
      const mapped = list.map((e) => ({
        id: e.id,
        name: e.name,
        filename: e.filename,
        baseNote: e.baseNote,
      }));
      setSamples(mapped);

      if (mapped.length > 0) {
        const savedId =
          typeof window !== 'undefined'
            ? window.localStorage.getItem(LS_KEY)
            : null;
        const found = savedId
          ? mapped.find((s) => s.id === savedId)
          : null;
        const next = found ?? mapped[0];
        if (next) {
          setActiveSample(next);
          if (next.id !== savedId) {
            try {
              window.localStorage.setItem(LS_KEY, next.id);
            } catch {
              // ignore quota errors
            }
          }
        }
      } else {
        setActiveSample(null);
      }
    } catch (err) {
      toast.error(`Failed to load samples manifest: ${(err as Error).message}`);
    }
  }, [setActiveSample, setSamples]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleChange = (id: string) => {
    const next = samples.find((s) => s.id === id);
    if (!next) return;
    setSampleLoading(true);
    try {
      try {
        window.localStorage.setItem(LS_KEY, id);
      } catch {
        // ignore
      }
      setActiveSample(next);
      toast.success(`Active sample: ${next.name}`);
    } finally {
      setSampleLoading(false);
      setOpen(false);
    }
  };

  // Custom dropdown — square, thin outline, monochrome
  return (
    <div className="flex items-stretch h-9" style={{ fontFamily: "'Montserrat', system-ui, sans-serif" }}>
      {/* Dropdown trigger */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          disabled={samples.length === 0}
          className="flex items-center justify-between gap-3 h-full px-3 border border-white/20 text-[11px] tracking-[0.2em] uppercase font-light text-white/80 hover:bg-white/5 hover:border-white/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed min-w-[160px]"
        >
          <span className="truncate">
            {activeSample ? activeSample.name : (samples.length === 0 ? 'No samples' : 'Select')}
          </span>
          <svg
            className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"
          >
            <path strokeLinecap="square" d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {/* Dropdown menu */}
        {open && (
          <>
            {/* Click-outside overlay */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            {/* Menu */}
            <div className="absolute top-full left-0 mt-px min-w-full bg-black border border-white/20 z-50 max-h-72 overflow-y-auto">
              {samples.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleChange(s.id)}
                  className={`block w-full text-left px-3 py-2.5 text-[11px] tracking-[0.15em] uppercase font-light border-b border-white/10 last:border-b-0 transition-colors ${
                    s.id === activeSample?.id
                      ? 'bg-white text-black'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="truncate block">{s.name}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Refresh button — square, thin outline, icon always visible */}
      <button
        onClick={() => void refresh()}
        title="Refresh sample list"
        className="flex items-center justify-center h-full w-9 border border-white/20 text-white/70 hover:bg-white/5 hover:border-white/40 hover:text-white transition-colors"
      >
        <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}
