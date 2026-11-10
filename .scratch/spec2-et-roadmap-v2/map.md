# Carte Wayfinder — Architecture V2, Roadmap & Spec 2 de Jazz Trane'R

Label: `wayfinder:map`

## Destination

Verrouiller l'architecture cible multi-instruments et les schémas de données inter-specs de **Jazz Trane'R** V2, découper la **Roadmap** en 4 **Specs** livrables, et produire la **Spec 2** complète (`.scratch/spec2-grilles-audio-packs/spec.md` + tickets prêts à implémenter) couvrant l'outillage Vite, le moteur natif de **Grilles**, les outils audio de travail (*Inner Clock*, Drone, *Call & Response* avec Pitch-Shift/Time-Stretch) et les **Packs** / **Plans** / flux *Daily-Weekly*.

## Notes

- **Domaine & Recherche** : Consulter systématiquement [`GLOSSARY.md`](../../GLOSSARY.md) et [`docs/research/jazz-pedagogy-and-market.md`](../../docs/research/jazz-pedagogy-and-market.md). Utiliser exclusivement le vocabulaire canonique du glossaire (**Vue Séance**, **Mode Immersif**, **Lecteur de Partition**, **Mode Live**, **Cadre**, **Item**, **Attributs d'un item**, **Grille**, **Partition Dynamique**, **Drill**, **Setlist**, **Routine**, **Plan**, **Pack**, **Série**, **Trieur Express**).
- **Compétences à activer selon le type de ticket** : `grilling` + `domain-modeling` (tickets `grilling`), `prototype` (tickets `prototype`), `research` (tickets `research`), `codebase-design` (pour toutes les interfaces de modules).
- **Principes directeurs validés lors du cadrage initial** :
  1. **Local-First + Flux Cloud statique + Vite** : L'exécution et la bibliothèque restent 100 % hors-ligne (zéro latence en concert/caveau), complétées par une synchronisation automatique en tâche de fond d'un flux distant (`feed.json` + **Packs** hébergés sur GitHub Pages puis sur un backend dédié). L'[ADR-0001](../../docs/adr/0001-modules-vanilla-sans-bundler.md) évolue vers un outillage **Vite + ES Modules** compatible Capacitor et Vitest.
  2. **Sobriété Pro vs Ateliers Pédagogiques** : Le socle destiné aux musiciens pros reste épuré ; les briques pédagogiques (**Packs**, **Plans**, **Drills**, **Ear Training**, validation MIDI/Micro) sont modulaires et non intrusives.
  3. **Multi-instruments ($C, B\flat, E\flat$ & Clés)** : Un profil d'instrument global adapte dynamiquement la tonalité affichée des **Grilles** et des **Partitions Dynamiques**.
  4. **Séquencement de la Roadmap en 4 Specs** :
     - **Spec 2 (cible immédiate de cette carte)** : Outillage Vite & résorption de la dette Spec 1, Profil Multi-Instruments, Moteur natif de **Grilles** (décodage `irealb://`, format texte lisible éditable dans et hors de l'application, import d'accords MusicXML, rendu vectoriel, degrés fonctionnels, mode *Blindfold*, indexation des cadences pour *Practice in Songs*), Outils Audio Pro (Métronome *Inner Clock*, Drone harmonique, Studio Audio *Call & Response* avec Time-Stretch/Pitch-Shift), et Fondation des **Packs** / **Plans** / flux *Daily-Weekly*.
     - **Spec 3** : **Partition Dynamique** (import `.musicxml` + saisie rapide au clavier piano virtuel/MIDI/texte vers un format interne avec curseur synchronisé au tempo/métronome, transposition 12 tons, synthèse SoundFont/voicings) et moteur de **Drills** génératifs mains-libres.
     - **Spec 4** : Atelier **Ear Training Jazz** intégré (reconnaissance de degrés sur drone façon *Sonofield*, reconnaissance/dictée d'accords et de voicings personnalisables avec règles strictes de tessiture et de renversements, reconnaissance de cadences types, dictées mélodiques).
     - **Spec 5** : Validation interactive **MIDI & Microphone** (validation polyphonique et mélodique note-à-note / accord-par-accord).

## Decisions so far

<!-- Un pointeur d'une ligne par ticket résolu : - [Titre du ticket](issues/NN-slug.md) : synthèse en une ligne -->

- [Décodage complet du format irealb://, extraction d'accords MusicXML et grammaire texte de Grille](issues/01-decodage-ireal-et-formats-grilles.md) : Algorithme exact `unobfuscateIReal` (`1r34LbKcu7` + involution `obfusc50` tant que `remaining.length > 51` + substitutions `Kcl`/`LZ`/`XyQ`), grammaire complète des jetons iReal Pro, mapping `<harmony>` MusicXML 4.0 et syntaxe texte bidirectionnelle documentés dans [`docs/research/ireal-musicxml-and-chord-chart-formats.md`](../../docs/research/ireal-musicxml-and-chord-chart-formats.md).
- [Briques WebAudio DSP et rendu musical sous Vite et Capacitor](issues/02-briques-audio-web-dsp-et-rendu-musical.md) : `signalsmith-stretch` (MIT, ~45 Ko WASM/AudioWorklet) pour le Time-Stretch/Pitch-Shift et le *Call & Response*, *Lookahead Scheduler* WebAudio + synthèse soustractive 5 oscillateurs pour le Métronome *Inner Clock* et le Drone *Sonofield*, et `VexFlow` (police *Petaluma*) sur modèle JSON interne + sampler piano Opus/OGG par tierces mineures (~850 Ko hors-ligne) pour la **Partition Dynamique** ([`docs/research/webaudio-dsp-and-music-engraving.md`](../../docs/research/webaudio-dsp-and-music-engraving.md)).
- [Audit du monolithe script.js, migration vers Vite et résorption de la dette Spec 1](issues/03-audit-architecture-vite-et-dette-spec1.md) : Architecture Vite (`root: 'www'`, `build.outDir: '../dist'`, `capacitor.config.json` pointant sur `dist`), inventaire ligne par ligne de la dette Spec 1 (`mode-pupitre`, `streak`, `inbox`, `playlist`, `showSaveFilePicker`, `apiFetch`) et plan d'extraction de 5 nouveaux modules profonds pour la Spec 2 ([`docs/research/vite-migration-and-spec1-debt-audit.md`](../../docs/research/vite-migration-and-spec1-debt-audit.md)).

## Not yet specified

- **Spec 3 — Saisie au Clavier Piano Virtuel & Curseur de Partition Dynamique** : Ergonomie détaillée du clavier virtuel tactile pour saisir un voicing ou un lick sans ouvrir MuseScore, règles d'enharmonie lors de la transposition dans les 12 tons, et synchronisation visuelle du curseur de défilement avec le métronome.
- **Spec 3 — Moteur de Drills Génératifs & Accompagnement par Voicings** : Interface de configuration des cycles de **Drills** mains-libres (cycles de tonalités, *Tempo Ladder*, *Crook Roulette*, soustraction cellulaire de Bergonzi) et synthèse audio jouant une **Grille** avec les voicings de la bibliothèque.
- **Spec 4 — Atelier Ear Training Jazz (*Sonofield* & Voicings sur mesure)** : Design de l'interface de degrés sur drone continu type *Sonofield*, moteur de génération aléatoire d'accords/voicings respectant les limites de tessiture et de renversements, dictées de cadences et dictées mélodiques.
- **Spec 5 — Validation Interactive MIDI & Microphone (Polyphonique & Mélodique)** : Intégration WebMIDI (USB/Bluetooth) et détection de hauteur monophonique au microphone (YIN) pour valider note-à-note ou accord-par-accord les exercices de **Partition Dynamique** et d'**Ear Training**.

## Out of scope

- **Projet `Jiz` (Quiz de culture générale, généalogie d'artistes et Blindfold Test d'enregistrements originaux)** : Écarté de **Jazz Trane'R** pour vivre comme un projet indépendant, car son usage se fait hors-instrument et les extraits d'enregistrements commerciaux posent des problèmes de droits voisins.
- **Évaluation rythmique du swing au microphone / MIDI (Pocket Meter) à court terme** : Reportée au-delà des premières Specs MIDI/Micro, car modéliser proprement le placement *laid-back* et le rebond swing sans pénaliser artificiellement le musicien est trop complexe par rapport à la validation mélodique et harmonique note-à-note.
- **Hébergement de plugins VST3 natifs desktop (C++)** : Incompatible avec une exécution WebView Android/iOS multiplateforme ; remplacé par de l'échantillonnage WebAudio/SoundFont et du Pitch-Shift/Time-Stretch de pistes audio réelles (RealPlay / MP3).
