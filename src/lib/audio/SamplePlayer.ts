'use client';

// Polyphonic sample player for the laser harp.
// - One active AudioBuffer (the uploaded sample).
// - Each note creates a fresh AudioBufferSourceNode -> gain envelope -> output.
// - Transposition: playbackRate = 2^((targetMidi - baseMidi) / 12).

export interface SamplePlayerOptions {
  baseNote: number; // MIDI note of the loaded sample (e.g. 60 = C4)
  outputNode: AudioNode;
  maxPolyphony?: number;
}

interface ActiveVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  midi: number;
  startedAt: number;
  released: boolean;
}

export class SamplePlayer {
  private ctx: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private baseNote: number;
  private output: AudioNode;
  private maxPolyphony: number;
  private activeVoices: ActiveVoice[] = [];
  private loadGeneration = 0;

  constructor(opts: SamplePlayerOptions) {
    this.baseNote = opts.baseNote;
    this.output = opts.outputNode;
    this.maxPolyphony = opts.maxPolyphony ?? 16;
  }

  setContext(ctx: AudioContext) {
    this.ctx = ctx;
  }

  setBaseNote(midi: number) {
    this.baseNote = midi;
  }

  /** Load an audio file (URL) into the buffer. Resolves when ready. */
  async loadSample(url: string, baseNote?: number): Promise<void> {
    if (!this.ctx) {
      throw new Error('SamplePlayer.loadSample: AudioContext not set');
    }
    const gen = ++this.loadGeneration;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch sample: ${res.status} ${res.statusText}`);
    }
    const arr = await res.arrayBuffer();
    const buf = await this.ctx.decodeAudioData(arr);
    // Discard if a newer load superseded us.
    if (gen !== this.loadGeneration) return;
    this.buffer = buf;
    if (baseNote !== undefined) this.baseNote = baseNote;
    // Stop all currently-playing voices (they used the old buffer).
    this.stopAll();
  }

  isLoaded(): boolean {
    return this.buffer !== null;
  }

  /** Start a note. Velocity in 0..1. */
  noteOn(midi: number, velocity = 0.8): void {
    if (!this.ctx || !this.buffer) return;
    // Voice stealing: if same note already playing, fade it out quickly.
    for (const v of this.activeVoices) {
      if (v.midi === midi && !v.released) {
        this.releaseVoice(v, 0.05);
      }
    }
    // Enforce max polyphony: kill oldest voice.
    while (this.activeVoices.length >= this.maxPolyphony) {
      const oldest = this.activeVoices[0];
      if (oldest) this.releaseVoice(oldest, 0.04);
      // If still in list after release, force-stop
      if (this.activeVoices[0] === oldest) {
        this.killVoice(oldest);
      }
    }

    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    const semitones = midi - this.baseNote;
    src.playbackRate.value = Math.pow(2, semitones / 12);

    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const peak = Math.max(0.0001, Math.min(1.0, velocity));
    // Sharp attack + medium decay, holds until noteOff.
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.6), now + 0.25);

    src.connect(gain);
    gain.connect(this.output);

    src.start();
    const voice: ActiveVoice = {
      source: src,
      gain,
      midi,
      startedAt: now,
      released: false,
    };
    src.onended = () => {
      const idx = this.activeVoices.indexOf(voice);
      if (idx !== -1) this.activeVoices.splice(idx, 1);
      try {
        gain.disconnect();
      } catch {
        // ignore
      }
    };
    this.activeVoices.push(voice);
  }

  /** Release a note (smooth tail). */
  noteOff(midi: number, releaseTime = 0.4): void {
    for (const v of this.activeVoices) {
      if (v.midi === midi && !v.released) {
        this.releaseVoice(v, releaseTime);
      }
    }
  }

  private releaseVoice(v: ActiveVoice, releaseTime: number): void {
    if (!this.ctx || v.released) return;
    v.released = true;
    const now = this.ctx.currentTime;
    const current = v.gain.gain.value;
    try {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(current, now);
      v.gain.gain.exponentialRampToValueAtTime(0.0001, now + releaseTime);
      v.source.stop(now + releaseTime + 0.02);
    } catch {
      // ignore
    }
  }

  private killVoice(v: ActiveVoice): void {
    try {
      v.source.stop();
    } catch {
      // ignore
    }
    try {
      v.gain.disconnect();
    } catch {
      // ignore
    }
    const idx = this.activeVoices.indexOf(v);
    if (idx !== -1) this.activeVoices.splice(idx, 1);
  }

  stopAll(): void {
    for (const v of [...this.activeVoices]) {
      this.killVoice(v);
    }
    this.activeVoices = [];
  }
}
