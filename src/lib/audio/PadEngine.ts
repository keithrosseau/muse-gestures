'use client';

// Evolving pad engine inspired by the Forsitan Modulare "Draen" module's
// patch #26 "belong": a slowly evolving, slightly detuned, multi-oscillator
// pad with a moving low-pass filter.
//
// Architecture:
//   3 detuned sawtooth oscillators (root + fifth + octave)
//   -> summing gain
//   -> low-pass filter (cutoff modulated by slow LFO + hand openness)
//   -> slow amplitude LFO for "breathing"
//   -> stereo widener (delay-based)
//   -> output gain (always-on, gentle)
//
// All three oscillators run continuously; the LFOs move very slowly so the
// timbre evolves over ~30-60 second cycles, matching the "belong" patch's
// meditative feel.

export interface PadEngineOptions {
  outputNode: AudioNode;
  rootFrequency?: number; // Hz, e.g. 65.41 = C2
}

export class PadEngine {
  private ctx: AudioContext | null = null;
  private output: AudioNode;
  private rootFreq: number;

  private oscs: OscillatorNode[] = [];
  private oscGains: GainNode[] = [];
  private sumGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private ampLfo: OscillatorNode | null = null;
  private ampLfoGain: GainNode | null = null;
  private cutoffLfo: OscillatorNode | null = null;
  private cutoffLfoGain: GainNode | null = null;
  private stereoDelay: DelayNode | null = null;
  private stereoMerger: ChannelMergerNode | null = null;
  private outGain: GainNode | null = null;

  private started = false;

  constructor(opts: PadEngineOptions) {
    this.output = opts.outputNode;
    this.rootFreq = opts.rootFrequency ?? 65.41; // C2
  }

  setContext(ctx: AudioContext) {
    this.ctx = ctx;
  }

  start(): void {
    if (!this.ctx || this.started) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Three detuned sawtooth oscillators: root, fifth (3:2), octave (2:1).
    const voices = [
      { freq: this.rootFreq, detune: -7, gain: 0.35 },
      { freq: this.rootFreq * 1.5, detune: +4, gain: 0.18 },
      { freq: this.rootFreq * 2, detune: -3, gain: 0.22 },
    ];

    this.sumGain = ctx.createGain();
    this.sumGain.gain.value = 1.0;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 600;
    this.filter.Q.value = 0.7;

    // Amplitude LFO: very slow "breathing"
    this.ampLfo = ctx.createOscillator();
    this.ampLfo.type = 'sine';
    this.ampLfo.frequency.value = 0.05; // 20s cycle
    this.ampLfoGain = ctx.createGain();
    this.ampLfoGain.gain.value = 0.06; // ±6% around the base
    this.ampLfo.connect(this.ampLfoGain);
    this.ampLfoGain.connect(this.sumGain.gain);
    // Base value 1.0 + LFO modulates it

    // Cutoff LFO: slow filter sweep
    this.cutoffLfo = ctx.createOscillator();
    this.cutoffLfo.type = 'sine';
    this.cutoffLfo.frequency.value = 0.025; // 40s cycle
    this.cutoffLfoGain = ctx.createGain();
    this.cutoffLfoGain.gain.value = 250; // ±250 Hz
    this.cutoffLfo.connect(this.cutoffLfoGain);
    this.cutoffLfoGain.connect(this.filter.frequency);

    // Stereo widener: short delay on right channel only
    this.stereoDelay = ctx.createDelay(0.05);
    this.stereoDelay.delayTime.value = 0.018;
    this.stereoMerger = ctx.createChannelMerger(2);

    this.outGain = ctx.createGain();
    // Start at 0 — pad is silent until left hand appears (setPresence ramps it up).
    this.outGain.gain.value = 0.0;

    // Build voice graph
    for (const v of voices) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = v.freq;
      osc.detune.value = v.detune;
      const g = ctx.createGain();
      g.gain.value = v.gain;
      osc.connect(g);
      g.connect(this.sumGain);
      osc.start(now);
      this.oscs.push(osc);
      this.oscGains.push(g);
    }

    this.ampLfo.start(now);
    this.cutoffLfo.start(now);

    // Routing: sum -> filter -> [L direct, R delayed] -> merger -> outGain -> output
    this.sumGain.connect(this.filter);
    this.filter.connect(this.stereoMerger, 0, 0); // left
    this.filter.connect(this.stereoDelay);
    this.stereoDelay.connect(this.stereoMerger, 0, 1); // right
    this.stereoMerger.connect(this.outGain);
    this.outGain.connect(this.output);

    this.started = true;
  }

  /**
   * Modulate filter cutoff from hand openness (0..1) — LINEAR mapping for
   * predictable, responsive control.
   *   openness=0 (fist) → cutoff = 30 Hz → pad fully filtered, essentially silent
   *   openness=0.5 → cutoff ≈ 1500 Hz
   *   openness=1 (open hand) → cutoff = 18000 Hz → pad fully bright
   * Linear ramp (no exponential curve) so the response feels direct and
   * proportional to the hand position. Smoothed with a short time constant
   * to avoid zipper noise but still feel immediate.
   */
  setOpenness(value: number): void {
    if (!this.ctx || !this.filter) return;
    const v = Math.max(0, Math.min(1, value));
    // Linear interpolation between 30 Hz (fist) and 18000 Hz (open).
    const target = 30 + v * (18000 - 30);
    const now = this.ctx.currentTime;
    // 0.05s time constant — fast enough to feel responsive, slow enough
    // to avoid zipper noise on small jitter.
    this.filter.frequency.setTargetAtTime(target, now, 0.05);
  }

  /**
   * Gate the pad from left-hand presence (0..1).
   * presence=0 (no left hand) → gain=0 (silent).
   * presence=1 (left hand in frame) → gain=base (0.18, gentle background).
   * Ramps smoothly to avoid clicks when the hand enters/leaves the frame.
   * The pad will not "fade to silence on its own" — if presence stays at 1,
   * the gain stays at 0.18. The previous self-fading symptom was caused by
   * the openness cutoff dropping too low on small hand-position jitter;
   * the linear mapping above fixes that.
   */
  setPresence(value: number): void {
    if (!this.ctx || !this.outGain) return;
    const v = Math.max(0, Math.min(1, value));
    const now = this.ctx.currentTime;
    // Slightly slower ramp (0.2s) for natural fade-in/out.
    this.outGain.gain.setTargetAtTime(v * 0.18, now, 0.2);
  }

  /** Legacy method — kept for compatibility but no longer used by the main loop. */
  setGain(value: number): void {
    if (!this.ctx || !this.outGain) return;
    const v = Math.max(0, Math.min(1, value));
    const now = this.ctx.currentTime;
    this.outGain.gain.setTargetAtTime(v * 0.18, now, 0.1);
  }

  stop(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const osc of this.oscs) {
      try {
        osc.stop(now + 0.05);
      } catch {
        // ignore
      }
    }
    try {
      this.ampLfo?.stop(now + 0.05);
      this.cutoffLfo?.stop(now + 0.05);
    } catch {
      // ignore
    }
    this.oscs = [];
    this.oscGains = [];
    this.started = false;
  }

  isStarted(): boolean {
    return this.started;
  }
}
