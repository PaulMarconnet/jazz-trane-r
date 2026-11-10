# Audit d'Architecture : Migration Vite, Résorption de la Dette Spec 1 et Découpage Modulaire Spec 2

Ce document consigne l'audit technique complet du dépôt **Jazz Trane'R** (`www/script.js`, `www/index.html`, `www/style.css`, `www/i18n.js`, `www/sw.js`, `www/modules/*.js`, `package.json`, `capacitor.config.json` et `tests/*.test.js`) en vue de :
1. Faire évoluer l'[ADR-0001](../adr/0001-modules-vanilla-sans-bundler.md) vers un outillage **Vite + ES Modules** compatible avec **Capacitor 8** et les **82 tests unitaires Vitest** existants.
2. Dresser l'inventaire exhaustif (lignes, fonctions, sélecteurs DOM/CSS) de la dette résiduelle de la Spec 1 (termes bannis par [`GLOSSARY.md`](../../GLOSSARY.md), appels directs à `window.showSaveFilePicker`, appels résiduels à `apiFetch`).
3. Définir les frontières naturelles du monolithe [`www/script.js`](../../www/script.js) (10 661 lignes) pour l'extraction des nouveaux modules profonds de la **Spec 2**.

---

## 1. Stratégie de migration non-destructive vers Vite + Capacitor + Vitest

### 1.1 État des lieux de l'outillage actuel

- **[`package.json`](../../package.json) (L1–30)** :
  - Définit `"type": "commonjs"` (L13) et `"scripts": { "test": "vitest run", "test:watch": "vitest" }` (L6–9).
  - Contient `"vitest": "^5.0.5"` en `devDependencies` (L28). **Fait notable** : `vite` (version `8.3.5`) est *déjà présent* dans `node_modules/vite` en tant que dépendance directe de Vitest.
- **[`capacitor.config.json`](../../capacitor.config.json) (L1–22)** :
  - Pointe directement sur le dossier source via `"webDir": "www"` (L4).
- **[`www/index.html`](../../www/index.html) (L22–26 et L2097–2104)** :
  - Charge 4 bibliothèques UMD/globales dans `<head>` (`libs/Sortable.min.js`, `libs/chart.min.js`, `libs/jszip.min.js`, `libs/pdf.min.js`) et 8 scripts classiques sans `type="module"` en fin de `<body>` (`i18n.js`, les 6 modules de `www/modules/*.js`, puis `script.js`).
- **[`www/sw.js`](../../www/sw.js) (L1–23)** :
  - Pré-cache une liste statique de 20 chemins explicites (`ASSETS_TO_CACHE`) lors de l'événement `install` via `cache.addAll(ASSETS_TO_CACHE)` (L28).
- **Suite de tests (`tests/*.test.js`)** :
  - 8 fichiers de test totalisant **82 tests** qui importent les 6 modules de `www/modules/*.js`.
  - Le test [`tests/smoke.test.js`](../../tests/smoke.test.js) (L33–59) lit le code source des 6 modules avec `fs.readFileSync` et les évalue via `vm.runInContext(code, context)` pour vérifier leur exposition sur `window`.

### 1.2 Les 4 pièges techniques à éviter lors de l'introduction de Vite

1. **Conflit de `root` entre Vite (`root: 'www'`) et Vitest (`tests/` à la racine)** :
   - Si `vite.config.js` définit `root: 'www'` pour servir et compiler `www/index.html`, Vitest hérite automatiquement de `root: 'www'` et cherche les tests dans `www/` au lieu de `tests/`, ne trouvant aucun fichier de test.
   - **Parade** : Définir explicitement `test: { root: '.', include: ['tests/**/*.test.js'] }` dans `vite.config.js`.
2. **Handlers HTML inline (`onclick="..."`) et couplage global `script.js` ↔ `i18n.js`** :
   - `www/index.html` contient **119 fonctions distinctes** appelées depuis des attributs inline (`onclick`, `onchange`, `oninput`, `onsubmit`), dont **61 ne sont pas explicitement attachées à `window.<fn>`** dans `www/script.js` (ex. `afficherVue`, `sauvegarderSeance`, `ajouterItemBrouillon`, `ouvrirModalItem`, `ajouterVocabulaire`, `exporterBackupCompletZip`, `exporterBackupJson`, `ouvrirModalRoutines`, etc.) — elles ne sont accessibles sur `window` que parce que `script.js` est évalué comme un script classique global.
   - De plus, [`www/i18n.js`](../../www/i18n.js) (L1779–1802) lit directement des identifiants globaux déclarés par `let` dans `script.js` (`SOUS_CATEGORIES`, `seanceEnCours`, `dictaphoneState`) et cible des boutons via leurs attributs `onclick` exacts (L1625–1750).
   - **Parade** : Ne pas convertir brutalement `www/script.js` ni `www/i18n.js` en `<script type="module">` d'un seul bloc. Introduire un point d'entrée ES Module dédié [`www/main.js`](../../www/main.js) (`<script type="module" src="./main.js"></script>`) qui importe et bundle tous les modules (`www/modules/*.js`) et les expose sur `window`, tandis que `i18n.js` et le résidu de `script.js` continuent d'être chargés comme scripts classiques jusqu'à l'extinction progressive du monolithe.
3. **Ordre d'exécution entre `<script type="module">` et scripts classiques** :
   - Un `<script type="module">` est toujours différé (`defer`) par le navigateur. Or [`www/script.js`](../../www/script.js) évalue au niveau racine (hors `DOMContentLoaded`) :
     - L656 : `const CATEGORIES_DEFAUT = (typeof getCategoriesDefautPourLangue === 'function') ...` (dépend de `i18n.js`)
     - L6226 : `const scoreNavMachine = (typeof ScoreNavigation !== 'undefined' ...) ? ScoreNavigation.createNavigationMachine() : null;` (dépend de `modules/score-navigation.js`).
   - Si `main.js` est chargé en `type="module"` et `script.js` en `<script src="script.js">` synchrone sans `defer`, `script.js` s'exécuterait *avant* `main.js` et `ScoreNavigation` serait `undefined` à la ligne 6226.
   - **Parade** : Placer `<script type="module" src="./main.js"></script>` *avant* `<script defer src="i18n.js"></script>` et `<script defer src="script.js"></script>` (ou conserver l'exposition synchrone). Selon la spécification HTML5, les scripts `type="module"` et les scripts classiques dotés de l'attribut `defer` s'exécutent dans l'ordre exact où ils apparaissent dans le DOM, juste avant `DOMContentLoaded`.
4. **Survie du pré-cache hors-ligne de `www/sw.js` (`cache.addAll`)** :
   - Par défaut, Vite renomme les assets bundlés avec un hachage (`assets/index-[hash].css`, `assets/main-[hash].js`) et ignore les `<script>` classiques qui ne sont pas dans `publicDir`. Si `./style.css` ou `./script.js` sont absents de `dist/`, `cache.addAll(ASSETS_TO_CACHE)` dans [`www/sw.js`](../../www/sw.js) (L28) échoue et bloque l'installation hors-ligne du Service Worker.
   - **Parade** : Configurer `rollupOptions.output` avec des noms déterministes sans hash (`assets/[name].js`, `assets/[name][extname]`) et inclure dans `vite.config.js` un micro-plugin natif (`fs.cpSync`, zéro dépendance externe) qui copie les fichiers globaux (`libs/`, `i18n.js`, `script.js`, `sw.js`, `manifest.json`, icônes, et `modules/`) dans `dist/`.

### 1.3 Configuration minimale exacte (`vite.config.js`, `capacitor.config.json`, `package.json`, `www/main.js`)

#### A. `vite.config.js` (à la racine du dépôt)

```js
const fs = require('fs');
const path = require('path');

/**
 * Copie dans dist/ les scripts globaux et ressources PWA qui ne passent pas
 * par le graphe d'import Rollup/Rolldown durant la transition progressive.
 */
function copyLegacyWebAssetsPlugin() {
    const staticEntries = [
        'libs',
        'modules',
        'i18n.js',
        'script.js',
        'style.css',
        'sw.js',
        'manifest.json',
        'icon-192.png',
        'icon-512.png',
        'jazz-trane-r-icon.svg'
    ];
    return {
        name: 'copy-legacy-web-assets',
        closeBundle() {
            const srcRoot = path.resolve(__dirname, 'www');
            const outRoot = path.resolve(__dirname, 'dist');
            if (!fs.existsSync(outRoot)) return;
            for (const entry of staticEntries) {
                const srcPath = path.join(srcRoot, entry);
                const destPath = path.join(outRoot, entry);
                if (fs.existsSync(srcPath)) {
                    fs.cpSync(srcPath, destPath, { recursive: true, force: true });
                }
            }
        }
    };
}

module.exports = {
    root: 'www',
    base: './',
    publicDir: false,
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            output: {
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name][extname]'
            }
        }
    },
    plugins: [copyLegacyWebAssetsPlugin()],
    test: {
        root: '.',
        include: ['tests/**/*.test.js']
    }
};
```

#### B. Point d'entrée ES Module `www/main.js`

```js
import LibraryDomain from './modules/library-domain.js';
import SessionTimer from './modules/session-timer.js';
import HistoryAnalytics from './modules/history-analytics.js';
import ScoreNavigation from './modules/score-navigation.js';
import StorageRepo from './modules/storage-repo.js';
import SystemHost from './modules/system-host.js';

if (typeof window !== 'undefined') {
    window.LibraryDomain = LibraryDomain || window.LibraryDomain;
    window.SessionTimer = SessionTimer || window.SessionTimer;
    window.HistoryAnalytics = HistoryAnalytics || window.HistoryAnalytics;
    window.ScoreNavigation = ScoreNavigation || window.ScoreNavigation;
    window.StorageRepo = StorageRepo || window.StorageRepo;
    window.SystemHost = SystemHost || window.SystemHost;
}
```

> **Note sur l'en-tête des modules dans `www/modules/*.js`** : Pour qu'un module fonctionne simultanément avec `import` sous Vite, `import` sous Vitest (Node) et `vm.runInContext` dans `tests/smoke.test.js`, chaque module peut exposer systématiquement son instance sur `root` *et* sur `module.exports` :
> ```js
> (function (root, factory) {
>     const instance = factory(root);
>     if (typeof root !== 'undefined') root.ModuleName = instance;
>     if (typeof module === 'object' && module.exports) module.exports = instance;
> }(typeof self !== 'undefined' ? self : this, function (root) { ... }));
> ```

#### C. Modifications de `capacitor.config.json`, `package.json` et `.gitignore`

- **[`capacitor.config.json`](../../capacitor.config.json)** : remplacer `"webDir": "www"` (L4) par `"webDir": "dist"`.
- **[`package.json`](../../package.json)** :
  ```json
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "sync": "vite build && npx cap sync android",
    "test": "vitest run",
    "test:watch": "vitest"
  }
  ```
  Et ajouter `"vite": "^8.3.5"` explicite dans `devDependencies` (déjà résolu dans `node_modules`).
- **[`.gitignore`](../../.gitignore)** : ajouter `dist/`.

---

## 2. Inventaire exhaustif de la dette résiduelle de la Spec 1

### 2.1 Termes bannis par `GLOSSARY.md`

Conformément à [`GLOSSARY.md`](../../GLOSSARY.md) :
- **Mode Immersif** / **Vue Séance** / **Lecteur de Partition** / **Mode Live** interdisent le terme `Mode Pupitre` (`pupitre`).
- **Série** et **Calendrier de pratique** interdisent le terme `streak`.
- **Trieur Express** interdit le terme `inbox`.
- **Setlist** interdit le terme `playlist`.

#### A. Terme banni `pupitre` → à remplacer par `immersif` / `immersive`

- **[`www/script.js`](../../www/script.js) (39 occurrences)** :
  - **Variables d'état globales et locales** :
    - `L5807` (niveau global) : `let isPupitreActive = false; let pupitreMode = 'liste';` → renommer en `isImmersiveActive`, `immersiveMode`.
    - `L612` (`declencherFinSeanceAFK`) : `if (isPupitreActive && typeof toggleModePupitre === 'function') toggleModePupitre(false);`
    - `L2577` (`ouvrirModalDictaphone`) : lecture de `isPupitreActive`.
    - `L4895` (`toggleFavori`) : `if (isPupitreActive) { ... }`
    - `L5811` (`setPupitreMode`) : `pupitreMode = mode;`
    - `L5837` (`toggleModePupitre`) : `isPupitreActive = actif;`
    - `L6069` (`majAffichageChrono`) : `if (isPupitreActive && activeTimer.index === index)`
    - `L7534–7536` (`fermerModalImage`) : `const pupitreEnCours = (typeof isPupitreActive !== 'undefined') ? isPupitreActive : false;`
    - `L9805`, `L9821` (`initBackgroundTimers`) : `} else if (isPupitreActive) {`
  - **Fonctions** :
    - `L1318–1328` : `function majBoutonPupitreMetronome()` (appelée en `L923` dans `demarrerMetronome` et `L939` dans `arreterMetronome`) → `majBoutonImmersifMetronome()`.
    - `L2308–2330` : `function majBoutonPupitreAudio()` (appelée en `L2226–2227` dans `mettreAJourCartesAudioStatus`, `L2971` dans `sauvegarderDictaphoneAssocieMorceau`, `L6196` dans `renderShuffleCard`) → `majBoutonImmersifAudio()`.
    - `L2378–2390` : `function majBoutonPupitreDictaphone()` (appelée en `L2565` dans `reinitialiserUIDictaphone`, `L2672` dans `fermerModalDictaphone`, `L2785` dans `demarrerEnregistrementDictaphone`, `L2811` dans `arreterEnregistrementDictaphone`, `L2859` dans `annulerPriseDictaphone`) → `majBoutonImmersifDictaphone()`.
    - `L5810–5815` : `async function setPupitreMode(mode)` (et ses appels dynamiques en `L6142–6143` dans `renderShuffleCard`) → `setImmersiveMode(mode)`.
    - `L5836–5905` : `function toggleModePupitre(actif)` (appelée en `L612`, `L5820` dans `lancerImmersif`, `L5870` bouton quitter, `L5935` dans `terminerExerciceActuel`) → `toggleModeImmersif(actif)`.
  - **Sélecteurs et classes DOM injectés par JS** :
    - `L1319`, `L5862` : `#btn-pupitre-metronome` → `#btn-immersif-metronome`
    - `L2309`, `L5859` : `#btn-pupitre-audio` → `#btn-immersif-audio`
    - `L2379`, `L5856` : `#btn-pupitre-dictaphone` → `#btn-immersif-dictaphone`
    - `L5841`, `L5894` : `document.body.classList.add('mode-pupitre')` / `.remove('mode-pupitre')` → `mode-immersif`
    - `L6141`, `L6172` (`renderShuffleCard`) : classes `.pupitre-mode-switch` et `.pupitre-list-item` → `.immersive-mode-switch` et `.immersive-list-item`.
- **[`www/style.css`](../../www/style.css) (18 occurrences)** :
  - `L1407` : commentaire `--- MODE PUPITRE & SMART SHUFFLE ---`
  - `L1426–1433` : `body.mode-pupitre .nav-bar`, `body.mode-pupitre #titre-date`, `body.mode-pupitre #tonalite`, `body.mode-pupitre #duree-seance-live`, `body.mode-pupitre #fin-seance-container`, `body.mode-pupitre #seance-cadre-global`, `body.mode-pupitre .seance-cadre-global`, `body.mode-pupitre #top-global-actions`
  - `L1437–1438` : commentaire + `body.mode-pupitre .item-card { display: none !important; }`
  - `L1554`, `L1558`, `L1562` : `.pupitre-mode-switch`, `.pupitre-mode-switch button`, `.pupitre-mode-switch button.active`
  - `L1563–1564` : `.pupitre-list-item`, `.pupitre-list-item:last-child`
  - `L2197–2198` : commentaire + `#btn-pupitre-metronome.playing`
- **[`www/index.html`](../../www/index.html)** : 0 occurrence.

#### B. Terme banni `streak` → à remplacer par `serie` (et `calendrierPratique`)

- **[`www/index.html`](../../www/index.html) (19 occurrences)** :
  - `L556–559` : `<div class="stat-card clickable" id="card-stat-streak" ... onclick="ouvrirModalStreak(event)">` et `<div class="stat-value" id="stat-streak">` → `#card-stat-serie`, `ouvrirModalSerie(event)`, `#stat-serie`.
  - `L713–777` (Modale Régularité & Séries) :
    - `L713` : `<div id="modal-streak-detail" ...>` → `#modal-serie-detail`
    - `L716` : `<h3 id="streak-modal-title" ...>` → `#serie-modal-title`
    - `L717`, `L772` : `onclick="fermerModalStreak()"` et `id="streak-modal-btn-close"` → `fermerModalSerie()`, `#serie-modal-btn-close`
    - `L722–723` : `#streak-label-current`, `#streak-modal-current` → `#serie-label-current`, `#serie-modal-current`
    - `L729–730` : `#streak-label-record`, `#streak-modal-record` → `#serie-label-record`, `#serie-modal-record`
    - `L736–737` : `#streak-label-month`, `#streak-modal-month` → `#serie-label-month`, `#serie-modal-month`
    - `L749–750` : `#streak-cal-month-title`, `#streak-cal-month-subtitle` → `#cal-pratique-month-title`, `#cal-pratique-month-subtitle`
    - `L753`, `L756` : `onclick="naviguerMoisStreak(-1)"` / `onclick="naviguerMoisStreak(1)"` → `naviguerMoisCalendrierPratique(...)`
    - `L763`, `L767` : `#streak-cal-weekdays`, `#streak-cal-days` → `#cal-pratique-weekdays`, `#cal-pratique-days`
- **[`www/script.js`](../../www/script.js) (52 occurrences)** :
  - `L3969`, `L4006`, `L4030` (`chargerHistorique`) : écriture dans `document.getElementById('stat-streak')`.
  - `L4011–4031` (`chargerHistorique`) : **code mort / dupliqué** dans le bloc `else` de repli qui recalcule manuellement `let streak = 0` avec `toISOString().split('T')[0]` (UTC au lieu de la date locale) alors que `window.HistoryAnalytics.calculateHistorySummary` est toujours chargé. Ce bloc `else` (`L4008–4032`) doit être supprimé au profit d'un appel direct à `HistoryAnalytics.calculateHistorySummary`.
  - `L4676–4677` : `let streakCalCurrentYear = null; let streakCalCurrentMonth = null;`
  - `L4679–4695` : `function naviguerMoisStreak(delta)` + `window.naviguerMoisStreak`
  - `L4697–4784` : `function renderStreakCalendar()` + `window.renderStreakCalendar` (cible `#streak-cal-month-title`, `#streak-cal-month-subtitle`, `#streak-cal-weekdays`, `#streak-cal-days`)
  - `L4786–4828` : `function ouvrirModalStreak(event)` + `window.ouvrirModalStreak` (cible `#streak-modal-current`, `#streak-modal-record`, `#streak-modal-month`, `#modal-streak-detail`)
  - `L4830–4834` : `function fermerModalStreak()` + `window.fermerModalStreak`
  - `L4846` (`MODAL_BACKDROP_CLOSERS`) : `'modal-streak-detail': () => typeof fermerModalStreak === 'function' && fermerModalStreak()`
- **Impacts croisés à synchroniser** :
  - **[`www/i18n.js`](../../www/i18n.js)** : `L1526–1530` cible les sélecteurs `#streak-modal-title`, `#streak-label-current`, `#streak-label-record`, `#streak-label-month`, `#streak-modal-btn-close` (et clés de dictionnaire `history.*streak*` en `L181–189` et `L805–813`).
  - **[`www/modules/history-analytics.js`](../../www/modules/history-analytics.js)** (`L577`, `L792`, `L866–878`, `L1034–1035`) et **[`tests/history-analytics.test.js`](../../tests/history-analytics.test.js)** (`L125–186`, `L441–460`) : exposent `calculateStreak` et `calculateStreakStats` (peuvent exposer `calculateSerie` / `calculateSerieStats` avec alias de rétrocompatibilité pour les tests existants).

#### C. Terme banni `inbox` → à remplacer par `trieur`

- **[`www/index.html`](../../www/index.html) (6 occurrences)** :
  - `L373` : commentaire `<!-- BOUTON IMPORTER ET TRIER (INBOX ZIP & MULTI-FICHIERS) -->`
  - `L374–375` : `<button type="button" id="btn-inbox-zip-trigger" ... onclick="document.getElementById('input-zip-inbox').click()">` → `#btn-trieur-files-trigger`, `#input-trieur-files`
  - `L384–385` : `<input type="file" id="input-zip-inbox" ... onchange="traiterInboxZip(event)">` → `#input-trieur-files`, `traiterFichiersTrieur(event)`
  - `L1143` : commentaire `<!-- MODALE TRIEUR EXPRESS (INBOX) -->`
- **[`www/script.js`](../../www/script.js) (32 occurrences)** :
  - `L9246` : commentaire `// --- MOTEUR TRIEUR EXPRESS (INBOX & LOTS) ---`
  - `L9252–9254` : `let currentInboxFile = null; let currentInboxBase64Array = []; let currentInboxMime = null;` (manipulées aussi en `L9330`, `L9605–9608`, `L9631`, `L9636`, `L9649`, `L9654`, `L9700–9701`) → `currentTrieurFile`, `currentTrieurBase64Array`, `currentTrieurMime`.
  - `L9261–9319` : `async function traiterInboxZip(event)` (et `L9263` `getElementById('btn-inbox-zip-trigger')`, `L10658` `window.traiterInboxZip = traiterInboxZip`) → `traiterFichiersTrieur(event)`.
  - `L9489–9492` : `function mimeInboxPourExt(ext)` (peut d'ailleurs être remplacée directement par `StorageRepo.mimeFromExtension(ext)` !)
  - `L9494–9499` : `async function lireEntreesInbox(fileInfo)` (appelée en `L9557`, `L9585`, `L9597`, `L9606`) → `lireEntreesTrieur(fileInfo)`.
  - `L9501–9541` : `async function appliquerFichierInbox(...)` (appelée en `L9560`, `L9563`, `L9586`, `L9598`, `L9633`, `L9651`) → `appliquerFichierTrieur(...)`.
- **[`www/style.css`](../../www/style.css) (1 occurrence)** :
  - `L1567` : commentaire `--- TRIEUR EXPRESS (INBOX ZIP) ---`.
- **Impact croisé dans [`www/i18n.js`](../../www/i18n.js)** :
  - `L1441–1442` : `setTitle('#btn-inbox-zip-trigger', ...)` et `setTxt('#btn-inbox-zip-trigger', ...)` à mettre à jour vers `#btn-trieur-files-trigger`.

#### D. Terme banni `playlist` → à remplacer par `setlist`

- **[`www/index.html`](../../www/index.html) (17 occurrences)** :
  - `L434` : `onclick="ouvrirGestionnairePlaylists()"` → `ouvrirGestionnaireSetlists()`
  - `L1092–1140` (Modale Gestionnaire de Setlists) :
    - `L1092` : commentaire `<!-- MODALE GESTIONNAIRE DE PLAYLISTS -->`
    - `L1093` : `<div id="modal-playlist" ...>` → `#modal-setlist`
    - `L1095` : `onclick="fermerModalPlaylist()"` → `fermerModalSetlist()`
    - `L1096` : `<h3 id="titre-modal-playlist" ...>` → `#titre-modal-setlist`
    - `L1101–1102` : `<div id="vue-playlist-liste">` et `<div id="liste-des-playlists-existantes">` → `#vue-setlist-liste`, `#liste-des-setlists-existantes`
    - `L1104` : `onclick="ouvrirEditeurPlaylist(null)"` → `ouvrirEditeurSetlist(null)`
    - `L1112` : `<div id="vue-playlist-editeur" ...>` → `#vue-setlist-editeur`
    - `L1114` : `<input type="text" id="input-playlist-nom" ...>` → `#input-setlist-nom`
    - `L1123–1124` : `<input type="text" id="search-playlist-items" ... oninput="filtrerPlaylistItems(this.value)">` → `#search-setlist-items`, `filtrerSetlistItems(this.value)`
    - `L1127` : `<div id="liste-playlist-items" ...>` → `#liste-setlist-items`
    - `L1133–1134` : `onclick="retourListePlaylists()"` et `<button id="btn-save-playlist" ... onclick="sauvegarderPlaylist()">` → `retourListeSetlists()`, `#btn-save-setlist`, `sauvegarderSetlist()`
  - `L1173`, `L1175` (dans `#modal-trieur`) : classes `playlist-checkbox-item` et `playlist-checkbox-label` → `setlist-checkbox-item`, `setlist-checkbox-label`.
- **[`www/script.js`](../../www/script.js) (71 occurrences)** :
  - `L4850` (`MODAL_BACKDROP_CLOSERS`) : `'modal-playlist': () => typeof fermerModalPlaylist === 'function' && fermerModalPlaylist()`
  - `L5615` (`initShareTarget`), `L5665` & `L5687` (`executerImportIRealPro`) : variables `nomPlaylistDetecte`, `defaultPlaylistName` → `nomSetlistDetecte`, `defaultSetlistName`.
  - `L5698–5803` (Bloc Gestionnaire de Setlists) :
    - `L5700` : `let playlistSelectedIds = new Set(); let playlistEnEdition = null;` → `setlistSelectedIds`, `setlistEnEdition`
    - `L5702–5727` : `function ouvrirGestionnairePlaylists()` → `ouvrirGestionnaireSetlists()`
    - `L5729` : `function fermerModalPlaylist()` → `fermerModalSetlist()`
    - `L5730` : `function retourListePlaylists()` → `retourListeSetlists()`
    - `L5732–5741` : `function ouvrirEditeurPlaylist(nomSetlist)` → `ouvrirEditeurSetlist(nomSetlist)`
    - `L5743–5746` : `window.togglePlaylistItem = function (id, isChecked)` → `window.toggleSetlistItem`
    - `L5748` : `function filtrerPlaylistItems(val)` → `filtrerSetlistItems(val)`
    - `L5750–5767` : `function renderPlaylistItems(query)` (génère `.playlist-checkbox-item`, `.playlist-checkbox`, `.playlist-checkbox-label`) → `renderSetlistItems(query)`
    - `L5769–5788` : `async function sauvegarderPlaylist()` → `sauvegarderSetlist()`
    - `L5790–5802` : `async function supprimerPlaylist(nomSetlist)` → `supprimerSetlist(nomSetlist)`
  - `L6272` (`concertState`) : propriété `playlistNom: ''` (utilisée en `L6355`, `L6546`, `L6618`) → `setlistNom: ''`.
  - `L6294–6367` : paramètres `nomPlaylist` dans `getMorceauxSetlistOrdonnes(nomSetlist)`, `sauvegarderOrdreSetlist(nomSetlist, morceauxIds)`, `lancerModeConcert(item, sessionIndex)` (`let nomSetlist`), `lancerModeConcertDirect(nomSetlist)`.
  - `L9250`, `L9325`, `L9354`, `L9516` (Trieur Express) : `defaultPlaylistName` et `fileInfo.playlistName` → `defaultSetlistName`, `fileInfo.setlistName`.
  - `L10040` (`renderSettingsCategoriesUI`) : clé i18n `settings.playlists_count`.
- **[`www/style.css`](../../www/style.css) (9 occurrences)** :
  - `L1607` : commentaire `--- PLAYLISTS & AUTO-COMPLETE ---`
  - `L1609–1655` : `.playlist-checkbox-item`, `.playlist-checkbox-item:last-child`, `.playlist-checkbox-item:hover`, `.playlist-checkbox-item input[type="checkbox"]`, `.playlist-checkbox-item input[type="checkbox"]:checked`, `.playlist-checkbox-item input[type="checkbox"]:checked::after`, `.playlist-checkbox-label`, `.playlist-checkbox-meta` → `.setlist-checkbox-*`.
- **Impacts croisés à synchroniser** :
  - **[`www/i18n.js`](../../www/i18n.js)** : `L470`, `L1094` (`"settings.playlists_count"`), et `L1484`, `L1577–1585` (`button[onclick="ouvrirGestionnairePlaylists()"]`, `#titre-modal-playlist`, `button[onclick="ouvrirEditeurPlaylist(null)"]`, `#vue-playlist-editeur > label`, `#input-playlist-nom`, `#search-playlist-items`, `button[onclick="retourListePlaylists()"]`, `#btn-save-playlist`).
  - **[`www/modules/library-domain.js`](../../www/modules/library-domain.js)** (`L499`, `L535`) : `parseIRealLink` retourne `{ playlistName, tunes }` (testé dans [`tests/library-ingestion.test.js`](../../tests/library-ingestion.test.js) `L80`, `L99`, `L110`, `L117`, `L125` — conserver `playlistName` en alias de `setlistName` pour ne casser aucun test existant).

---

### 2.2 Appels directs à `window.showSaveFilePicker` contournant `www/modules/system-host.js`

On dénombre **10 occurrences** de `showSaveFilePicker` réparties en **3 blocs** dans [`www/script.js`](../../www/script.js) (0 dans `index.html` et `style.css`) :

| Emplacement dans `www/script.js` | Fonction englobante | Rôle actuel et raison du contournement |
| :--- | :--- | :--- |
| **`L10348–10368`** (lignes exactes : `10348`, `10349`, `10353`, `10366`) | `telechargerFichierSysteme(blob, nomFichier, mime)` (`L10312–10389`) | Appelé par `adapter.saveFile` (`L346`) quand aucun `handle` n'est pré-ouvert, ainsi que par `telechargerBlob` (`L10391`) depuis `telechargerFichierDictaphone` (`L3046`) et `exporterCahierPdf` (`L9213`). |
| **`L10404–10417`** (lignes exactes : `10404`, `10406`, `10415`) | `exporterBackupJson()` (`L10395–10449`) | Ouvre `window.showSaveFilePicker` *avant* l'appel asynchrone `repo.buildBackup(...)` pour ne pas perdre le geste d'activation utilisateur (*transient user activation*) du navigateur, puis passe `{ handle: fileHandle }` à `getSystemHost().saveBackupFile(...)` (`L10432`). |
| **`L10460–10473`** (lignes exactes : `10460`, `10462`, `10471`) | `exporterBackupCompletZip()` (`L10451–10522`) | Même contournement : ouvre `window.showSaveFilePicker` *avant* `repo.buildBackup(...)` + `zip.generateAsync(...)` (qui peut prendre plusieurs secondes), puis passe `{ handle: fileHandle }` à `getSystemHost().saveBackupFile(...)` (`L10505`). |

**Plan de résorption dans [`www/modules/system-host.js`](../../www/modules/system-host.js)** :
1. Enrichir `saveBackupFile(name, blobOrProducer, mime, options)` dans `system-host.js` (`L80–82`) pour accepter soit un `Blob` direct, soit une fonction asynchrone `async () => Blob`, et déléguer l'acquisition préalable du `handle` à une méthode d'adapter optionnelle `adapter.pickSaveHandle({ name, mime })` appelée **avant** l'évaluation de `blobOrProducer()`.
2. Ainsi, `exporterBackupJson()`, `exporterBackupCompletZip()`, `telechargerFichierDictaphone()` (`L3046`) et `exporterCahierPdf()` (`L9213`) appellent uniquement `getSystemHost().saveBackupFile(nomFichier, async () => blob, mime)` sans jamais manipuler `window.showSaveFilePicker` dans le code applicatif.

---

### 2.3 Appels résiduels à `apiFetch` (et accès IndexedDB directs) au lieu de `www/modules/storage-repo.js`

#### A. Les 32 occurrences de `apiFetch` dans `www/script.js` (1 définition + 31 appels)

La fonction `apiFetch(endpoint, options = {})` est définie aux lignes **`L195–288`** (94 lignes). Sur les **31 appels** restants dans `www/script.js` :
- **27 appels** sérialisent inutilement des objets en JSON (`JSON.stringify`) ou appellent une URL REST fictive que `apiFetch` re-parse immédiatement pour appeler `getStorageRepo()`.
- **4 appels** (`L2965`, `L3020`, `L5167`, `L9164`) construisent un `FormData` contenant des instances de `File` uniquement pour que `apiFetch` (`L205–267`) les lise en Base64 via `FileReader` et appelle `sauvegarderFichierLocal`.

| Ligne | Fonction englobante | Appel `apiFetch` actuel | Remplacement direct via `getStorageRepo()` |
| :--- | :--- | :--- | :--- |
| **`L195`** | `apiFetch` (`L195–288`) | Définition du faux routeur HTTP | **Supprimer la fonction `apiFetch`** après migration des 31 appels |
| **`L606`** | `declencherFinSeanceAFK` (`L581`) | `await apiFetch(\`/seances/${seanceEnCours.id}/terminer\`, { method: 'POST', body: payload })` | `await getStorageRepo().finishSession(seanceEnCours.id, { duree: dureeFinaleCorrigee, date_seance: todayStr, items: seanceEnCours.items })` |
| **`L2965`** | `sauvegarderDictaphoneAssocieMorceau` (`L2940`) | `await apiFetch(\`/vocabulaire/${dictaphoneState.targetItemId}\`, { method: 'PUT', body: formData })` | Sauvegarder l'audio via `await getStorageRepo().saveFile(fakeAudioName, dataUrl)` puis `await getStorageRepo().update('vocabulaire', dictaphoneState.targetItemId, { fichier_audio: fakeAudioName })` |
| **`L3020`** | `sauvegarderDictaphoneNouvelItem` (`L2992`) | `await apiFetch('/vocabulaire', { method: 'POST', body: formData })` | `await getStorageRepo().saveFile(fakeAudioName, dataUrl)` puis `await getStorageRepo().create('vocabulaire', { titre, type_item: categorie, sous_categories: sousCat ? [sousCat] : [], fichier_audio: fakeAudioName })` |
| **`L3064`** | `chargerDerniereSeance` (`L3062`) | `let seances = await apiFetch('/seances')` | `let seances = await getStorageRepo().list('seances')` |
| **`L3242`** | `gererClicCarte` (`L3219`) | `await apiFetch(\`/seances/${seanceEnCours.id}\`, { method: 'PUT', body: JSON.stringify(seanceEnCours) })` | `await getStorageRepo().update('seances', seanceEnCours.id, seanceEnCours)` |
| **`L3586`** | `sauvegarderStats` (`L3545`) | `await apiFetch(\`/seances/${seanceEnCours.id}/terminer\`, { method: 'POST', body: payload })` | `await getStorageRepo().finishSession(seanceEnCours.id, { duree: dureeFinaleSeance, date_seance: dateLocaleStr, items: seanceEnCours.items })` |
| **`L3598`** | `ignorerStats` (`L3595`) | `await apiFetch(\`/seances/${seanceEnCours.id}\`, { method: 'DELETE' })` | `await getStorageRepo().remove('seances', seanceEnCours.id)` |
| **`L3884`** | `sauvegarderSeance` (`L3882`) | `await apiFetch(\`/seances/${seanceEnCours.id}\`, { method: 'DELETE' })` | `await getStorageRepo().remove('seances', seanceEnCours.id)` |
| **`L3891`** | `sauvegarderSeance` (`L3882`) | `const cree = await apiFetch('/seances', { method: 'POST', body: JSON.stringify(nouvelleSeance) })` | `const cree = await getStorageRepo().create('seances', nouvelleSeance)` |
| **`L3926`** | `initDragAndDrop` (`L3901`) | `await apiFetch(\`/seances/${seanceEnCours.id}\`, { method: 'PUT', body: JSON.stringify(seanceEnCours) })` | `await getStorageRepo().update('seances', seanceEnCours.id, seanceEnCours)` |
| **`L3955`** | `chargerHistorique` (`L3953`) | `let seances = await apiFetch('/seances')` | `let seances = await getStorageRepo().list('seances')` |
| **`L4041`** | `supprimerSeance` (`L4039`) | `await apiFetch(\`/seances/${id}\`, { method: 'DELETE' })` | `await getStorageRepo().remove('seances', id)` |
| **`L4044`** | `reinitialiserHistorique` (`L4043`) | `await apiFetch('/seances/reset', { method: 'DELETE' })` | `await getStorageRepo().reset('seances')` |
| **`L4889`** | `toggleFavori` (`L4886`) | `const data = await apiFetch(\`/vocabulaire/${id}/favori\`, { method: 'PUT' })` | `const data = await getStorageRepo().toggleFavorite(id)` |
| **`L5167`** | `ajouterVocabulaire` (`L5109`) | `await apiFetch(url, { method: method, body: formData })` | Persister les fichiers via `getStorageRepo().saveFile(...)` puis appeler `getStorageRepo().update('vocabulaire', editVocabId, payload)` ou `getStorageRepo().create('vocabulaire', payload)` |
| **`L5234`** | `chargerVocabulaireApi` (`L5231`) | `let vocab = await apiFetch('/vocabulaire')` | `let vocab = await getStorageRepo().list('vocabulaire')` |
| **`L5528`** | `supprimerVocabulaire` (`L5524`) | `await apiFetch(\`/vocabulaire/${id}\`, { method: 'DELETE' })` | `await getStorageRepo().remove('vocabulaire', id)` |
| **`L5548`** | `chargerRoutinesApi` (`L5547`) | `let routines = await apiFetch('/routines')` | `let routines = await getStorageRepo().list('routines')` |
| **`L5587`** | `sauvegarderRoutineEnBase` (`L5583`) | `await apiFetch('/routines', { method: 'POST', body: JSON.stringify({ nom: nomInput, items: itemsBrouillon }) })` | `await getStorageRepo().create('routines', { nom: nomInput, items: itemsBrouillon })` |
| **`L5593`** | `supprimerRoutine` (`L5593`) | `await apiFetch(\`/routines/${id}\`, { method: 'DELETE' })` | `await getStorageRepo().remove('routines', id)` |
| **`L5693`** | `reinitialiserBibliotheque` (`L5691`) | `await apiFetch('/vocabulaire/reset', { method: 'DELETE' })` | `await getStorageRepo().reset('vocabulaire')` |
| **`L5782`** | `sauvegarderPlaylist` (`L5769`) | `promises.push(apiFetch(\`/vocabulaire/${item.id}\`, { method: 'PUT', body: JSON.stringify(item) }))` | `promises.push(getStorageRepo().update('vocabulaire', item.id, item))` |
| **`L5797`** | `supprimerPlaylist` (`L5790`) | `promises.push(apiFetch(\`/vocabulaire/${item.id}\`, { method: 'PUT', body: JSON.stringify(item) }))` | `promises.push(getStorageRepo().update('vocabulaire', item.id, item))` |
| **`L5944`** | `terminerExerciceActuel` (`L5920`) | `await apiFetch(\`/seances/${seanceEnCours.id}\`, { method: 'PUT', body: JSON.stringify(seanceEnCours) })` | `await getStorageRepo().update('seances', seanceEnCours.id, seanceEnCours)` |
| **`L5974`** | `validerShuffleItem` (`L5965`) | `await apiFetch(\`/vocabulaire/${id}/depratiquer\`, { method: 'PUT' })` | `await getStorageRepo().unpractice(id)` |
| **`L5977`** | `validerShuffleItem` (`L5965`) | `await apiFetch(\`/vocabulaire/${id}/pratiquer\`, { method: 'PUT' })` | `await getStorageRepo().practice(id)` |
| **`L6714`** | `importerFichierPartitionConcert` (`L6690`) | `await apiFetch(\`/vocabulaire/${song.id}\`, { method: 'PUT', body: JSON.stringify(song) })` | `await getStorageRepo().update('vocabulaire', song.id, song)` |
| **`L6743`** | `quitterModeConcert` (`L6734`) | `apiFetch(\`/seances/${seanceEnCours.id}\`, { method: 'PUT', body: JSON.stringify(seanceEnCours) })` | `getStorageRepo().update('seances', seanceEnCours.id, seanceEnCours)` |
| **`L9164`** | `sauvegarderCahierNouvelItem` (`L9134`) | `await apiFetch('/vocabulaire', { method: 'POST', body: formData })` | `await getStorageRepo().saveFile(fileName, pngDataUrl)` puis `await getStorageRepo().create('vocabulaire', { titre, type_item: categorie, sous_categories: sousCat ? [sousCat] : [], fichier_image: [fileName] })` |
| **`L9531`** | `appliquerFichierInbox` (`L9501`) | `const saved = await apiFetch(\`/vocabulaire/${itemCible.id}\`, { method: 'PUT', body: JSON.stringify(merged) })` | `const saved = await getStorageRepo().update('vocabulaire', itemCible.id, merged)` |
| **`L9537`** | `appliquerFichierInbox` (`L9501`) | `const saved = await apiFetch('/vocabulaire', { method: 'POST', body: JSON.stringify(created) })` | `const saved = await getStorageRepo().create('vocabulaire', created)` |

#### B. Accès directs résiduels à `lireLocal` / `ecrireLocal` / `sauvegarderFichierLocal` hors de `getStorageRepo()`

En complément des 31 appels `apiFetch`, **7 emplacements** dans `www/script.js` contournent encore `getStorageRepo()` en appelant les primitives IndexedDB de bas niveau :
1. **`L4142`** (`injecterSeancesDemo`) : `await ecrireLocal('seances', s)` → `await getStorageRepo().put('seances', s)`
2. **`L5824`** (`genererSmartShuffle`) : `const toutVocab = await lireLocal('vocabulaire')` → `const toutVocab = await getStorageRepo().list('vocabulaire')`
3. **`L6710`** (`importerFichierPartitionConcert`) : `await sauvegarderFichierLocal(fileNameToSave, base64)` → `await getStorageRepo().saveFile(fileNameToSave, base64)`
4. **`L8228`** (`chargerAnnotationsPageCourante`) : `const record = await lireLocalId('annotations', cle)` → `const record = await getStorageRepo().getById('annotations', cle)` (attention : dans `storage-repo.js` `L244`, `getById` force aujourd'hui `Number(id)`, alors que les clés d'annotations sont des chaînes `annot_..._p0` ; il faut remplacer `Number(id)` par `id` dans `storage-repo.js` `L244` pour supporter les clés string d'annotations !)
5. **`L8239`** (`sauvegarderAnnotationsPageCourante`) : `await ecrireLocal('annotations', { id: cle, ... })` → `await getStorageRepo().put('annotations', { id: cle, ... })`
6. **`L9172`** (`sauvegarderCahierNouvelItem`) : `await ecrireLocal('annotations', { id: key, ... })` → `await getStorageRepo().put('annotations', { id: key, ... })`
7. **`L9510`** (`appliquerFichierInbox`) : `await sauvegarderFichierLocal(fileNameToSave, ...)` → `await getStorageRepo().saveFile(fileNameToSave, ...)`

---

## 3. Cartographie de `www/script.js` (10 661 lignes) et frontières des modules profonds pour la Spec 2

### 3.1 Répartition actuelle des 10 661 lignes de `www/script.js`

| Plage de lignes | Volume | Domaine fonctionnel | État actuel |
| :--- | :--- | :--- | :--- |
| `L1–495` | 495 l. | IndexedDB bas niveau, migration V3, `sauvegarderFichierLocal`, `apiFetch` (`L195–288`), adapters `getSystemHost` & `getStorageRepo`, bootstrap `DOMContentLoaded` | `StorageRepo` & `SystemHost` extraits, mais `apiFetch` encore présent |
| `L496–801` | 306 l. | Variables d'état globales, icônes SVG inline, wrappers AFK/durée, chargement `localStorage` (Pomodoro, Catégories, Audio) | Pont vers `SessionTimer` |
| `L802–1406` | **605 l.** | **Moteur Audio Web (synthèse notifications) & Métronome Sequencer** (`schedulerMetronome`, buffers audio, clave/accents, Tap Tempo, UI modale) | **100 % dans `script.js`** |
| `L1407–1475` | 69 l. | Routeur de vues principales (`afficherVue`) | Glue UI |
| `L1476–2345` | **870 l.** | **Lecteur Audio & Transcribe!** (`transcribeState`, décodage Web Audio, calcul/rendu Canvas Waveform, drag poignées A-B, vitesse `preservesPitch`) | **100 % dans `script.js`** |
| `L2346–3052` | **707 l.** | **Dictaphone Embarqué** (`dictaphoneState`, `MediaRecorder`, `AnalyserNode` vu-mètre Canvas, liaison morceau / création Item) | **100 % dans `script.js`** |
| `L3053–3931` | 879 l. | Contrôleur UI **Vue Séance** (`afficherSeancePratique`, boucles DOM du chrono/Pomodoro/Pause café) & **Préparation de Séance** (brouillon, drag & drop) | Logique temporelle dans `SessionTimer`, UI dans `script.js` |
| `L3932–4836` | 905 l. | Contrôleur UI **Historique**, instanciation Chart.js, modale Objectif Hebdo & modale Série / Calendrier de pratique | Calculs dans `HistoryAnalytics`, UI/Chart.js dans `script.js` |
| `L4837–5803` | 967 l. | Contrôleur UI **Bibliothèque** (filtres, IntersectionObserver, modale Item), **Routines** (`L5536–5595`), **Share Target / iReal** (`L5597–5690`) & **Setlists** (`L5698–5803`) | Normalisation dans `LibraryDomain`, UI & Routines dans `script.js` |
| `L5804–6199` | 396 l. | Contrôleur UI **Mode Immersif** (`lancerImmersif`, `toggleModePupitre`, `validerShuffleItem`, `renderShuffleCard`) | Tirage dans `LibraryDomain.drawImmersiveQueue`, UI dans `script.js` |
| `L6200–7546` | **1 347 l.** | **Mode Live (Setlists)** (`L6268–6756`, incluant le placeholder de Grille `afficherCarteConcertSansPartition` en `L6633–6680`) & **Lecteur de Partition PDF/Image à triple buffer** (`L6758–7546`) | Machine de pagination dans `ScoreNavigation`, rendu PDF/Live dans `script.js` |
| `L7547–9244` | **1 698 l.** | **Moteur d'Annotation Vectorielle au Stylet** (`L7547–8770` : barre flottante, taille stylo, texte flottant, tracé/gomme/rejet de paume) & **Cahier Manuscrit** (`L8772–9244` : tracé des portées, export PDF) | **100 % dans `script.js`** |
| `L9245–9707` | 463 l. | Contrôleur UI **Trieur Express** (décompression ZIP, préparation, orchestration Rapide/Prudent, bilan) | Appariement/fusion dans `LibraryDomain`, UI/ZIP dans `script.js` |
| `L9708–10661` | 954 l. | Wake Lock, pont Notifications arrière-plan (`L9708–9828`), modale **Paramètres** (Catégories, Thèmes, Pomodoro, Audio `L9830–10307`), **Sauvegarde/Restauration** (`L10308–10616`) & exports `window` | `StorageRepo` & `SystemHost` extraits, UI/ZIP dans `script.js` |

### 3.2 Les 5 nouveaux modules profonds à extraire pour la Spec 2

Pour préparer les fonctionnalités de la Spec 2 tout en réduisant `www/script.js` de plus de 4 500 lignes, voici les **5 frontières naturelles de modules profonds (deep modules)** recommandées :

#### 1. `www/modules/chord-chart.js` — Modèle Harmonique, Décodage de Grille, Transposition & Mode Blindfold
- **Périmètre extrait / remplacé** :
  - Étend le décodage d'en-tête iReal Pro de [`www/modules/library-domain.js`](../../www/modules/library-domain.js) (`parseIRealLink`, `L498–539`) en déchiffrant le corps obfusqué des grilles `irealb://` (désobfuscation par blocs de 50 caractères `obfuscate50`, parsing des mesures, métriques `T44`/`T34`/`T54`, sections `*A`/`*B`, barres de reprise `{`/`}`, alternatives `N1`/`N2`, `S`/`Q`/Coda, accords alternatifs et basse slash).
  - Remplace le placeholder texte `afficherCarteConcertSansPartition` de [`www/script.js`](../../www/script.js) (`L6633–6680`) par un véritable modèle de **Grille** structurée.
- **Interface publique pure (testable sous Vitest sans DOM)** :
  - `decodeIRealProgression(rawUrlOrBody)` → AST canonique de Grille (mesures, temps, accords, symboles de structure).
  - `transposeChart(chartAst, semitonesOrTargetKey, instrumentTransposition)` → transposition exacte respectant l'orthographe enharmonique jazz ($B\flat, E\flat, A\flat, D\flat, G\flat$ vs tonalités dièses) et les instruments transpositeurs ($C / B\flat / E\flat$).
  - `toFunctionalDegrees(chartAst, referenceKey)` → conversion en degrés fonctionnels (`II - V7 - Imaj7`, `bII7`, `#IVm7b5`) avec détection des modulations locales.
  - `applyBlindfoldMask(chartAst, chorusNumber, mode)` → masquage progressif des mesures pour l'entraînement de mémoire (*Blindfold Chart*).
  - `renderChartSVG(chartAst, options)` → génération vectorielle SVG/HTML propre de la Grille.

#### 2. `www/modules/metronome-engine.js` — Moteur Rythmique Web Audio, « Inner Clock » & Drone Harmonique
- **Périmètre extrait de [`www/script.js`](../../www/script.js)** :
  - `L802–1406` (605 lignes : `initAudio`, `jouerSonFinChrono`, `jouerSonApparitionPause`, `jouerSonFinPause`, `obtenirNomTempo`, `demarrerMetronome`, `arreterMetronome`, `schedulerMetronome`, `avancerBeatMetronome`, `planifierNoteMetronome`, `creerBufferAudio`, `assurerBuffersMetronome`, `jouerClicMetronome`, `tapTempoMetronome`, `changerSignatureMetronome`, `reglerUniteMetronome`, `cyclerSlotMetronome`) ainsi que le pulse visuel `L6501–6539` (`demarrerPulseMetronomeVisuel`, `arreterPulseMetronomeVisuel`).
- **Responsabilité en Spec 2** :
  - Séparer la machine à états rythmique pure (séquenceur de mesures, calcul du prochain beat, cycle *Gap Click* : ex. 3 mesures jouées / 1 mesure de silence, modes *2 & 4*, *Et du 4*, *Clave*, *Tempo Ladder* par paliers de mesures, et calcul des fréquences du Drone harmonique sur la Tonalité du jour) de l'`AudioContext` Web Audio (injecté comme adapter).

#### 3. `www/modules/audio-studio.js` — Lecteur Audio Transcribe! (Boucle A-B + Call & Response) & Dictaphone
- **Périmètre extrait de [`www/script.js`](../../www/script.js)** :
  - `L1476–2345` (870 lignes : lecteur audio d'étude, calcul des crêtes `genererWaveformPeaks`, géométrie de la waveform `dessinerWaveformTranscribe`, boucle A-B `poserPointA`/`poserPointB`/`synchroniserLoopAudio`, vitesse `reglerVitesseAudio`).
  - `L2346–3052` (707 lignes : `dictaphoneState`, machine à états d'enregistrement/pause/finalisation, vu-mètre `dessinerVisualiseurMicroNeutre`/`animerVisualiseurMicro`).
- **Responsabilité en Spec 2** :
  - Encapsuler la machine à états de lecture et de boucle incluant le nouveau mode **Call & Response (Auto-Gap Loop)** (lecture du segment $[A, B]$ de durée $\Delta t$, suivie d'une fenêtre de silence/métronome de durée $k \cdot \Delta t$ pour laisser le musicien reproduire la phrase à l'instrument, puis reprise automatique en $A$).
  - Encapsuler la machine à états du Dictaphone avec le flux **Record → Self-Critique** (marqueurs rapides d'auto-écoute post-prise).

#### 4. `www/modules/practice-engine.js` — Routines, Plans, Packs `.jtrpack`, Pratique Entrelacée & Drills
- **Périmètre extrait de [`www/script.js`](../../www/script.js)** :
  - Gestion des **Routines** (`L5536–5595` : `chargerRoutinesApi`, `chargerRoutineDansBrouillon`, `sauvegarderRoutineEnBase`, `supprimerRoutine`), préparation du brouillon de séance (`L3648–3900`), et orchestration des exercices en **Mode Immersif** (`L5804–6199`).
- **Responsabilité en Spec 2** :
  - Algorithme de **Pratique Entrelacée (*Interleaved Practice*)** : découpage et entrelacement automatique d'une liste d'exercices de séance (`[A 15m, B 15m, C 15m]` $\rightarrow$ `[A 5m, B 5m, C 5m] × 3`).
  - Générateur de **Drills** et contraintes créatives (*Hal Crook / Bergonzi Mode* : cycle des 12 tonalités, permutations cellulaires à 4 notes avec soustraction, alternance mesures jouées / mesures de silence).
  - Modèle de **Matrice de Maîtrise (5 couches × 12 tonalités)** et calcul SRS (*Spaced Repetition*) par Item.
  - Validation, import et export des **Packs** pédagogiques (`.jtrpack`) combinant Items, Grilles, Routines et **Plans** multi-séances.

#### 5. `www/modules/score-annotations.js` — Moteur Vectoriel d'Annotation, Occlusion & Cahier Manuscrit
- **Périmètre extrait de [`www/script.js`](../../www/script.js)** :
  - `L7547–8770` (1 224 lignes : géométrie des traits normalisés $[0..1]$, interpolation, hit-testing de la gomme `distancePointSegment` / `effacerAuPoint`, boîtes de texte vectorielles `trouverIdxTexteAnnotationAuPoint`, rejet de paume `togglePalmRejection`, rendu `dessinerStrokeSurContext`).
  - `L8772–9244` (473 lignes : géométrie des portées simples et doubles `dessinerPorteesCahier`, barres de mesures, composition Canvas et génération du flux binaire PDF multi-images `genererCahierPdfBlob`).
- **Responsabilité en Spec 2** :
  - Isoler toute la géométrie vectorielle et la génération PDF/Canvas hors de `script.js`, et supporter les rectangles d'occlusion (*Blindfold PDF / Image Occlusion*) masquant/dévoilant des mesures d'une partition PDF au fil des chorus.
