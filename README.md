# MUSE GESTURES

Real-time hand-controlled sound installation. Pure browser, no install, no VCV Rack required.

**Live:** _add your Vercel URL here after deploy_

## What it is

A webcam tracks your hands via MediaPipe. A custom Web Audio engine translates gestures into a living pad, a pentatonic laser harp, and a looping vocal ostinato — all synthesized in-browser, zero-latency.

- **Left hand** sculpts the atmosphere: pad filter, vocal ostinato volume, reverb amount
- **Right hand** plays the melody: pentatonic 5×5 grid, delay/echo amount
- **6th gesture** (right-hand pinch → tanpura strum) is reserved as a placeholder

## Tech stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS 4 + shadcn/ui
- `@mediapipe/tasks-vision` for hand tracking
- Web Audio API for synthesis (oscillators, convolution reverb, feedback delay, polyphonic sampler)
- Zustand for state, including EN/RU i18n with localStorage persistence
- Montserrat (Google Fonts) for typography

## Project structure

```
public/
  models/hand_landmarker.task     # MediaPipe model (7.5 MB, downloaded once)
  samples/
    manifest.json                 # List of harp samples + vox sample
    musicbox.ogg  lofipiano.ogg   # Harp samples (selectable in UI)
    vox.ogg                       # Ostinato vocal sample (auto-loaded)
  gestures-guide/
    page-1.png                    # Gestures guide as embedded image
  gestures-guide.pdf              # Same, as downloadable PDF
src/
  app/
    layout.tsx                    # Montserrat font, metadata
    page.tsx                      # Landing ↔ play view switcher
  components/gesturcv/
    LandingPage.tsx               # Minimalist editorial landing
    CameraView.tsx                # <video> + canvas overlay + tracking loop
    SampleSelector.tsx            # Dropdown for harp sample selection
  lib/
    audio/
      AudioEngine.ts              # Top-level Web Audio graph
      PadEngine.ts                # Evolving pad (Draen "belong"-inspired)
      SamplePlayer.ts             # Polyphonic sample player with transposition
      VoxPlayer.ts                # Looping vocal ostinato
    handtracking/
      HandTracker.ts              # MediaPipe wrapper + temporal filter
      features.ts                 # Hand feature extraction (port from Python)
      LaserHarp.ts                # 5×5 grid state machine
      constants.ts                # Channel map, grid constants
    gesturcv-store.ts             # Zustand store (channels, harp, language, etc.)
    i18n.ts                       # EN/RU translations
```

## Local development

```bash
bun install
bun run dev
```

Open http://localhost:3000

## Build for production

```bash
bun run build
bun run start
```

## Add a new sample

1. Drop the audio file (`.wav` / `.mp3` / `.ogg`) into `public/samples/`
2. Add an entry to `public/samples/manifest.json`:
   ```json
   {
     "harpSamples": [
       { "id": "mybell", "name": "My Bell", "filename": "mybell.wav", "baseNote": 60 }
     ],
     "voxSample": { ... }
   }
   ```
   `baseNote` is the MIDI note of the sample (60 = C4, 69 = A4). The engine transposes relative to it.
3. Reload — the sample appears in the dropdown automatically.

## License

MIT
