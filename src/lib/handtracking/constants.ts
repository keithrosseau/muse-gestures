// Hand-tracking constants and types — port of Python constants from main.py.

export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
] as const;

export const CHANNEL_NAMES = [
  'left_presence', 'left_x', 'left_y', 'left_scale',
  'left_pinch_index', 'left_roll', 'left_openness', 'left_curl',
  'right_presence', 'right_x', 'right_y', 'right_scale',
  'right_pinch_index', 'right_roll', 'right_openness', 'right_curl',
] as const;

export type ChannelName = typeof CHANNEL_NAMES[number];

// Per-channel voltage range (low, high), indexed 1:1 with CHANNEL_NAMES.
// Internal features are 0..1; scaled to volts before sending over OSC.
export const CHANNEL_VOLTAGE_RANGES: ReadonlyArray<readonly [number, number]> = [
  // Left hand (channels 1-8)
  [0.0, 10.0],   // presence (gate)
  [-5.0, 5.0],   // x
  [-5.0, 5.0],   // y
  [0.0, 1.0],    // scale
  [0.0, 1.0],    // pinch_index
  [0.0, 1.0],    // roll
  [0.0, 1.0],    // openness
  [0.0, 1.0],    // curl
  // Right hand (channels 9-16)
  [0.0, 10.0],
  [-5.0, 5.0],
  [-5.0, 5.0],
  [0.0, 1.0],
  [0.0, 1.0],
  [0.0, 1.0],
  [0.0, 1.0],
  [0.0, 1.0],
] as const;

// --- Laser harp: centered 5x5 pentatonic grid ---
export const HARP_GRID_COLS = 5;
export const HARP_GRID_ROWS = 5;
export const HARP_GRID_WIDTH_FRAC = 0.5;      // grid side as a fraction of frame width
export const HARP_BASE_OCTAVE = 3;            // bottom row octave (C3)
export const PENT_DEGREES = [0, 2, 4, 7, 9] as const;  // C D E G A (semitones from C)
export const HARP_DEGREE_NAMES = ['C', 'D', 'E', 'G', 'A'] as const;
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const HARP_DEBOUNCE_FRAMES = 2;
export const HARP_GATE_HOLD_FRAMES = 3;
export const HARP_VELOCITY_REF_SPEED = 8.0;   // grid-cells/s for full velocity
export const HARP_VELOCITY_MIN = 0.25;
export const HARP_VELOCITY_CURVE = 0.6;       // <1 keeps gentle drifts audible

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface HandFeatures {
  presence: number;
  x: number;
  y: number;
  scale: number;
  pinch_index: number;
  roll: number;
  openness: number;
  curl: number;
}

export function clamp(v: number, low = 0.0, high = 1.0): number {
  return Math.max(low, Math.min(high, v));
}

export function distance(a: Landmark, b: Landmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

export function cellToMidi(col: number, screenRow: number): number {
  const octave = HARP_BASE_OCTAVE + (HARP_GRID_ROWS - 1 - screenRow);
  return 12 * (octave + 1) + PENT_DEGREES[col];
}

export function midiToName(midi: number): string {
  return `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export function harpGridRect(width: number, height: number): { x0: number; y0: number; side: number } {
  let side = Math.floor(width * HARP_GRID_WIDTH_FRAC);
  side = Math.min(side, Math.floor(height * 0.9));
  const x0 = Math.floor((width - side) / 2);
  const y0 = Math.floor((height - side) / 2);
  return { x0, y0, side };
}
