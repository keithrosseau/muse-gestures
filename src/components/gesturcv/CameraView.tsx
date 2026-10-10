'use client';
// CameraView: the heart of the web app.
// - Holds the <video> element bound to getUserMedia().
// - Runs a requestAnimationFrame loop that:
//     1. Runs MediaPipe HandLandmarker on the latest video frame.
//     2. Computes 16 hand-feature channels (port of compute_hand_features).
//     3. Updates the LaserHarp state machine (port of LaserHarp).
//     4. Drives the AudioEngine (reverb wet / delay wet / pad filter / harp vol).
//     5. Triggers harp noteOn/noteOff.
//     6. Draws the camera image + hand skeletons + 5x5 grid onto a canvas overlay.
//
// The component is intentionally self-contained: page.tsx just mounts it and
// passes the AudioEngine ref + a few props.
import { useEffect, useRef, useState, useCallback } from 'react';
import { HandTracker } from '@/lib/handtracking/HandTracker';
import { computeHandFeatures, channelsFromHands, SignalSmoother, type HandsData } from '@/lib/handtracking/features';
import { LaserHarp } from '@/lib/handtracking/LaserHarp';
import {
  CHANNEL_NAMES,
  HAND_CONNECTIONS,
  HARP_GRID_COLS,
  HARP_GRID_ROWS,
  HARP_DEGREE_NAMES,
  harpGridRect,
  cellToMidi,
  midiToName,
  clamp,
} from '@/lib/handtracking/constants';
import { useGesturCVStore } from '@/lib/gesturcv-store';
import type { AudioEngine } from '@/lib/audio/AudioEngine';

interface CameraViewProps {
  audioEngineRef: React.MutableRefObject<AudioEngine | null>;
  swapHands: boolean;
  mirror: boolean;
  gpuDelegate: boolean;
}

export function CameraView({ audioEngineRef, swapHands, mirror, gpuDelegate }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackerRef = useRef<HandTracker | null>(null);
  const harpRef = useRef<LaserHarp>(new LaserHarp());
  const smootherRef = useRef<SignalSmoother>(new SignalSmoother(0.75));
  const rafRef = useRef<number | null>(null);
  const lastStampRef = useRef<number | null>(null);
  const fpsCounterRef = useRef<{ count: number; since: number }>({ count: 0, since: 0 });
  const prevGateRef = useRef<boolean>(false);
  const activeMidiRef = useRef<number | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const setChannels = useGesturCVStore((s) => s.setChannels);
  const setHarp = useGesturCVStore((s) => s.setHarp);
  const setFps = useGesturCVStore((s) => s.setFps);
  const setTrackingReady = useGesturCVStore((s) => s.setTrackingReady);
  const setTrackingError = useGesturCVStore((s) => s.setTrackingError);
  const setHandsVisible = useGesturCVStore((s) => s.setHandsVisible);
  const audioStarted = useGesturCVStore((s) => s.audioStarted);
  const activeSample = useGesturCVStore((s) => s.activeSample);

  // Keep latest props in refs so the rAF loop sees fresh values.
  const mirrorRef = useRef(mirror);
  const audioStartedRef = useRef(audioStarted);
  const activeSampleRef = useRef(activeSample);

  useEffect(() => { mirrorRef.current = mirror; }, [mirror]);
  useEffect(() => { audioStartedRef.current = audioStarted; }, [audioStarted]);
  useEffect(() => { activeSampleRef.current = activeSample; }, [activeSample]);

  // ---------- Camera init ----------
  const startCamera = useCallback(async () => {
    try {
      // Request the camera's NATIVE resolution — let the webcam give us
      // whatever it actually is (1920×1080 on a typical MacBook, 1280×720
      // on cheaper USB cams, etc). We only constrain facingMode + a
      // reasonable frame rate. This avoids the squashed/stretched look
      // that happens when you force a fixed resolution that doesn't
      // match the camera's native aspect ratio.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          frameRate: { ideal: 30 },
        },
        audio: false,
      });

      // NOTE: clear the previous error AFTER the first await.
      // If we cleared it synchronously at the top of startCamera, React 19's
      // react-hooks/set-state-in-effect rule would flag this function when it
      // is invoked directly from a useEffect (cascading render). Moving the
      // setState past an await breaks that synchronous link.
      setErrorMsg(null);

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      await video.play();

      setCameraReady(true);
      setTrackingReady(true);
    } catch (err) {
      const e = err as Error;
      console.error('Camera error:', e);
      setErrorMsg(e.message ?? 'Camera access denied');
      setTrackingError(e.message ?? 'Camera access denied');
    }
  }, [setTrackingReady, setTrackingError]);

  // ---------- Tracker init ----------
  // Re-create the HandTracker whenever swapHands or gpuDelegate changes.
  // This makes both toggles "live" — the user doesn't have to refresh the
  // page to apply them. The old tracker is closed cleanly before the new
  // one is created.
  useEffect(() => {
    const tracker = new HandTracker({ swapHands, gpu: gpuDelegate });
    trackerRef.current = tracker;

    tracker.waitUntilReady().catch((e) => {
      console.error('HandTracker init failed:', e);
      setTrackingError(`Hand tracker init failed: ${(e as Error).message}`);
    });

    return () => {
      tracker.close();
      trackerRef.current = null;
    };
  }, [swapHands, gpuDelegate, setTrackingError]);

  // Auto-start camera on mount
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void startCamera();
    return () => {
      const v = videoRef.current;
      if (v && v.srcObject) {
        const stream = v.srcObject as MediaStream;
        stream.getTracks().forEach((t) => t.stop());
      }
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [startCamera]);

  // ---------- Main tracking loop ----------
  useEffect(() => {
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      const tracker = trackerRef.current;

      if (!video || !canvas || !tracker || !container) {
        return;
      }

      // Guard: skip detection while the HandTracker is being re-created
      // (e.g. during GPU↔CPU delegate switch). This prevents crashes from
      // calling detectForVideo on a closed/not-yet-ready landmarker.
      if (!tracker.isReady()) return;
      if (video.readyState < 2 || video.videoWidth === 0) return;

      // Native video resolution (e.g. 1920×1080 on a MacBook).
      const videoW = video.videoWidth;
      const videoH = video.videoHeight;
      const aspect = videoW / videoH;

      // Container size (the displayed area on screen).
      const containerW = container.clientWidth;
      const containerH = container.clientHeight;

      // object-contain: the video is scaled to fit inside the container
      // while preserving its aspect ratio. Compute the actual displayed
      // video rectangle (offsetX, offsetY, dispW, dispH) so we can match
      // the canvas overlay to it exactly — hand coordinates drawn on the
      // canvas will line up with what the user sees.
      let dispW: number;
      let dispH: number;

      if (containerW / containerH > aspect) {
        // Container is wider than video → letterbox left/right.
        dispH = containerH;
        dispW = dispH * aspect;
      } else {
        // Container is taller than video → letterbox top/bottom.
        dispW = containerW;
        dispH = dispW / aspect;
      }

      const offsetX = (containerW - dispW) / 2;
      const offsetY = (containerH - dispH) / 2;

      // Set the canvas to the displayed video size and position it over
      // the video. This guarantees 1:1 pixel mapping between canvas
      // drawing coordinates and what the user sees — no squash, no offset.
      canvas.width = dispW;
      canvas.height = dispH;
      canvas.style.left = `${offsetX}px`;
      canvas.style.top = `${offsetY}px`;
      canvas.style.width = `${dispW}px`;
      canvas.style.height = `${dispH}px`;

      // From here on, all drawing uses dispW × dispH coordinate space.
      const width = dispW;
      const height = dispH;

      const timestampMs = performance.now();
      const stamp = timestampMs;
      const dt = lastStampRef.current !== null ? (stamp - lastStampRef.current) / 1000 : 1 / 30;
      lastStampRef.current = stamp;

      // Detect hands EVERY frame — no throttling. This matches the original
      // Python prototype behavior: the skeleton stays in lock-step with the
      // actual hand position. Throttling caused visible lag.
      const { hands: trackedHands } = tracker.detect(video, timestampMs);

      // Build Left/Right feature dicts
      const handsData: HandsData = {};
      const handLandmarksMap: { Left?: typeof trackedHands[number]['landmarks']; Right?: typeof trackedHands[number]['landmarks'] } = {};
      let harpTip: [number, number] | null = null;

      // Per user spec: laser harp is played by the RIGHT hand's index fingertip.
      const harpLabel = 'Right';

      // When the camera image is mirrored for display, the fingertip's
      // on-screen X is (1 - lm.x) * width. We must use the same transform
      // for hit-testing against the grid, otherwise the active cell drifts
      // opposite to where the user visually sees their finger.
      const mirrorNow = mirrorRef.current;
      const tipX = (lmX: number) => (mirrorNow ? (1 - lmX) * width : lmX * width);

      for (const h of trackedHands) {
        handsData[h.label] = computeHandFeatures(h.landmarks, aspect);
        handLandmarksMap[h.label] = h.landmarks;
        if (h.label === harpLabel) {
          harpTip = [tipX(h.landmarks[8].x), h.landmarks[8].y * height];
        }
      }

      const rawValues = channelsFromHands(handsData);
      const values = smootherRef.current.update(rawValues);

      // Update store channels (throttled to ~30 fps to avoid React thrash)
      if (fpsCounterRef.current.count % 2 === 0) {
        setChannels(values);
      }

      // Update audio params from gestures
      const engine = audioEngineRef.current;
      if (engine && audioStartedRef.current) {
        // LEFT hand → pad + reverb + vox
        engine.setPadPresence(values[0]);    // left_presence — gate pad on/off
        engine.setPadOpenness(values[6]);    // left_openness — pad filter cutoff
        engine.setReverbWet(values[3]);      // left_scale — reverb amount

        // Vox volume from left-hand roll.
        // roll=0 (hand vertical, fingers up) → gain=0 (silent)
        // roll=1 (hand rotated 90° to the right from user's perspective) → gain=1 (full)
        engine.setVoxGain(values[5]);        // left_roll — vox volume

        // RIGHT hand → harp delay
        engine.setDelayWet(values[14]);      // right_openness — delay/echo
        // right_pinch (values[12]) is reserved for the future tanpura gesture (#6, deferred).
      }

      // Laser harp
      const grid = harpGridRect(width, height);
      let harpXy: [number, number] | null = null;
      if (harpTip !== null) {
        const gcell = grid.side / HARP_GRID_COLS;
        const [fx, fy] = harpTip;
        if (fx >= grid.x0 && fx < grid.x0 + grid.side && fy >= grid.y0 && fy < grid.y0 + grid.side) {
          harpXy = [(fx - grid.x0) / gcell, (fy - grid.y0) / gcell];
        }
      }

      const harpRes = harpRef.current.update(harpXy, dt);

      // Gate transitions
      const gateOpen = harpRes.gateVolts > 0;
      if (gateOpen !== prevGateRef.current) {
        prevGateRef.current = gateOpen;
        if (!gateOpen && activeMidiRef.current !== null) {
          engine?.releaseHarpNote(activeMidiRef.current);
          activeMidiRef.current = null;
        }
      }

      // New note fired
      if (harpRes.velocity !== null && harpRes.midi !== null) {
        if (activeMidiRef.current !== null) {
          engine?.releaseHarpNote(activeMidiRef.current);
        }
        activeMidiRef.current = harpRes.midi;
        engine?.triggerHarpNote(harpRes.midi, harpRes.velocity);
      }

      // Update harp UI state (throttled)
      if (fpsCounterRef.current.count % 2 === 0) {
        const activeCol = harpRef.current.col;
        const activeRow = harpRef.current.row;
        const activeMidi = activeCol !== null && activeRow !== null ? cellToMidi(activeCol, activeRow) : null;
        setHarp({
          activeCol,
          activeRow,
          activeMidi,
          activeNoteName: activeMidi !== null ? midiToName(activeMidi) : null,
          gateOpen,
        });
        setHandsVisible({
          left: !!handsData.Left,
          right: !!handsData.Right,
        });
      }

      // FPS
      fpsCounterRef.current.count += 1;
      const now = performance.now();
      const elapsed = now - fpsCounterRef.current.since;
      if (elapsed >= 500) {
        const fps = (fpsCounterRef.current.count * 1000) / elapsed;
        setFps(fps);
        fpsCounterRef.current.count = 0;
        fpsCounterRef.current.since = now;
      }

      // ---------- Draw overlay (canvas is transparent — video is shown by <video>) ----------
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear the canvas (transparent) — video shows through from below.
      ctx.clearRect(0, 0, width, height);

      // Hand landmark screen coordinates.
      // The <video> is mirrored via CSS transform (scaleX(-1)) so the user
      // sees a mirror image. MediaPipe returns landmarks in the original
      // (non-mirrored) frame, so we mirror the X coordinate to match.
      const mirror = mirrorRef.current;
      const px = (x: number) => (mirror ? (1 - x) * width : x * width);
      const py = (y: number) => y * height;

      // Draw 5x5 harp grid (always visible)
      drawHarpGrid(ctx, harpRef.current.col, harpRef.current.row, grid.x0, grid.y0, grid.side);

      // Draw hand skeletons
      // Color convention: LEFT hand = green, RIGHT hand = blue.
      for (const h of trackedHands) {
        const color =
          h.label === 'Left'
            ? 'rgba(80, 220, 120, 0.95)'   // green
            : 'rgba(80, 180, 255, 0.95)';   // blue
        const dotColor =
          h.label === 'Left'
            ? 'rgba(120, 255, 160, 0.95)'
            : 'rgba(140, 200, 255, 0.95)';
        drawHand(ctx, h.landmarks, px, py, color, dotColor);
      }

      // Channel panel (top-right) — only shown when user enables it in settings.
      if (useGesturCVStore.getState().showChannelPanel) {
        drawChannelPanel(ctx, values, width);
      }

      // Note: no FPS / sample overlay on the canvas — the top navbar already
      // shows the active sample, and FPS is shown in the sidebar status panel.
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden">
      {/* Video element — VISIBLE, displays the camera feed at NATIVE resolution.
          object-contain preserves aspect ratio (no squash/stretch) and
          letterboxes the video inside the container.
          CSS transform mirrors it so the user sees themselves naturally. */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full"
        style={{
          objectFit: 'contain',
          transform: mirror ? 'scaleX(-1)' : 'none',
          visibility: 'visible',
        }}
      />
      {/* Canvas overlay — transparent, only draws hand skeletons + harp grid.
          Sized to MATCH the displayed video area (object-contain can leave
          letterbox bars), so hand coordinates line up with what the user sees. */}
      <canvas
        ref={canvasRef}
        className="absolute"
        style={{ left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />
      {!cameraReady && !errorMsg && (
        <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">
          Requesting camera access…
        </div>
      )}
      {errorMsg && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <div className="text-red-400 text-sm max-w-md">{errorMsg}</div>
          <button
            onClick={() => void startCamera()}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm border border-white/15"
          >
            Retry camera
          </button>
        </div>
      )}
    </div>
  );
}

// ---------- Drawing helpers ----------

function drawHarpGrid(
  ctx: CanvasRenderingContext2D,
  activeCol: number | null,
  activeRow: number | null,
  x0: number,
  y0: number,
  side: number,
) {
  const cell = side / HARP_GRID_COLS;

  // Active cell fill + border + note name
  if (activeCol !== null && activeRow !== null) {
    const cx0 = x0 + activeCol * cell;
    const cy0 = y0 + activeRow * cell;
    ctx.fillStyle = 'rgba(40, 30, 5, 0.6)';
    ctx.fillRect(cx0, cy0, cell, cell);

    // Soft gold border for the active cell.
    ctx.strokeStyle = 'rgba(255, 215, 130, 0.95)';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx0, cy0, cell, cell);

    const midi = cellToMidi(activeCol, activeRow);
    const name = midiToName(midi);
    ctx.fillStyle = 'rgba(255, 235, 200, 0.98)';
    ctx.font = `${Math.max(14, Math.floor(cell * 0.32))}px ui-monospace, Menlo, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, cx0 + cell / 2, cy0 + cell / 2);
  }

  // Grid lines — soft gold for high contrast against any background.
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.85)';
  ctx.lineWidth = 2;
  for (let i = 0; i <= HARP_GRID_COLS; i++) {
    const x = x0 + i * cell;
    ctx.beginPath();
    ctx.moveTo(x, y0);
    ctx.lineTo(x, y0 + side);
    ctx.stroke();
  }
  for (let j = 0; j <= HARP_GRID_ROWS; j++) {
    const y = y0 + j * cell;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + side, y);
    ctx.stroke();
  }

  // Column labels
  ctx.font = `${Math.max(12, Math.floor(cell * 0.22))}px ui-monospace, Menlo, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i < HARP_DEGREE_NAMES.length; i++) {
    const label = HARP_DEGREE_NAMES[i];
    const lx = x0 + i * cell + cell / 2;
    ctx.fillStyle = activeCol === i ? 'rgba(255, 215, 130, 0.98)' : 'rgba(180, 140, 40, 0.85)';
    ctx.fillText(label, lx, y0 + side + 8);
  }
}

function drawHand(
  ctx: CanvasRenderingContext2D,
  landmarks: { x: number; y: number; z: number }[],
  px: (x: number) => number,
  py: (y: number) => number,
  lineColor: string,
  dotColor: string,
) {
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  for (const [a, b] of HAND_CONNECTIONS) {
    const la = landmarks[a];
    const lb = landmarks[b];
    if (!la || !lb) continue;
    ctx.beginPath();
    ctx.moveTo(px(la.x), py(la.y));
    ctx.lineTo(px(lb.x), py(lb.y));
    ctx.stroke();
  }

  ctx.fillStyle = dotColor;
  for (const lm of landmarks) {
    ctx.beginPath();
    ctx.arc(px(lm.x), py(lm.y), 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawChannelPanel(ctx: CanvasRenderingContext2D, values: number[], width: number) {
  const panelW = 280;
  const panelH = 8 * 26 + 30;
  const x = width - panelW - 12;
  const y = 12;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(x, y, panelW, panelH);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  ctx.font = '11px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // Left hand (top half), Right hand (bottom half) — but to keep it compact,
  // we'll show 8 left channels on the left column, 8 right on the right column.
  const colW = (panelW - 24) / 2;
  for (let i = 0; i < 16; i++) {
    const col = i < 8 ? 0 : 1;
    const row = i % 8;
    const cx = x + 12 + col * colW;
    const cy = y + 24 + row * 26;

    const name = CHANNEL_NAMES[i].replace('left_', 'L_').replace('right_', 'R_');
    ctx.fillStyle = 'rgba(230, 230, 230, 0.95)';
    ctx.fillText(name.slice(0, 12), cx, cy);

    // bar
    const barX = cx;
    const barY = cy + 8;
    const barW = colW - 12;
    const barH = 6;
    ctx.fillStyle = 'rgba(45, 45, 45, 0.95)';
    ctx.fillRect(barX, barY, barW, barH);

    // Color convention: LEFT hand = green, RIGHT hand = blue.
    ctx.fillStyle = col === 0
      ? 'rgba(80, 220, 120, 0.95)'   // green for left channels
      : 'rgba(80, 180, 255, 0.95)';  // blue for right channels
    ctx.fillRect(barX, barY, barW * clamp(values[i]), barH);
  }
}
