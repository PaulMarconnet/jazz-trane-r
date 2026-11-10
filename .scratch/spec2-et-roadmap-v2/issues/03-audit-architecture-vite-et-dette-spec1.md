# Audit du monolithe script.js, migration vers Vite et résorption de la dette Spec 1

Type: research
Status: resolved

## Question

En vue de faire évoluer l'[ADR-0001](../../../docs/adr/0001-modules-vanilla-sans-bundler.md) vers un outillage **Vite + ES Modules** et d'assainir la base de code en ouverture de la **Spec 2** :

1. **Migration Vite + Capacitor + Vitest** : Quelle configuration minimale de `vite.config.js` et `capacitor.config.json` permet de compiler l'application vers un dossier de distribution propre pour Android tout en conservant la compatibilité avec les scripts globaux existants (`www/script.js`, `www/i18n.js`), le Service Worker hors-ligne (`www/sw.js`) et les 82 tests unitaires Vitest existants ?
2. **Inventaire exhaustif de la dette Spec 1** : Quels sont tous les emplacements précis dans `www/script.js`, `www/index.html` et `www/style.css` où subsistent :
   - des termes bannis par [`GLOSSARY.md`](../../../GLOSSARY.md) (`mode-pupitre`, `isPupitreActive`, `streak`, `inbox`, `playlist`),
   - des appels directs à `window.showSaveFilePicker` contournant [`www/modules/system-host.js`](../../../www/modules/system-host.js),
   - le routeur interne `apiFetch` au lieu d'appels directs à [`www/modules/storage-repo.js`](../../../www/modules/storage-repo.js),
   - et quelles sont les frontières naturelles dans `www/script.js` (10 661 lignes) à extraire en nouveaux modules profonds pour la **Spec 2** ?

## Answer

Le rapport d'audit complet et le plan d'action sont détaillés dans [docs/research/vite-migration-and-spec1-debt-audit.md](../../../docs/research/vite-migration-and-spec1-debt-audit.md).

### Synthèse du plan d'action

1. **Migration incrémentale vers Vite + Capacitor + Vitest (Évolution de l'ADR-0001)** :
   - **`vite@8.3.5`** est déjà présent dans `node_modules` (dépendance transitive de `vitest@^5.0.5`).
   - Créer `vite.config.js` à la racine avec `root: 'www'`, `base: './'`, `build.outDir: '../dist'`, des noms de chunks déterministes (`assets/[name].js`) et un plugin natif `closeBundle` (`fs.cpSync`) copiant `libs/`, `modules/`, `i18n.js`, `script.js`, `style.css`, `sw.js`, `manifest.json` et les icônes vers `dist/` afin que `cache.addAll` de `www/sw.js` reste intègre hors-ligne.
   - Ajouter `test: { root: '.', include: ['tests/**/*.test.js'] }` dans `vite.config.js` pour que les **82 tests Vitest** existants continuent de s'exécuter depuis la racine malgré `root: 'www'`.
   - Basculer `"webDir": "dist"` dans `capacitor.config.json` et ajouter les scripts `dev`, `build` et `sync:android` (`vite build && cap sync android`) dans `package.json`.
   - Introduire un point d'entrée ES Module `www/main.js` (`<script type="module" src="./main.js"></script>`) qui importe et ré-expose les modules profonds sur `window`, tout en conservant `www/i18n.js` et `www/script.js` en chargement classique le temps de résorber les 61 handlers inline `onclick`/`onchange` de `www/index.html` non attachés explicitement à `window`.

2. **Résorption exhaustive de la dette résiduelle Spec 1** :
   - **Termes bannis par `GLOSSARY.md`** :
     - `pupitre` → **Mode Concert** (`concertMode`, `isConcertModeActive`, `body.mode-concert`, `#btn-concert-float`) : **39 occurrences** dans `www/script.js` (L59–60, L3337, L4906–4910, L6424, L6788–6879) et **18 occurrences** dans `www/style.css` (L490–596).
     - `streak` → **Constance** (`consistency`, `#stat-consistency`, `#consistency-Popover`) : **52 occurrences** dans `www/script.js` (incluant la suppression du bloc mort UTC L4011–4031 dans `chargerHistorique`), **19** dans `www/index.html`, **16** dans `www/i18n.js` et **17** dans `www/modules/history-analytics.js` (avec alias de rétrocompatibilité).
     - `inbox` → **File d'attente de tri** (`triageQueue`) : **32 occurrences** dans `www/script.js`, **6** dans `www/index.html`, **1** dans `www/style.css` et **2** dans `www/i18n.js`.
     - `playlist` → **Programme** (`program` / `Setlist`) : **71 occurrences** dans `www/script.js`, **17** dans `www/index.html`, **9** dans `www/style.css`, **10** dans `www/i18n.js` et **3** dans `www/modules/library-domain.js` (en préservant uniquement `emp.nom === 'Playlist'` pour les données persistées).
   - **Encapsulation de `window.showSaveFilePicker` dans `www/modules/system-host.js`** :
     - **10 occurrences** réparties en 3 blocs dans `www/script.js` (`telechargerFichierSysteme` L10348–10368, `exporterBackupJson` L10404–10417, `exporterBackupCompletZip` L10460–10473).
     - Étendre `system-host.js` pour accepter un producteur asynchrone de `Blob` (`saveBackupFile(fileName, async () => blob, mimeType)`) afin de préserver le geste utilisateur synchrone (ADR-0002) avant la compression ZIP, et supprimer les 3 blocs de `www/script.js`.
   - **Élimination du routeur fictif `apiFetch` au profit de `www/modules/storage-repo.js`** :
     - **32 occurrences** dans `www/script.js` (définition L195–288 + **31 sites d'appel**, dont 27 appels JSON et 4 appels `FormData` aux lignes L2965, L3020, L5167 et L9164), plus **7 appels directs** à `lireLocal`/`ecrireLocal`/`sauvegarderFichierLocal` (L4142, L5824, L6710, L8228, L8239, L9172, L9510).
     - Remplacer tous les appels par une instance singleton `storageRepo = StorageRepo.createStorageRepo(...)` exposant les méthodes métier directes (`saveSong`, `deleteSong`, `batchUpdateSongs`, `saveFileBlob`, etc.).

3. **Frontières des 5 nouveaux modules profonds pour la Spec 2 (découpage de `www/script.js`)** :
   - `www/modules/chord-chart.js` : Décodage du corps obfusqué iReal Pro (`ireal://`), transposition harmonique (12 tonalités + enharmonie), degrés fonctionnels (`II-V-I`), rendu SVG de grille de jazz et Mode Blindfold (remplace le placeholder de `www/script.js` L6633–6680).
   - `www/modules/metronome-engine.js` : Extraction de `www/script.js` L802–1406 et L6501–6539 (~605 lignes) — Web Audio lookahead scheduler, swing, polyrythmie, Clave/Charleston, Tap Tempo et Coach muet.
   - `www/modules/audio-studio.js` : Extraction de `www/script.js` L1476–3052 (~1 577 lignes) — lecteur Transcribe!, boucles A-B avec *Call & Response Auto-Gap*, dictaphone MediaRecorder et tags d'auto-critique horodatés.
   - `www/modules/practice-engine.js` : Extraction de `www/script.js` L5536–5595, L3648–3900 et L5804–6199 (~710 lignes + extensions Spec 2) — Routines, Plans, Packs `.jtrpack`, *Interleaved Practice*, générateur de contraintes aléatoires (Hal Crook / Bergonzi) et matrice SRS 5 couches × 12 tonalités.
   - `www/modules/score-annotations.js` : Extraction de `www/script.js` L7547–9244 (~1 698 lignes) — moteur vectoriel stylet sur PDF/images, *Image Occlusion* (masquage mémoire) et cahier manuscrit exportable en PDF.

