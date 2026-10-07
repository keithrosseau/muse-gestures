'use client';

// HandTracker: thin wrapper around MediaPipe Tasks Vision HandLandmarker.
// Loads the .task model from /public/models/hand_landmarker.task and runs
// detectForVideo() on supplied <video> frames.
//
// False-positive mitigation (user-reported issue #2):
//   1. Confidence thresholds raised from 0.5 to 0.6 — MediaPipe is more
//      conservative about declaring a detection.
//   2. Handedness score filter — drops any detection whose handedness
//      confidence is below 0.6.
//   3. Temporal consistency filter — a hand must be detected in 2
//      consecutive frames (within a position tolerance) before it is
//      accepted. Single-frame false positives are filtered out. Once
//      accepted, the hand is kept for up to 3 missed frames before being
//      dropped, so brief detection gaps don't cause flicker.

import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { Landmark, HandednessLabel } from './constants';

export interface TrackedHand {
  label: HandednessLabel;
  landmarks: Landmark[];
}

export interface HandTrackerResult {
  hands: TrackedHand[];
}

// Tunables — raised hard to suppress false positives on random objects,
// patterns, hair, etc. The user reported persistent phantom detections
// even at 0.6, so we go to 0.75 across the board + stricter handedness.
const MIN_DETECTION_CONFIDENCE = 0.75;
const MIN_PRESENCE_CONFIDENCE = 0.75;
const MIN_TRACKING_CONFIDENCE = 0.75;
const HANDEDNESS_SCORE_THRESHOLD = 0.75;
const TEMPORAL_POSITION_TOLERANCE = 0.15; // normalized distance — tighter
const TEMPORAL_HOLD_MISSES = 2; // drop faster when detection gaps appear
// Sanity-check: a real hand has a palm width (MCP-index → MCP-pinky distance)
// within a reasonable normalized range. Random objects often produce
// detections with absurdly small or large palm sizes — we filter those out.
const PALM_SIZE_MIN = 0.04;
const PALM_SIZE_MAX = 0.45;

interface TrackedState {
  label: HandednessLabel;
  landmarks: Landmark[];
  missed: number;
  accepted: boolean;
}

export class HandTracker {
  private landmarker: HandLandmarker | null = null;
  private ready: Promise<HandLandmarker>;
  private swapHands: boolean;
  private useGpu: boolean;
  private _lastTs: number = 0;
  // True while the landmarker is being (re)created. The rAF loop checks
  // isReady() and bails out while this is true, so detectForVideo is never
  // called on a half-initialized or closed landmarker (which crashes
  // MediaPipe when switching GPU↔CPU delegate).
  private initializing: boolean = true;
  private tracked: Map<HandednessLabel, TrackedState> = new Map();

  constructor(opts?: { swapHands?: boolean; modelPath?: string; gpu?: boolean }) {
    this.swapHands = opts?.swapHands ?? false;
    this.useGpu = opts?.gpu ?? true;
    const modelPath = opts?.modelPath ?? '/models/hand_landmarker.task';
    this.ready = this.init(modelPath);
  }

  private async init(modelPath: string): Promise<HandLandmarker> {
    this.initializing = true;
    this.landmarker = null;
    try {
      // Use locally-served WASM files from /public/vendor/mediapipe-wasm/
      // so the app works fully offline (no jsdelivr CDN dependency).
      const vision = await FilesetResolver.forVisionTasks(
        '/vendor/mediapipe-wasm'
      );
      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: modelPath,
          delegate: this.useGpu ? 'GPU' : 'CPU',
        },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: MIN_DETECTION_CONFIDENCE,
        minHandPresenceConfidence: MIN_PRESENCE_CONFIDENCE,
        minTrackingConfidence: MIN_TRACKING_CONFIDENCE,
      });
      this.landmarker = landmarker;
      return landmarker;
    } finally {
      this.initializing = false;
    }
  }

  async waitUntilReady(): Promise<HandLandmarker> {
    return this.ready;
  }

  /** True only after the landmarker has finished initializing AND is not
   *  being torn down. The rAF loop checks this before calling detect() to
   *  avoid crashes during GPU↔CPU delegate switches. */
  isReady(): boolean {
    return !this.initializing && this.landmarker !== null;
  }

  /** Returns the latest hand landmarks for a given video frame timestamp (ms). */
  detect(video: HTMLVideoElement, timestampMs: number): HandTrackerResult {
    if (!this.landmarker) {
      return { hands: [] };
    }
    // Reject non-monotonic timestamps — MediaPipe throws if you call
    // detectForVideo with a timestamp <= the previous one. This happens
    // when a new HandTracker is created mid-session (e.g. GPU/CPU toggle)
    // and the rAF loop fires before the new landmarker is fully ready.
    if (timestampMs <= this._lastTs) {
      timestampMs = this._lastTs + 1;
    }
    this._lastTs = timestampMs;
    let result;
    try {
      result = this.landmarker.detectForVideo(video, timestampMs);
    } catch (err) {
      console.warn('HandLandmarker.detectForVideo failed:', err);
      return { hands: this.emitTracked() };
    }

    // Parse current detections with handedness-score filter.
    const current: TrackedHand[] = [];
    if (result.landmarks && result.landmarks.length > 0) {
      const handednesses = result.handednesses ?? [];
      for (let i = 0; i < result.landmarks.length; i++) {
        const lms = result.landmarks[i];
        const handedness = handednesses[i];
        if (!handedness || handedness.length === 0) continue;
        const cat = handedness[0];
        const label = cat.categoryName;
        if (label !== 'Left' && label !== 'Right') continue;
        // Handedness score filter — drop low-confidence classifications.
        if ((cat.score ?? 0) < HANDEDNESS_SCORE_THRESHOLD) continue;
        // Palm-size sanity check — a real hand has palm width (MCP-index
        // → MCP-pinky, points 5 and 17) within a reasonable normalized
        // range. This filters out phantom detections on hair, fabric
        // patterns, furniture edges etc. that produce wildly out-of-range
        // palm geometries.
        const palmWidth = Math.hypot(
          lms[17].x - lms[5].x,
          lms[17].y - lms[5].y,
          (lms[17].z ?? 0) - (lms[5].z ?? 0)
        );
        if (palmWidth < PALM_SIZE_MIN || palmWidth > PALM_SIZE_MAX) continue;
        const finalLabel: HandednessLabel = this.swapHands
          ? label === 'Left'
            ? 'Right'
            : 'Left'
          : label;
        const landmarks: Landmark[] = lms.map((lm) => ({
          x: lm.x,
          y: lm.y,
          z: lm.z ?? 0,
        }));
        current.push({ label: finalLabel, landmarks });
      }
    }

    // Update temporal tracking state.
    const seenLabels = new Set<HandednessLabel>();
    for (const hand of current) {
      seenLabels.add(hand.label);
      const prev = this.tracked.get(hand.label);
      if (prev) {
        // Hand was already tracked — check position consistency.
        const dx = hand.landmarks[0].x - prev.landmarks[0].x;
        const dy = hand.landmarks[0].y - prev.landmarks[0].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < TEMPORAL_POSITION_TOLERANCE || prev.accepted) {
          // Acceptable movement OR already accepted — keep it.
          prev.landmarks = hand.landmarks;
          prev.missed = 0;
          prev.accepted = true;
        } else {
          // Jumped too far — treat as a new detection, require re-acceptance.
          prev.landmarks = hand.landmarks;
          prev.missed = 0;
          prev.accepted = false;
        }
      } else {
        // New detection — add as pending (not yet accepted).
        this.tracked.set(hand.label, {
          label: hand.label,
          landmarks: hand.landmarks,
          missed: 0,
          accepted: false,
        });
      }
    }

    // Increment missed counter for hands not seen this frame.
    for (const [label, state] of this.tracked.entries()) {
      if (!seenLabels.has(label)) {
        state.missed += 1;
        if (state.missed > TEMPORAL_HOLD_MISSES) {
          this.tracked.delete(label);
        }
      }
    }

    return { hands: this.emitTracked() };
  }

  /** Emit only accepted hands (or hands still within the hold window). */
  private emitTracked(): TrackedHand[] {
    const out: TrackedHand[] = [];
    for (const state of this.tracked.values()) {
      if (state.accepted) {
        out.push({ label: state.label, landmarks: state.landmarks });
      }
    }
    return out;
  }

  close() {
    try {
      this.landmarker?.close();
    } catch {
      // ignore
    }
    this.landmarker = null;
    this.tracked.clear();
  }
}
