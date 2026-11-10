# Jazz Trane'R 🎷🎹

[![Tests](https://img.shields.io/badge/tests-82%20passed%20(Vitest)-brightgreen.svg)](tests/)
[![Platform](https://img.shields.io/badge/platform-Android%20%7C%20Web%20(Capacitor%208)-blue.svg)](https://capacitorjs.com/)
[![Architecture](https://img.shields.io/badge/architecture-Deep%20Vanilla%20Modules-orange.svg)](docs/adr/0001-modules-vanilla-sans-bundler.md)
[![License](https://img.shields.io/badge/license-ISC-lightgrey.svg)](package.json)

**Jazz Trane'R** is an offline-first daily practice companion and learning suite engineered for jazz musicians (pianists, brass, woodwinds, guitarists, and bassists).

It streamlines the daily practice routine: prepare a structured, timed session, play along with sheet music and dynamic chord charts, track key mastery and streaks, and organize jazz repertoire with an intelligent batch ingester.

---

## ✨ Key Highlights

- **🎯 Timed Practice Sessions & Immersive Mode**:
  - Independent countdown and count-up timers per exercise, Pomodoro cycles, and AFK idle protection.
  - Minimalist ambient clock (`HH:MM`) designed for distraction-free rehearsal rooms.
  - Smart item selection factoring in favorites, practice recency, and repetition balance.

- **📚 Smart Library & Trieur Express (Batch Ingester)**:
  - Multi-level fuzzy deduplication: Level 1 handles jazz title canonicalization (e.g. `"Bags' Groove"` = `"Bag's Groove"`, `"'Round Midnight"` = `"Round Midnight"`), Level 2 suggests probable matches using normalized Levenshtein distance ($\ge 0.80$).
  - One-tap import from **iReal Pro** URLs (`irealb://`), MusicXML chord symbols, and local PDFs/audio.
  - Non-destructive metadata enrichment (`compositeur`, `style`, `tonalite`, `tempo`).

- **📄 High-Performance Score Reader & Live Gig Mode**:
  - Zero-flicker PDF page transitions via **Double-Buffering** (instant background pre-rendering of adjacent pages $N-1$ and $N+1$).
  - Intelligent touch gesture arbitration: smooth 1-finger swipes for page turns; automatically locked to stylus/touch drawing when freehand annotation tools (pen, highlighter, eraser) are active.
  - Seamless Setlist chaining for stage performance.

- **📊 Practice Analytics & Progress Tracking**:
  - Unified time accounting engine across live views, session summaries, and history cards.
  - Custom canvas-rendered category donut chart with high-contrast palette.
  - Weekly goal tracking, streak counter, and enharmonic key distribution analysis.

- **📱 Deep Android Native Integration**:
  - **Storage Access Framework (SAF)**: Native system "Save As..." dialog for `.json` and `.zip` backups without cache leakage ([ADR-0002](docs/adr/0002-dialogue-natif-sauvegarde-saf.md)).
  - Contextual runtime microphone permissions requested on-demand when opening the voice recorder.
  - Non-stacking, silent in-app notification scheduling aligned with Android system guidelines.

---

## 🏛️ Architecture & Engineering

Jazz Trane'R follows a **Domain-Driven Design** and **Deep Module** philosophy ([ADR-0001](docs/adr/0001-modules-vanilla-sans-bundler.md)):

```
www/modules/
├── library-domain.js       # Canonization, Levenshtein triage, iReal decode, setlists
├── session-timer.js        # Pure state-machine for timers, AFK auto-stop, Pomodoro
├── history-analytics.js    # Weekly targets, streaks, key metrics, donut charts
├── score-navigation.js     # Pagination state machine, double-buffering pre-render cache
├── storage-repo.js         # IndexedDB / Capacitor Filesystem storage abstraction seam
└── system-host.js          # Platform bridge (Android SAF, native share, notifications)
```

- **Domain Model**: Strictly documented and enforced via [`GLOSSARY.md`](GLOSSARY.md).
- **Issue & Roadmap Tracking**: Tracked directly in repo under [`.scratch/`](.scratch/) with formal specs and ticket wayfinding.
- **Decision Records**: Documented under [`docs/adr/`](docs/adr/).

---

## 🧪 Automated Test Suite

The core modules are 100% testable in Node.js without browser or DOM dependencies.

```bash
# Run the test suite (Vitest)
npm test

# Run tests in watch mode during development
npm run test:watch
```

**Coverage includes 82 automated unit tests**:
- Title canonicalization and fuzzy deduplication
- Session timer transitions and AFK auto-stop edge cases
- Enharmonic key analysis and weekly analytics calculations
- Score reader pagination bounds and annotation touch locks
- Storage repository serialization and SAF backup payload validation

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Android Studio](https://developer.android.com/studio) (for Android tablet build)

### Installation
```bash
git clone https://github.com/PaulMarconnet/jazz-trane-r.git
cd jazz-trane-r
npm install
```

### Development & Android Build
```bash
# Run unit tests
npm test

# Sync web assets to Capacitor Android project
npx cap sync android

# Open project in Android Studio
npx cap open android
```

---

## 📋 Tech Stack

- **Runtime**: Vanilla ES6+ Modules (Zero bundler friction, instant Android sync)
- **Mobile Container**: [Capacitor 8](https://capacitorjs.com/) with native Java plugins
- **Test Runner**: [Vitest 5](https://vitest.dev/)
- **PDF & Graphics**: PDF.js, HTML5 Canvas Double-Buffering, Chart.js
- **Audio DSP**: WebAudio API (time-stretching & synthesis engine in active roadmap)

---

## 📄 License

ISC © Paul Marconnet
