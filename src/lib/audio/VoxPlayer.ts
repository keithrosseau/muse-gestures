'use client';

// VoxPlayer: looping ostinato sample with gain controlled by left-hand roll.
//
// The sample plays continuously in a loop; the gain ramps from 0 (hand
// vertical → vox silent) to max (hand rotated 90° to the right → vox at
// full volume). Matches the original Python prototype's behavior where
// left_roll controlled a vocal sample's volume in VCV Rack.

export interface VoxPlayerOptions {
  outputNode: AudioNode;
  maxGain?: number;
}

export class VoxPlayer {
  private ctx: AudioContext | null = null;
  private output: AudioNode;
  private maxGain: number;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private started = false;
  private loadGeneration = 0;

  constructor(opts: VoxPlayerOptions) {
    this.output = opts.outputNode;
    this.maxGain = opts.maxGain ?? 0.5;
  }

  setContext(ctx: AudioContext) {
    this.ctx = ctx;
  }

  async loadSample(url: string): Promise<void> {
    if (!this.ctx) throw new Error('VoxPlayer.loadSample: AudioContext not set');
    const gen = ++this.loadGeneration;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch vox sample: ${res.status} ${res.statusText}`);
    }
    const arr = await res.arrayBuffer();
    const buf = await this.ctx.decodeAudioData(arr);
    // Discard if a newer load superseded us.
    if (gen !== this.loadGeneration) return;
    this.buffer = buf;
    // If already started, hot-swap the source.
    if (this.started) {
      this.stopSource();
      this.startSource();
    }
  }

  isLoaded(): boolean {
    return this.buffer !== null;
  }

  /** Start the looping playback. Gain starts at 0 (silent). */
  start(): void {
    if (!this.ctx || this.started) return;
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0; // silent until roll ramps it up
    this.gain.connect(this.output);
    this.started = true;
    if (this.buffer) {
      this.startSource();
    }
  }

  private startSource(): void {
    if (!this.ctx || !this.buffer || !this.gain) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = true;
    // Loop the entire buffer.
    src.loopStart = 0;
    src.loopEnd = this.buffer.duration;
    src.connect(this.gain);
    src.start();
    this.source = src;
  }

  private stopSource(): void {
    if (this.source) {
      try { this.source.stop(); } catch { /* ignore */ }
      try { this.source.disconnect(); } catch { /* ignore */ }
      this.source = null;
    }
  }

  /** Set gain from roll (0..1). Ramps smoothly to avoid clicks. */
  setGain(value: number): void {
    if (!this.ctx || !this.gain) return;
    const v = Math.max(0, Math.min(1, value));
    const now = this.ctx.currentTime;
    // Smooth ramp: 50ms time constant
    this.gain.gain.setTargetAtTime(v * this.maxGain, now, 0.05);
  }

  stop(): void {
    this.stopSource();
    if (this.gain) {
      try { this.gain.disconnect(); } catch { /* ignore */ }
      this.gain = null;
    }
    this.started = false;
  }
}
