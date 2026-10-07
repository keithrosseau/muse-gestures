// Port of LaserHarp from main.py (Python).
// Same 5x5 pentatonic grid, debounce, gate-holdover, and EMA-velocity logic.

import {
  clamp,
  cellToMidi,
  HARP_GRID_COLS,
  HARP_GRID_ROWS,
  HARP_DEBOUNCE_FRAMES,
  HARP_GATE_HOLD_FRAMES,
  HARP_VELOCITY_REF_SPEED,
  HARP_VELOCITY_MIN,
  HARP_VELOCITY_CURVE,
} from './constants';

export interface HarpUpdateResult {
  midi: number | null;
  gateVolts: number;
  /** Only non-null on the frame a new note fires. */
  velocity: number | null;
}

export class LaserHarp {
  col: number | null = null;
  row: number | null = null;
  private pending: [number, number] | null = null;
  private debounce = 0;
  private missed = 0;
  private prevXy: [number, number] | null = null;
  private speed = 0.0;

  /**
   * harpXY is [colF, rowF] in grid units, or null when the fingertip
   * is outside the grid / no hand.
   */
  update(harpXy: [number, number] | null, dt: number): HarpUpdateResult {
    // Speed tracking (2-D, in grid cells per second)
    if (harpXy !== null && this.prevXy !== null && dt > 1e-6) {
      const dx = harpXy[0] - this.prevXy[0];
      const dy = harpXy[1] - this.prevXy[1];
      const instant = Math.sqrt(dx * dx + dy * dy) / dt;
      this.speed = this.speed * 0.4 + instant * 0.6;
    }
    if (harpXy !== null) {
      this.prevXy = harpXy;
    }

    // Fingertip outside the grid / no hand: holdover then release
    if (harpXy === null) {
      this.missed += 1;
      if (this.missed > HARP_GATE_HOLD_FRAMES) {
        this.col = null;
        this.row = null;
        this.pending = null;
        this.debounce = 0;
        this.speed = 0.0;
        this.prevXy = null;
      }
      const active = this.col !== null;
      const midi = active ? cellToMidi(this.col!, this.row!) : null;
      return { midi, gateVolts: active ? 10.0 : 0.0, velocity: null };
    }

    this.missed = 0;
    const col = clamp(Math.floor(harpXy[0]), 0, HARP_GRID_COLS - 1);
    const row = clamp(Math.floor(harpXy[1]), 0, HARP_GRID_ROWS - 1);
    let velocity: number | null = null;

    if (this.col === null || this.row === null || col !== this.col || row !== this.row) {
      if (this.pending && this.pending[0] === col && this.pending[1] === row) {
        this.debounce += 1;
      } else {
        this.pending = [col, row];
        this.debounce = 1;
      }
      if (this.debounce >= HARP_DEBOUNCE_FRAMES) {
        this.col = col;
        this.row = row;
        this.pending = null;
        this.debounce = 0;
        const rawVel = Math.pow(this.speed / HARP_VELOCITY_REF_SPEED, HARP_VELOCITY_CURVE);
        velocity = clamp(rawVel, HARP_VELOCITY_MIN, 1.0);
      }
    } else {
      this.pending = null;
      this.debounce = 0;
    }

    const active = this.col !== null;
    const midi = active ? cellToMidi(this.col!, this.row!) : null;
    return { midi, gateVolts: active ? 10.0 : 0.0, velocity };
  }
}
