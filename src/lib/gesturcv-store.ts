'use client';

// Global UI state for the Gestures → VCV web app.
//
// The hand-tracking loop and audio engine live in refs on the page component;
// this store only holds the *visible* state that needs to trigger re-renders
// (channel bars, active cell, FPS, sample list, audio-running flag).

import { create } from 'zustand';
import { translations, type Language, type Translation } from './i18n';

export interface ChannelState {
  values: number[]; // length 16, 0..1
}

export interface HarpState {
  activeCol: number | null;
  activeRow: number | null;
  activeMidi: number | null;
  activeNoteName: string | null;
  gateOpen: boolean;
}

export interface SampleMeta {
  id: string;
  name: string;
  filename: string;
  baseNote: number;
  // Optional fields — only present for samples uploaded via the admin API.
  active?: boolean;
  createdAt?: string;
}

interface GesturCVStore {
  // Channels / harp
  channels: number[];
  harp: HarpState;
  fps: number;

  // Audio
  audioStarted: boolean;
  audioReady: boolean;        // engine started + sample loaded
  sampleLoading: boolean;
  activeSample: SampleMeta | null;
  samples: SampleMeta[];

  // Tracking
  trackingReady: boolean;
  trackingError: string | null;
  handsVisible: { left: boolean; right: boolean };

  // Language
  language: Language;
  t: Translation;
  setLanguage: (l: Language) => void;
  loadSavedLanguage: () => void;

  // UI preferences
  showChannelPanel: boolean;
  setShowChannelPanel: (b: boolean) => void;
  sidebarOpen: boolean;
  setSidebarOpen: (b: boolean) => void;
  // Tracking delegate: true = GPU (default, faster), false = CPU (more compatible).
  // Changing this triggers a HandTracker re-create in CameraView.
  gpuDelegate: boolean;
  setGpuDelegate: (b: boolean) => void;

  // Actions
  setChannels: (v: number[]) => void;
  setHarp: (h: Partial<HarpState>) => void;
  setFps: (n: number) => void;
  setAudioStarted: (b: boolean) => void;
  setSampleLoading: (b: boolean) => void;
  setActiveSample: (s: SampleMeta | null) => void;
  setSamples: (s: SampleMeta[]) => void;
  setTrackingReady: (b: boolean) => void;
  setTrackingError: (e: string | null) => void;
  setHandsVisible: (h: { left: boolean; right: boolean }) => void;
  reset: () => void;
}

const initialHarp: HarpState = {
  activeCol: null,
  activeRow: null,
  activeMidi: null,
  activeNoteName: null,
  gateOpen: false,
};

// Always start with 'en' for SSR consistency. The actual saved language is
// loaded on the client after mount via the `loadSavedLanguage` action — this
// avoids React hydration mismatches (server would render 'en' while client
// might hydrate with 'ru' from localStorage, causing a hydration error).
const initialLanguage: Language = 'en';

export const useGesturCVStore = create<GesturCVStore>((set) => ({
  channels: new Array(16).fill(0),
  harp: initialHarp,
  fps: 0,
  audioStarted: false,
  audioReady: false,
  sampleLoading: false,
  activeSample: null,
  samples: [],
  trackingReady: false,
  trackingError: null,
  handsVisible: { left: false, right: false },
  language: initialLanguage,
  t: translations[initialLanguage],
  showChannelPanel: false,
  sidebarOpen: false,
  gpuDelegate: true,

  setChannels: (v) => set({ channels: v }),
  setHarp: (h) => set((s) => ({ harp: { ...s.harp, ...h } })),
  setFps: (n) => set({ fps: n }),
  setAudioStarted: (b) => set({ audioStarted: b }),
  setSampleLoading: (b) => set({ sampleLoading: b }),
  setActiveSample: (s) =>
    set((st) => ({
      activeSample: s,
      audioReady: st.audioStarted && s !== null,
    })),
  setSamples: (s) => set({ samples: s }),
  setTrackingReady: (b) => set({ trackingReady: b }),
  setTrackingError: (e) => set({ trackingError: e }),
  setHandsVisible: (h) => set({ handsVisible: h }),
  setLanguage: (l) => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('gesturcv.language', l);
      } catch {
        // ignore
      }
    }
    set({ language: l, t: translations[l] });
  },
  loadSavedLanguage: () => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem('gesturcv.language');
      if (saved === 'en' || saved === 'ru') {
        set({ language: saved, t: translations[saved] });
      }
    } catch {
      // ignore
    }
  },
  setShowChannelPanel: (b) => set({ showChannelPanel: b }),
  setSidebarOpen: (b) => set({ sidebarOpen: b }),
  setGpuDelegate: (b) => set({ gpuDelegate: b }),
  reset: () =>
    set({
      channels: new Array(16).fill(0),
      harp: initialHarp,
      handsVisible: { left: false, right: false },
    }),
}));
