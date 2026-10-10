'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { CameraView } from '@/components/gesturcv/CameraView';
import { SampleSelector } from '@/components/gesturcv/SampleSelector';
import { LandingPage } from '@/components/gesturcv/LandingPage';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft, Activity, Hand, Music, Power, Settings, Zap,
} from 'lucide-react';
import { useGesturCVStore } from '@/lib/gesturcv-store';
import { AudioEngine } from '@/lib/audio/AudioEngine';
import { toast } from 'sonner';

type View = 'landing' | 'play';

export default function Home() {
  const [view, setView] = useState<View>('landing');
  const audioEngineRef = useRef<AudioEngine | null>(null);
  const [swapHands, setSwapHands] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [starting, setStarting] = useState(false);

  const audioStarted = useGesturCVStore((s) => s.audioStarted);
  const setAudioStarted = useGesturCVStore((s) => s.setAudioStarted);
  const activeSample = useGesturCVStore((s) => s.activeSample);
  const fps = useGesturCVStore((s) => s.fps);
  const handsVisible = useGesturCVStore((s) => s.handsVisible);
  const harp = useGesturCVStore((s) => s.harp);
  const trackingReady = useGesturCVStore((s) => s.trackingReady);
  const trackingError = useGesturCVStore((s) => s.trackingError);
  const t = useGesturCVStore((s) => s.t);
  const language = useGesturCVStore((s) => s.language);
  const setLanguage = useGesturCVStore((s) => s.setLanguage);
  const showChannelPanel = useGesturCVStore((s) => s.showChannelPanel);
  const setShowChannelPanel = useGesturCVStore((s) => s.setShowChannelPanel);
  const sidebarOpen = useGesturCVStore((s) => s.sidebarOpen);
  const setSidebarOpen = useGesturCVStore((s) => s.setSidebarOpen);
  const gpuDelegate = useGesturCVStore((s) => s.gpuDelegate);
  const setGpuDelegate = useGesturCVStore((s) => s.setGpuDelegate);

  // Stop the audio engine and reset the audioStarted flag. Used both by the
  // "Stop audio" button and by the Back-to-landing button — guarantees the
  // engine doesn't keep playing in the background after the user leaves.
  const handleStopAudio = useCallback(() => {
    const engine = audioEngineRef.current;
    if (engine) {
      try { engine.stop(); } catch { /* ignore */ }
      audioEngineRef.current = null;
    }
    setAudioStarted(false);
    toast.success('Audio engine stopped');
  }, [setAudioStarted]);

  // When the active sample changes (and audio is already running), hot-swap it
  // into the engine without restarting anything else.
  useEffect(() => {
    const engine = audioEngineRef.current;
    if (!engine || !audioStarted || !activeSample) return;
    const url = `/samples/${activeSample.filename}`;
    engine.loadSample(url, activeSample.baseNote).catch((e) => {
      toast.error(`Failed to load sample: ${(e as Error).message}`);
    });
  }, [audioStarted, activeSample]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      audioEngineRef.current?.stop();
      audioEngineRef.current = null;
    };
  }, []);

  const handleStartAudio = async () => {
    setStarting(true);
    try {
      // Guard: if an engine already exists and is started, don't create
      // a new one — this prevents AudioContext leaks when the user
      // rapidly clicks Start/Stop/Start.
      if (audioEngineRef.current?.isStarted()) {
        setAudioStarted(true);
        return;
      }
      // Clean up any old engine that wasn't properly stopped.
      if (audioEngineRef.current) {
        try { audioEngineRef.current.stop(); } catch { /* ignore */ }
        audioEngineRef.current = null;
      }
      audioEngineRef.current = new AudioEngine();
      await audioEngineRef.current.start();
      setAudioStarted(true);
      toast.success('Audio engine started');

      const current = useGesturCVStore.getState().activeSample;
      if (current) {
        await audioEngineRef.current.loadSample(
          `/samples/${current.filename}`,
          current.baseNote
        );
      } else {
        try {
          const res = await fetch('/samples/manifest.json', { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data?.harpSamples) ? data.harpSamples : [];
            if (list.length > 0) {
              const first = list[0];
              useGesturCVStore.getState().setActiveSample(first);
              await audioEngineRef.current.loadSample(
                `/samples/${first.filename}`,
                first.baseNote
              );
            }
          }
        } catch {
          // ignore
        }
      }

      try {
        const res = await fetch('/samples/manifest.json', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data?.voxSample?.filename) {
            await audioEngineRef.current.loadVoxSample(
              `/samples/${data.voxSample.filename}`
            );
          }
        }
      } catch (err) {
        console.warn('Failed to load vox sample:', err);
      }
    } catch (err) {
      toast.error(`Audio start failed: ${(err as Error).message}`);
    } finally {
      setStarting(false);
    }
  };

  if (view === 'landing') {
    return <LandingPage onLaunch={() => setView('play')} />;
  }

  return (
    <main
      className="h-screen flex flex-col bg-black text-white relative overflow-hidden"
      style={{ fontFamily: "'Montserrat', system-ui, sans-serif" }}
    >
      {/* Top bar — minimal, matches landing aesthetic */}
      <header className="flex items-center gap-3 px-6 sm:px-10 py-5 border-b border-white/10 bg-black/80 backdrop-blur z-30">
        {/* Back to landing — also stops the audio engine so it doesn't keep
            playing in the background after the user leaves the play view.
            No settings gear here — the floating gear button on the camera
            view opens the sidebar, no need to duplicate it in the navbar. */}
        <button
          onClick={() => {
            handleStopAudio();
            setView('landing');
          }}
          className="group flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase font-light text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3 w-3 transition-transform group-hover:-translate-x-1" />
          <span className="hidden sm:inline">{t.back}</span>
        </button>

        <div className="flex items-center gap-3 ml-auto">
          {/* Status badges — minimal, no rounded, no borders except thin */}
          <div className="hidden sm:flex items-center gap-1 text-[11px] tracking-[0.2em] uppercase font-light text-white/50">
            <Activity className="h-3 w-3" />
            <span>{fps.toFixed(0)} FPS</span>
          </div>
          <div className="hidden sm:flex items-center gap-1 text-[11px] tracking-[0.2em] uppercase font-light text-white/50">
            <Hand className="h-3 w-3" />
            <span>{handsVisible.left ? 'L' : '·'} {handsVisible.right ? 'R' : '·'}</span>
          </div>
          {harp.gateOpen && harp.activeNoteName && (
            <div className="flex items-center gap-1 text-[11px] tracking-[0.2em] uppercase font-light text-white">
              <Music className="h-3 w-3" />
              <span>{harp.activeNoteName}</span>
            </div>
          )}

          <SampleSelector />

          {/* Language toggle */}
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              onClick={() => setLanguage('en')}
              className={`text-[11px] tracking-[0.25em] uppercase font-light transition-colors ${language === 'en' ? 'text-white' : 'text-white/30 hover:text-white/60'}`}
            >ENG</button>
            <span className="text-white/20 text-[11px]">/</span>
            <button
              onClick={() => setLanguage('ru')}
              className={`text-[11px] tracking-[0.25em] uppercase font-light transition-colors ${language === 'ru' ? 'text-white' : 'text-white/30 hover:text-white/60'}`}
            >RU</button>
          </div>

          {/* Start / Stop audio — square, no rounded, monochrome.
              When audio is OFF: shows "Start audio" and starts the engine.
              When audio is ON: shows "Stop audio" and stops the engine. */}
          {!audioStarted ? (
            <button
              onClick={handleStartAudio}
              disabled={starting}
              className="flex items-center gap-2 border border-white px-5 py-2.5 text-[11px] tracking-[0.25em] uppercase font-medium hover:bg-white hover:text-black transition-colors disabled:opacity-50"
            >
              <Power className="h-3 w-3" />
              <span>{starting ? t.starting : t.startAudio}</span>
            </button>
          ) : (
            <button
              onClick={handleStopAudio}
              className="flex items-center gap-2 border border-white px-5 py-2.5 text-[11px] tracking-[0.25em] uppercase font-medium bg-white text-black hover:bg-white/80 hover:text-black transition-colors"
            >
              <Power className="h-3 w-3" />
              <span>Stop audio</span>
            </button>
          )}
        </div>
      </header>

      {/* Main camera area — full width, sidebar floats over it on the left */}
      <div className="flex-1 relative bg-black min-h-0">
        <CameraView audioEngineRef={audioEngineRef} swapHands={swapHands} mirror={mirror} gpuDelegate={gpuDelegate} />

        {!audioStarted && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="bg-black/90 border border-white/20 px-8 py-6 text-center max-w-md pointer-events-auto">
              <div className="text-base font-semibold mb-2 text-white">{t.clickToBegin}</div>
              <div className="text-sm text-white/60 font-light">
                {t.browserGesture}
              </div>
            </div>
          </div>
        )}
        {trackingError && (
          <div className="absolute bottom-4 left-4 right-4 sm:right-auto sm:max-w-md bg-red-950/90 border border-red-700 p-3 text-sm text-red-200 z-10">
            {trackingError}
          </div>
        )}

        {/* Floating sidebar — left side, square corners, Montserrat */}
        {sidebarOpen && (
          <aside
            className="absolute top-4 left-4 bottom-4 w-80 max-w-[calc(100vw-2rem)] bg-black/90 backdrop-blur-md border border-white/15 overflow-y-auto z-20"
            style={{ fontFamily: "'Montserrat', system-ui, sans-serif" }}
          >
            {/* Sidebar header: just the centered "SETTINGS" title.
                The gear toggle button lives outside the sidebar (below) so
                it stays in the exact same screen position whether the
                sidebar is open or closed — only its rotation changes. */}
            <div className="flex items-center justify-center px-5 h-[50px] border-b border-white/10">
              <span className="text-[11px] tracking-[0.3em] uppercase font-light text-white/70">
                {t.settings}
              </span>
            </div>

            {/* Sections */}
            <div className="px-5 py-5 space-y-6">
              {/* Camera settings */}
              <section>
                <h3 className="text-[10px] tracking-[0.3em] uppercase font-light text-white/40 mb-3">
                  {t.settings}
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="mirror" className="text-xs font-light text-white/80">
                      {t.mirrorCamera}
                    </Label>
                    <Switch id="mirror" checked={mirror} onCheckedChange={setMirror} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="swap" className="text-xs font-light text-white/80">
                      {t.swapHands}
                    </Label>
                    <Switch id="swap" checked={swapHands} onCheckedChange={setSwapHands} />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="channels" className="text-xs font-light text-white/80">
                      Debug stats
                    </Label>
                    <Switch
                      id="channels"
                      checked={showChannelPanel}
                      onCheckedChange={setShowChannelPanel}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gpu" className="text-xs font-light text-white/80">
                      GPU delegate
                    </Label>
                    <Switch
                      id="gpu"
                      checked={gpuDelegate}
                      onCheckedChange={setGpuDelegate}
                    />
                  </div>
                </div>
                {/* Note: changing GPU/CPU or Swap hands re-creates the
                    HandTracker live — no manual restart needed. */}
              </section>

              {/* Gestures */}
              <section>
                <h3 className="text-[10px] tracking-[0.3em] uppercase font-light text-white/40 mb-3">
                  {t.gestures}
                </h3>
                <ul className="space-y-2 text-xs font-light text-white/70 leading-relaxed">
                  <li>{t.lOpenness}</li>
                  <li>{t.lRoll}</li>
                  <li>{t.lScale}</li>
                  <li>{t.rIndex}</li>
                  <li>{t.rOpenness}</li>
                  <li>{t.rPinch}</li>
                </ul>
              </section>

              {/* Active sample info is intentionally omitted — the active
                  sample is already shown in the top navbar via SampleSelector.
                  No need to duplicate it here. */}

              {/* Status */}
              <section>
                <h3 className="text-[10px] tracking-[0.3em] uppercase font-light text-white/40 mb-3">
                  {t.status}
                </h3>
                <ul className="text-xs font-light text-white/60 space-y-1.5">
                  <li className="flex justify-between">
                    <span>{t.trackingReady}</span>
                    <span className={trackingReady ? 'text-emerald-400' : 'text-white/40'}>
                      {trackingReady ? t.yes : t.no}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>{t.audioStartedLabel}</span>
                    <span className={audioStarted ? 'text-emerald-400' : 'text-white/40'}>
                      {audioStarted ? t.yes : t.no}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>{t.handsVisible}</span>
                    <span className="text-white/80">
                      {handsVisible.left ? 'L' : '·'} {handsVisible.right ? 'R' : '·'}
                    </span>
                  </li>
                  <li className="flex justify-between">
                    <span>{t.harpGate}</span>
                    <span className={harp.gateOpen ? 'text-amber-400' : 'text-white/40'}>
                      {harp.gateOpen ? t.open : t.closed}
                    </span>
                  </li>
                </ul>
              </section>
            </div>
          </aside>
        )}

        {/* Single gear toggle settings button — always in the exact same screen
            position (top-4 left-4). Slightly larger than before (w-11 h-11
            = 50x) so the gear has more breathing room. Border matches the
            sidebar border exactly (border-white/15) so the two outlines
            visually belong together. Rotation: rotate-0 when closed,
            rotate-90 when open — smooth 300ms ease-out interpolation. */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className={`absolute top-4 left-4 bg-black/90 backdrop-blur-md w-[50px] h-[50px] flex items-center justify-center text-white/70 hover:text-white hover:bg-black transition-colors z-30 ${
            sidebarOpen
              ? 'border-t border-l border-white/15'
              : 'border border-white/15 hover:border-white/30'
          }`}
          aria-label={sidebarOpen ? 'Close settings panel' : 'Open settings panel'}
        >
          <Settings
            className={`h-4 w-4 transition-transform duration-300 ease-out ${sidebarOpen ? 'rotate-90' : 'rotate-0'}`}
          />
        </button>
      </div>
    </main>
  );
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function midiName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}
