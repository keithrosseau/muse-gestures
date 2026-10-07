'use client';

// AudioEngine: top-level Web Audio graph that wires together the sample
// player (laser harp), the evolving pad, and the gesture-controlled FX
// (reverb wet, delay wet, filter cutoff, vox gain).
//
// Graph:
//
//   SamplePlayer ─┐
//                 ├─→ harpGain ─→ harpFilter ─→ harpDelay ─→ harpReverbSend ─┐
//   (each note)   │                                                            │
//                                                                              ↓
//                                                                       masterReverb ─→ masterGain ─→ destination
//                                                                              ↑
//   PadEngine ─→ padGain ─→ padFilter ──────────────────────────→ padReverbSend ┘
//                                              │
//                                              └─→ padDelay ─→ masterGain
//
// To keep things tractable for the first demo:
//   - One shared ConvolverNode for reverb (procedurally-generated impulse).
//   - One shared DelayNode for echo (with feedback).
//   - Per-source gains for wet/dry balance controlled by gestures.

import { SamplePlayer } from './SamplePlayer';
import { PadEngine } from './PadEngine';
import { VoxPlayer } from './VoxPlayer';

export class AudioEngine {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;

  // FX
  private reverb: ConvolverNode | null = null;
  private reverbGain: GainNode | null = null;
  private delay: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private delayWet: GainNode | null = null;

  // Source chains
  private harpPre: GainNode | null = null;     // pre-FX gain for harp
  private harpDelaySend: GainNode | null = null;

  private padPre: GainNode | null = null;

  // Vox chain (ostinato sample controlled by left-hand roll)
  private voxPre: GainNode | null = null;

  // Sub-engines
  samplePlayer: SamplePlayer | null = null;
  padEngine: PadEngine | null = null;
  voxPlayer: VoxPlayer | null = null;

  // State
  private started = false;
  private baseSampleNote = 60; // C4

  async start(): Promise<void> {
    if (this.started) return;
    const Ctor: typeof AudioContext =
      (window.AudioContext as typeof AudioContext) ||
      ((window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    const ctx = new Ctor();
    this.ctx = ctx;
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    // ── Master bus architecture ──
    // All sources → preMaster → master → destination
    //                     └──→ reverb → reverbGain → master  (wet return)
    // setReverbWet controls reverbGain (0 = dry, up to 0.9 = drenched).
    // This puts reverb on the MASTER so pad + harp + vox ALL get the
    // same reverb amount — one knob controls everything.

    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(ctx.destination);

    // Pre-master bus — all audio sources connect here (dry).
    const preMaster = ctx.createGain();
    preMaster.gain.value = 1.0;
    preMaster.connect(this.master); // dry path

    // Reverb — fed from preMaster, returned to master via reverbGain.
    // Impulse: 5.0 seconds decay (was 3.0) for a long, lush, cavernous tail.
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.generateImpulse(ctx, 5.0, 2.0);
    this.reverbGain = ctx.createGain();
    this.reverbGain.gain.value = 0.0; // starts dry — controlled by left-hand scale
    preMaster.connect(this.reverb); // all sources → reverb
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.master); // wet return → master

    // Delay (echo) — fed from harp only, returned to preMaster.
    // The INPUT gain (harpDelaySend) is controlled by setDelayWet — when
    // the right hand is closed, input = 0 → NO signal enters the delay →
    // complete silence from the delay + shimmer. When the hand opens,
    // input increases → echo + shimmer appear together.
    this.delay = ctx.createDelay(2.0);
    this.delay.delayTime.value = 0.375;
    this.delayFeedback = ctx.createGain();
    this.delayFeedback.gain.value = 0.45;
    this.delayWet = ctx.createGain();
    this.delayWet.gain.value = 1.0; // output is always full; INPUT is gated
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay); // feedback loop
    this.delay.connect(this.delayWet);
    this.delayWet.connect(preMaster); // delay returns to preMaster (goes through reverb too)

    // Shimmer — a sparkling, high-frequency echo. We tap the delay output,
    // run it through a high-pass filter (only frequencies above 2 kHz pass),
    // then through a short feedback delay to create a "crystalline" tail.
    // This is NOT a pitch shifter — it's a spectral shimmer that emphasises
    // the upper harmonics of the echo, giving it an ethereal, sparkly quality.
    // The shimmer input is gated by the same harpDelaySend as the main delay,
    // so it only appears when the right hand is open.
    const shimmerHP = ctx.createBiquadFilter();
    shimmerHP.type = 'highpass';
    shimmerHP.frequency.value = 2500; // only sparkly highs
    shimmerHP.Q.value = 0.7;
    const shimmerDelay = ctx.createDelay(1.0);
    shimmerDelay.delayTime.value = 0.75; // longer than main delay for spread
    const shimmerFB = ctx.createGain();
    shimmerFB.gain.value = 0.55; // feedback for crystalline tail
    const shimmerReturn = ctx.createGain();
    shimmerReturn.gain.value = 0.4; // audible but not overwhelming
    // Tap delay output → highpass → shimmer delay → feedback loop → return
    this.delay.connect(shimmerHP);
    shimmerHP.connect(shimmerDelay);
    shimmerDelay.connect(shimmerFB);
    shimmerFB.connect(shimmerDelay); // feedback
    shimmerDelay.connect(shimmerReturn);
    shimmerReturn.connect(preMaster);

    // Harp chain → preMaster (no filter — straight through)
    this.harpPre = ctx.createGain();
    this.harpPre.gain.value = 0.9;
    // harpDelaySend is the INPUT to the delay — controlled by setDelayWet.
    this.harpDelaySend = ctx.createGain();
    this.harpDelaySend.gain.value = 0.0; // starts silent

    this.harpPre.connect(preMaster); // dry to master
    this.harpPre.connect(this.harpDelaySend);
    this.harpDelaySend.connect(this.delay);

    // Pad chain → preMaster
    this.padPre = ctx.createGain();
    this.padPre.gain.value = 1.0; // louder so reverb tail is audible
    this.padPre.connect(preMaster);

    // Vox chain → preMaster
    this.voxPre = ctx.createGain();
    this.voxPre.gain.value = 1.0;
    this.voxPre.connect(preMaster);

    // Sub-engines
    if (this.harpPre) {
      this.samplePlayer = new SamplePlayer({
        baseNote: this.baseSampleNote,
        outputNode: this.harpPre,
      });
      this.samplePlayer.setContext(ctx);
    }
    if (this.padPre) {
      this.padEngine = new PadEngine({ outputNode: this.padPre });
      this.padEngine.setContext(ctx);
      this.padEngine.start();
    }
    if (this.voxPre) {
      this.voxPlayer = new VoxPlayer({ outputNode: this.voxPre, maxGain: 0.5 });
      this.voxPlayer.setContext(ctx);
      this.voxPlayer.start();
    }

    this.started = true;
  }

  isStarted(): boolean {
    return this.started;
  }

  getContext(): AudioContext | null {
    return this.ctx;
  }

  async loadSample(url: string, baseNote: number): Promise<void> {
    if (!this.samplePlayer) return;
    this.baseSampleNote = baseNote;
    await this.samplePlayer.loadSample(url, baseNote);
  }

  async loadVoxSample(url: string): Promise<void> {
    if (!this.voxPlayer) return;
    await this.voxPlayer.loadSample(url);
  }

  // --- Gesture-controlled parameter setters ---

  /** Left hand scale (0..1) → master reverb wet.
   *  0 = hand far away → completely dry (no reverb).
   *  1 = hand close to camera → drenched in reverb (gain 1.5 — louder than
   *  dry signal for a lush, cavernous tail).
   *  Applies to ALL sounds — pad, harp, vox — because the reverb is on
   *  the master bus. */
  setReverbWet(value: number): void {
    if (!this.ctx || !this.reverbGain) return;
    const v = Math.max(0, Math.min(1, value));
    const now = this.ctx.currentTime;
    // Map 0..1 → 0..1.5 reverb gain. At 0 = silence (dry), at 1 = lush wet.
    // 1.5 means the wet signal is 1.5x louder than dry — very audible.
    this.reverbGain.gain.setTargetAtTime(v * 1.5, now, 0.08);
  }

  /** Right hand openness (0..1) → delay INPUT gain.
   *  0 = hand closed (fist) → input = 0 → NO signal enters delay →
   *      complete silence from delay AND shimmer.
   *  1 = hand open → input = 0.8 → echo + shimmer both audible.
   *  We control the INPUT (harpDelaySend), not the output, so when the
   *  hand closes the delay naturally dies out instead of cutting abruptly. */
  setDelayWet(value: number): void {
    if (!this.ctx || !this.harpDelaySend) return;
    const v = Math.max(0, Math.min(1, value));
    const now = this.ctx.currentTime;
    // Map 0..1 → 0..0.8 input gain. At 0 = silence, at 1 = prominent echo.
    this.harpDelaySend.gain.setTargetAtTime(v * 0.8, now, 0.08);
  }

  /** Left hand openness (0..1) -> pad filter cutoff (open = brighter pad). */
  setPadOpenness(value: number): void {
    this.padEngine?.setOpenness(value);
  }

  /** Left hand presence (0..1) -> pad gate (0 = silent, 1 = audible). */
  setPadPresence(value: number): void {
    this.padEngine?.setPresence(value);
  }

  /** Right hand pinch (0..1) -> placeholder for future tanpura trigger. */
  setHarpVolume(value: number): void {
    // Pinch no longer controls harp volume — it's reserved for the tanpura
    // strum feature (gesture #6, deferred). Keeping the method as a no-op
    // placeholder so the call site doesn't need to change.
    void value;
  }

  /** Left hand roll (0..1) -> vox sample gain (vertical = silent, 90° right = full). */
  setVoxGain(value: number): void {
    this.voxPlayer?.setGain(value);
  }

  // --- Harp note triggers ---

  triggerHarpNote(midi: number, velocity: number): void {
    if (!this.samplePlayer) return;
    if (!this.samplePlayer.isLoaded()) return;
    this.samplePlayer.noteOn(midi, velocity);
  }

  releaseHarpNote(midi: number): void {
    this.samplePlayer?.noteOff(midi, 0.6);
  }

  releaseAllHarpNotes(): void {
    this.samplePlayer?.stopAll();
  }

  private generateImpulse(ctx: AudioContext, duration: number, decay: number): AudioBuffer {
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * duration);
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const data = buf.getChannelData(c);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        // Noise with exponential decay + slight low-pass feel via averaging.
        const noise = Math.random() * 2 - 1;
        const env = Math.pow(1 - t, decay);
        data[i] = noise * env;
      }
    }
    return buf;
  }

  stop(): void {
    this.voxPlayer?.stop();
    this.padEngine?.stop();
    this.samplePlayer?.stopAll();
    try {
      this.ctx?.close();
    } catch {
      // ignore
    }
    this.ctx = null;
    this.started = false;
  }
}
