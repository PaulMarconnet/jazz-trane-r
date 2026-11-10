# Jazz Trane'R

[![Tests](https://img.shields.io/badge/tests-82%20passed%20(Vitest)-brightgreen.svg)](tests/)
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20Web%20(Capacitor%208)-blue.svg)](https://capacitorjs.com/)
[![Architecture](https://img.shields.io/badge/architecture-Vanilla%20Modules-orange.svg)](docs/adr/0001-modules-vanilla-sans-bundler.md)
[![License](https://img.shields.io/badge/license-ISC-lightgrey.svg)](package.json)

**Jazz Trane'R** is an offline-first daily practice workspace and repertoire manager built for jazz musicians. Designed for Android tablets on the music stand as well as desktop browsers, it runs entirely locally with zero network dependency.

It brings together structured session timers, a sheet music and audio library, built-in practice tools (metronome, A-B transcription looper, voice recorder, manuscript staff notebook), a stylus-ready PDF score reader with a Live Setlist mode, and practice analytics.

---

## Features

### Practice Sessions & Immersive View
- **Session Builder & Routines**: Create timed sessions across customizable categories (*Voicings*, *Patterns*, *Licks*, *Tunes*, *Transcriptions*, *Technique*), set an optional Key of the Day (with a random key generator), adjust durations via vertical swipe, and save reusable practice routines.
- **Immersive Mode (*Mode Pupitre*)**: Distraction-free full-screen view featuring a circular timer, live completion ETA, a discreet 24h clock (`HH:MM`) to keep track of rehearsal room bookings, and one-tap access to audio tools.
- **Smart Shuffle**: Automatically builds a practice queue from the library matching the active exercise's category and subcategories, prioritizing favorites, least-practiced items, and oldest-practiced items.
- **Time Accounting**: Per-exercise countdown and count-up (*overtime*) timers, configurable Pomodoro work/break cycles (*Coffee Break*), and an automatic 60-minute overtime AFK cutoff so forgotten timers never skew practice history.

### Built-in Practice Toolkit
- **Metronome**: 30 to 300 BPM (adjustable via vertical swipe, mouse wheel, slider, or *Tap Tempo*), 2 to 9 beats per bar, quarter-note or eighth-note pulse, interactive beat sequencer with 3 states per beat (strong accent, regular beat, mute), and 3 synthesized WebAudio sound profiles (*Woodblock*, *Classic Click*, *Beep*).
- **Audio Player & Transcription Looper**: HTML5 Canvas waveform display, A-B loop markers with draggable handles and whole-window dragging, pitch-preserving playback speeds (50%, 75%, 85%, 100%, 125%), ±5s quick skip, and continuous background playback while reading sheet music.
- **Voice Recorder (Dictaphone)**: Live frequency visualizer, pause/resume recording, instant playback, local file export, or one-click linking of a recorded take directly to the tune currently being practiced.
- **Manuscript Music Notebook (*Cahier de musique*)**: Blank staff paper generator (single staff or piano grand staff), dynamic addition of staff systems, toggleable barlines, stylus notation, direct library saving, and PDF export.

### Score Reader, Stylus Annotations & Live Mode
- **Flicker-Free PDF Rendering**: Multi-page PDF (`PDF.js`) and image score viewer using 3-canvas double-buffering (silent background pre-rendering of pages $N-1$ and $N+1$) so pages track the finger smoothly during swipe gestures.
- **Stylus Annotation Suite**: Floating, draggable toolbar with a pen (1–10px thickness via long-press slider), straight line tool, floating text editor (drag to move, corner handle to resize), yellow highlighter, eraser, 3 ink colors, and a palm-rejection toggle (stylus-only vs. finger + stylus). Single-finger page swipes automatically lock whenever a drawing tool is active.
- **Live Concert Mode**: Stage view built around Setlists. Includes a drag-and-drop setlist drawer (`SortableJS`), a top HUD showing the current and upcoming tune, seamless page turns from the last page of a tune to the first page of the next tune in the setlist, and a fallback lead-sheet card (key, composer, style) for tunes without an attached PDF.

### Library & Batch Ingester (*Trieur Express*)
- **Musical Metadata**: Every library item stores musical attributes (`compositeur`, `style`, `tonalite`, `tempo`), subcategories/setlists, multi-page PDFs or images, linked audio, favorite status, and practice count.
- **iReal Pro Import**: Imports HTML backups and direct `irealb://` links shared from the iReal Pro Android app, extracting tune metadata and optionally creating the corresponding Setlist.
- **Batch Ingester (*Trieur Express*)**: Imports `.zip` archives or multi-file selections (PDF, images, audio) with a choice between *Fast* and *Careful* modes. Includes two-tier deduplication:
  1. *Exact Jazz Canonicalization*: Automatically merges punctuation and article variations (`"Bags' Groove"` = `"Bag's Groove"`, `"'Round Midnight"` = `"Round Midnight"`, `"Autumn Leaves, The"`).
  2. *Fuzzy Matching*: Detects probable duplicates using normalized Levenshtein similarity ($\ge 0.80$) and offers non-destructive metadata and media merging.

### Analytics & History Dashboard
- **Core Metrics**: Weekly practice time, progress toward a configurable weekly hour target, current and all-time day streaks with an interactive monthly practice calendar, and most-practiced key (grouping relative major and minor keys).
- **Interactive Charts (Chart.js)**: Time spent, category breakdown (custom canvas doughnut chart with direct slice labels), and key distribution across week, month, year, or all-time views. Includes a demo session generator to preview the dashboard.

### Localization, Themes & Native Backups
- **Bilingual UI & Themes**: Full French and English localization, plus 4 visual themes (*Espresso Dark / OLED*, *Argile*, *Groove*, *Cream*).
- **Native OS Backups**: Full `.zip` export (database + all scores, audio files, and annotations) or lightweight `.json` export using native system file pickers (`Storage Access Framework` on Android, `showSaveFilePicker` on desktop) with a post-restore summary.

---

## Architecture

The core domain logic is isolated in **6 vanilla modules** under `www/modules/`, loaded without a bundler ([ADR-0001](docs/adr/0001-modules-vanilla-sans-bundler.md)) to keep Capacitor Android sync instantaneous while allowing direct unit testing in Node.js via `vitest`:

```text
www/
├── index.html               # Views and modals markup
├── style.css                # Design system and 4 themes (OLED, Argile, Groove, Cream)
├── i18n.js                  # Localization dictionaries (FR / EN)
├── script.js                # UI controller, WebAudio (metronome, looper, recorder) & Canvas
└── modules/
    ├── library-domain.js    # Item normalization, jazz canonicalization, Levenshtein, iReal parser
    ├── session-timer.js     # Pure state machine for exercise timers, Pomodoro, breaks & AFK cutoff
    ├── history-analytics.js # Weekly targets, streaks, monthly calendar, key grouping & chart data
    ├── score-navigation.js  # Pagination state machine, double-buffering pre-render targets & Live Mode
    ├── storage-repo.js      # Persistence seam (IndexedDB / Capacitor Filesystem) & ZIP/JSON archives
    └── system-host.js       # Host platform bridge (Android SAF backups, notifications, mic permissions)
```

Architecture Decision Records are available in [`docs/adr/`](docs/adr/):
- [ADR-0001](docs/adr/0001-modules-vanilla-sans-bundler.md) — Bundler-free Vanilla modules loaded before `script.js`.
- [ADR-0002](docs/adr/0002-dialogue-natif-sauvegarde-saf.md) — Native OS "Save As..." dialog for backups.

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Android Studio](https://developer.android.com/studio) (for Android APK builds)

### Installation
```bash
git clone [https://github.com/PaulMarconnet/jazz-trane-r.git](https://github.com/PaulMarconnet/jazz-trane-r.git)
cd jazz-trane-r
npm install
```

### Running Tests
The 6 core modules are covered by 82 automated unit tests (`vitest`) running in Node.js without DOM dependencies:
```bash
# Run the test suite
npm test

# Run tests in watch mode
npm run test:watch
```

### Android Build (Capacitor)
```bash
# Sync web assets to the Capacitor Android project
npx cap sync android

# Open the project in Android Studio
npx cap open android
```

---

## Roadmap (V2)

Upcoming milestones specified in the [V2 architecture map](.scratch/):
- **Spec 2**: Vite build tooling, transposing instrument profiles ($C, B\flat, E\flat$), native vector chord chart renderer (full `irealb://` unobfuscation, MusicXML `<harmony>` import, functional degrees, *Blindfold* mode), *Inner Clock / Gap Click* metronome, harmonic *Drone*, and *Call & Response* audio studio with pitch-shift/time-stretch (`signalsmith-stretch`).
- **Spec 3**: Dynamic notation (`VexFlow` + offline piano sampler) with 12-key transposition and hands-free generative *Drills*.
- **Spec 4 & 5**: Jazz *Ear Training* studio (scale degrees over drone, custom voicing and cadence dictations) and real-time polyphonic/melodic validation via WebMIDI and microphone.

---

## License

ISC © Paul Marconnet
