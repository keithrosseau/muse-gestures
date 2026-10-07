// Port of compute_hand_features from main.py (Python).
// Mirrors the exact same math, including the wrist-roll formula and
// palm-size normalization, so feature values match the Python prototype
// 1:1 and can be fed into the same OSC channel map.

import { clamp, distance, type HandFeatures, type Landmark } from './constants';

export function computeHandFeatures(landmarks: Landmark[], aspect = 1.0): HandFeatures {
  const points = landmarks;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const wrist = points[0];
  const thumbTip = points[4];
  const indexTip = points[8];
  const middleTip = points[12];
  const ringTip = points[16];
  const pinkyTip = points[20];

  const palmWidth = Math.max(distance(points[5], points[17]), 0.001);
  const palmHeight = Math.max(distance(wrist, points[9]), 0.001);
  const palmSize = Math.max((palmWidth + palmHeight) * 0.5, 0.001);

  const bboxDiagonal = Math.sqrt(
    (Math.max(...xs) - Math.min(...xs)) ** 2 + (Math.max(...ys) - Math.min(...ys)) ** 2
  );

  const fingerTips: Landmark[] = [thumbTip, indexTip, middleTip, ringTip, pinkyTip];
  const openness =
    fingerTips.reduce((acc, tip) => acc + distance(wrist, tip) / (palmSize * 2.2), 0) / 5;

  const indexCurl = 1.0 - distance(points[5], indexTip) / (palmSize * 1.85);
  const middleCurl = 1.0 - distance(points[9], middleTip) / (palmSize * 1.95);
  const ringCurl = 1.0 - distance(points[13], ringTip) / (palmSize * 1.85);
  const pinkyCurl = 1.0 - distance(points[17], pinkyTip) / (palmSize * 1.65);
  const curl = (indexCurl + middleCurl + ringCurl + pinkyCurl) * 0.25;

  // Wrist roll: angle of the knuckle line (index MCP → pinky MCP) measured
  // from the HORIZONTAL. When the palm faces the camera ("giving five"),
  // the knuckle line is horizontal → angle = 0 → roll = 0 (silent).
  // When the hand rotates 90° to either side, the knuckle line becomes
  // vertical → angle = 90 → roll = 1 (full volume).
  // We use |ky| / |kx| so the direction of rotation doesn't matter —
  // both left and right rotation increase the roll value.
  const kx = (points[17].x - points[5].x) * aspect;
  const ky = points[17].y - points[5].y;
  // atan2(|ky|, |kx|) gives the angle from horizontal, 0..90 degrees.
  const knuckleAngleDeg = (Math.atan2(Math.abs(ky), Math.abs(kx)) * 180) / Math.PI;
  // Map 0° (horizontal/palm-forward) → 0, 90° (vertical/rotated) → 1.
  const roll = clamp(knuckleAngleDeg / 90.0);

  return {
    presence: 1.0,
    x: clamp(xs.reduce((a, b) => a + b, 0) / xs.length),
    y: clamp(1.0 - wrist.y),
    scale: clamp((bboxDiagonal - 0.12) / 0.58),
    pinch_index: clamp(1.0 - distance(thumbTip, indexTip) / (palmSize * 1.25)),
    roll,
    openness: clamp((openness - 0.5) / 0.5),
    curl,
  };
}

export type HandednessLabel = 'Left' | 'Right';

export interface HandsData {
  Left?: HandFeatures;
  Right?: HandFeatures;
}

// Build the 16-channel value vector from Left/Right features, mirroring
// the channel order used in the Python prototype (CHANNEL_NAMES).
export function channelsFromHands(hands: HandsData): number[] {
  const left = hands.Left;
  const right = hands.Right;
  const feature = (h: HandFeatures | undefined, name: keyof HandFeatures): number =>
    clamp(h ? h[name] : 0.0);

  return [
    feature(left, 'presence'),
    feature(left, 'x'),
    feature(left, 'y'),
    feature(left, 'scale'),
    feature(left, 'pinch_index'),
    feature(left, 'roll'),
    feature(left, 'openness'),
    feature(left, 'curl'),
    feature(right, 'presence'),
    feature(right, 'x'),
    feature(right, 'y'),
    feature(right, 'scale'),
    feature(right, 'pinch_index'),
    feature(right, 'roll'),
    feature(right, 'openness'),
    feature(right, 'curl'),
  ];
}

// EMA smoother — port of SignalSmoother from main.py.
export class SignalSmoother {
  private previous: number[];
  constructor(private alpha: number, size = 16) {
    this.alpha = clamp(alpha);
    this.previous = new Array(size).fill(0.0);
  }
  update(values: number[]): number[] {
    const smoothed = values.map((current, i) => {
      const prev = this.previous[i] ?? 0;
      const v = prev + (current - prev) * this.alpha;
      this.previous[i] = v;
      return v;
    });
    return smoothed;
  }
}
