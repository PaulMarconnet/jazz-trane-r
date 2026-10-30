const DB_NAME = "PianoWorkoutDB";
let localDB = null;

// ==========================================
// --- 1. MOTEUR LOCAL-FIRST ABSOLU       ---
// ==========================================

function initLocalDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 3);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('seances')) db.createObjectStore('seances', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('vocabulaire')) db.createObjectStore('vocabulaire', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('routines')) db.createObjectStore('routines', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('images')) db.createObjectStore('images', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('annotations')) db.createObjectStore('annotations', { keyPath: 'id' });
        };
        request.onsuccess = (event) => { localDB = event.target.result; resolve(); };
        request.onerror = (event) => reject(event.target.error);
    });
}

function lireLocal(store) {
    return new Promise(resolve => {
        if (!localDB || !localDB.objectStoreNames.contains(store)) return resolve([]);
        try {
            localDB.transaction(store, 'readonly').objectStore(store).getAll().onsuccess = e => resolve(e.target.result);
        } catch (e) { resolve([]); }
    });
}

function lireLocalId(store, id) {
    return new Promise(resolve => {
        if (!localDB || !localDB.objectStoreNames.contains(store)) return resolve(null);
        try {
            const req = localDB.transaction(store, 'readonly').objectStore(store).get(id);
            req.onsuccess = e => resolve(e.target.result);
            req.onerror = () => resolve(null);
        } catch (e) { resolve(null); }
    });
}

function ecrireLocal(store, data, action = 'put') {
    return new Promise((resolve, reject) => {
        if (!localDB || !localDB.objectStoreNames.contains(store)) return resolve(data);
        try {
            const tx = localDB.transaction(store, 'readwrite');
            if (action === 'delete') tx.objectStore(store).delete(data).onsuccess = () => resolve();
            else tx.objectStore(store).put(data).onsuccess = () => resolve(data);
            tx.onerror = (e) => reject(e);
        } catch (e) { reject(e); }
    });
}

function viderStore(store) {
    return new Promise(resolve => {
        if (!localDB || !localDB.objectStoreNames.contains(store)) return resolve();
        try {
            localDB.transaction(store, 'readwrite').objectStore(store).clear().onsuccess = () => resolve();
        } catch (e) { resolve(); }
    });
}

const IREAL_STYLES_A_IGNORER = new Set([
    "medium swing", "medium up swing", "up tempo swing", "slow swing", "fast swing", "swing",
    "medium ballad", "ballad", "slow ballad",
    "waltz", "jazz waltz", "medium waltz", "slow waltz",
    "bossa nova", "medium bossa", "bossa", "samba", "latin", "latin swing", "afro-cuban", "bolero", "cha cha",
    "funk", "rock", "pop", "even 8ths", "even 16ths", "calypso", "reggae", "straight 8ths", "rock pop",
    "medium", "slow", "fast", "up tempo", "up", "bop", "hard bop", "bebop", "trad jazz", "fusion"
]);

function estStyleIrealAFiltrer(texte) {
    if (typeof window !== 'undefined' && window.LibraryDomain && typeof window.LibraryDomain.isIrealStyle === 'function') {
        return window.LibraryDomain.isIrealStyle(texte);
    }
    if (!texte || typeof texte !== 'string') return false;
    const clean = texte.trim().toLowerCase();
    if (IREAL_STYLES_A_IGNORER.has(clean)) return true;
    return /(swing|ballad|bossa|waltz|latin|samba|afro|funk|rock|pop|even\s*8|even\s*16|straight|shuffle|calypso|reggae|bolero|rumba|tango|choche|dixie|fusion|bop|tempo)/i.test(clean);
}

function estTonaliteValide(str) {
    if (typeof window !== 'undefined' && window.LibraryDomain && typeof window.LibraryDomain.isValidTonalite === 'function') {
        return window.LibraryDomain.isValidTonalite(str);
    }
    if (!str || typeof str !== 'string') return false;
    const clean = str.trim();
    if (estStyleIrealAFiltrer(clean)) return false;
    const regexTona = /^[A-Ga-g][b#♭♯]?(?:\s*(?:m|min|mineur|maj|majeur|minor|major|-|\+|m7|Δ|o))?$/i;
    return regexTona.test(clean);
}

async function migrerDonneesV3() {
    const items = await lireLocal('vocabulaire');
    let modifications = 0;
    for (let item of items) {
        if (typeof window !== 'undefined' && window.LibraryDomain && typeof window.LibraryDomain.normalizeItem === 'function') {
            const normalized = window.LibraryDomain.normalizeItem(item);
            if (JSON.stringify(normalized) !== JSON.stringify(item)) {
                await ecrireLocal('vocabulaire', normalized, 'put');
                modifications++;
            }
            continue;
        }
        let changed = false;
        if (item.nom && !item.titre) {
            const typeItem = item.type_item === "Standards" || item.type_item === "Thèmes" ? "Morceaux" : item.type_item;
            item.titre = item.nom;
            delete item.nom;
            item.type_item = typeItem;
            item.ireal_data = item.ireal_data || { grille: null, tona_origine: null };
            item.stats = item.stats || { nb_pratiques: item.nb_pratiques || 0, date_derniere_pratique: null };
            changed = true;
        }

        if (changed) {
            await ecrireLocal('vocabulaire', item, 'put');
            modifications++;
        }
    }

    // Assainissement absolu du store 'seances' (éradication des séances zombies)
    try {
        const toutesSeances = await lireLocal('seances');
        const dateAujourdhui = new Date().toISOString().split('T')[0];
        if (Array.isArray(toutesSeances)) {
            safeSortSeances(toutesSeances);
            for (let i = 0; i < toutesSeances.length; i++) {
                const s = toutesSeances[i];
                let changedSeance = false;
                const tousItemsFaits = s.items && s.items.length > 0 && s.items.every(it => it.fait);
                const sansItems = !s.items || s.items.length === 0;

                // 1. Toute séance sans statut défini doit être terminée
                if (!s.statut) {
                    s.statut = 'terminee';
                    changedSeance = true;
                }
                // 2. Normalisation de l'ID (suppression des clés string dupliquées)
                if (typeof s.id === 'string' && !isNaN(Number(s.id))) {
                    try { await ecrireLocal('seances', s.id, 'delete'); } catch (e) { }
                    s.id = Number(s.id);
                    changedSeance = true;
                }
                // 3. Toute séance antérieure à aujourd'hui, ou tous items faits, ou sans items => terminée
                if (s.statut !== 'terminee' && (s.date_seance !== dateAujourdhui || tousItemsFaits || sansItems)) {
                    s.statut = 'terminee';
                    changedSeance = true;
                }
                // 4. Si ce n'est pas la première séance la plus récente, elle ne peut être 'en_cours'
                if (s.statut === 'en_cours' && i > 0) {
                    s.statut = 'terminee';
                    changedSeance = true;
                }
                if (changedSeance) {
                    await ecrireLocal('seances', s, 'put');
                }
            }
        }
    } catch (e) { }
}

// ==========================================
// --- SYSTÈME DE FICHIERS HYBRIDE        ---
// ==========================================

async function sauvegarderFichierLocal(nomFichier, base64Data) {
    if (window.Capacitor && Capacitor.isNativePlatform()) {
        const Filesystem = Capacitor.Plugins.Filesystem;
        const base64Clean = base64Data.split(',')[1];
        await Filesystem.writeFile({ path: nomFichier, data: base64Clean, directory: 'DATA' });
        return nomFichier;
    } else {
        await ecrireLocal('images', { id: nomFichier, base64: base64Data });
        return nomFichier;
    }
}

async function getFichierUrl(nomFichier) {
    if (window.Capacitor && Capacitor.isNativePlatform()) {
        const Filesystem = Capacitor.Plugins.Filesystem;
        try {
            const stat = await Filesystem.getUri({ path: nomFichier, directory: 'DATA' });
            return Capacitor.convertFileSrc(stat.uri);
        } catch (e) { return null; }
    } else {
        // CORRECTION : On ne charge QUE l'image demandée, pas toute la base de données
        const cachedImg = await lireLocalId('images', nomFichier);
        return cachedImg ? cachedImg.base64 : null;
    }
}

async function apiFetch(endpoint, options = {}) {
    const method = options.method || 'GET';
    const urlClean = endpoint.split('?')[0];
    const urlParts = urlClean.split('/').filter(p => p);
    const resource = urlParts[0];
    const id = urlParts.length > 1 ? urlParts[1] : null;
    const action = urlParts.length > 2 ? urlParts[2] : null;

    let parsedBody = {};
    if (options.body && typeof options.body === 'string') { try { parsedBody = JSON.parse(options.body); } catch (e) { } }
    else if (options.body instanceof FormData) {
        parsedBody = Object.fromEntries(options.body.entries());
        const files = options.body.getAll('fichiers');
        
        if (files && files.length > 0 && files[0].size > 0) {
            let savedFileNames = [];
            
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const base64 = await new Promise((res, rej) => {
                    const reader = new FileReader(); reader.readAsDataURL(file);
                    reader.onload = () => res(reader.result); reader.onerror = e => rej(e);
                });
                
                const extension = file.name.split('.').pop();
                const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
                const suffix = files.length > 1 ? `_${i + 1}` : '';
                const fakeFileName = `file_${Date.now()}_${cleanName}${suffix}.${extension}`;
                
                await sauvegarderFichierLocal(fakeFileName, base64);
                savedFileNames.push(fakeFileName);
            }
            // On sauvegarde le tableau multi-pages directement
            parsedBody.fichier_image = savedFileNames;
        }
        delete parsedBody.fichiers;

        // Gestion de l'audio associé (Jalon 9)
        const audioFiles = options.body.getAll('fichier_audio');
        if (audioFiles && audioFiles.length > 0 && audioFiles[0].size > 0) {
            const audioFile = audioFiles[0];
            const base64 = await new Promise((res, rej) => {
                const reader = new FileReader(); reader.readAsDataURL(audioFile);
                reader.onload = () => res(reader.result); reader.onerror = e => rej(e);
            });
            const extension = audioFile.name.split('.').pop();
            const cleanName = audioFile.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
            const fakeAudioName = `audio_${Date.now()}_${cleanName}.${extension}`;
            await sauvegarderFichierLocal(fakeAudioName, base64);
            parsedBody.fichier_audio = fakeAudioName;
        }
        if (options.body.get('supprimer_audio') === 'true') {
            parsedBody.fichier_audio = null;
        }
        if (options.body.get('supprimer_partition') === 'true') {
            parsedBody.fichier_image = [];
        }
        if (parsedBody.sous_categories_json !== undefined) {
            try {
                const parsedSc = JSON.parse(parsedBody.sous_categories_json);
                if (Array.isArray(parsedSc)) parsedBody.sous_categories = parsedSc;
            } catch (e) { }
            delete parsedBody.sous_categories_json;
        }
        parsedBody.attributs = {
            compositeur: parsedBody.compositeur || null,
            style: parsedBody.style || null,
            tonalite: parsedBody.tonalite || null,
            tempo: parsedBody.tempo || null
        };
        delete parsedBody.supprimer_audio;
        delete parsedBody.supprimer_partition;
    }

    const repo = getStorageRepo();
    if (method === 'GET') return (await repo.list(resource)) || [];
    if (method === 'DELETE') return id === 'reset' ? repo.reset(resource) : repo.remove(resource, id);
    if (resource === 'seances' && action === 'terminer') return repo.finishSession(id, parsedBody);
    if (resource === 'vocabulaire' && action === 'pratiquer') return repo.practice(id);
    if (resource === 'vocabulaire' && action === 'depratiquer') return repo.unpractice(id);
    if (resource === 'vocabulaire' && action === 'favori') return (await repo.toggleFavorite(id)) || {};
    if (method === 'POST') return repo.create(resource, parsedBody);
    if (method === 'PUT') {
        if (resource === 'vocabulaire' && options.body instanceof FormData) {
            const existant = await repo.getById(resource, id);
            if (existant) {
                if (parsedBody.fichier_image === undefined && options.body.get('supprimer_partition') !== 'true') parsedBody.fichier_image = existant.fichier_image;
                if (parsedBody.fichier_audio === undefined && options.body.get('supprimer_audio') !== 'true') parsedBody.fichier_audio = existant.fichier_audio;
            }
        }
        return repo.update(resource, id, parsedBody);
    }
    return {};
}

// Dépôt de persistance (module storage-repo) : seam stores IndexedDB + seam fichiers (Filesystem Android / IndexedDB Web)
let _storageRepo = null;
// Dépôt système hôte (module system-host) : notifications, sauvegardes SAF/Picker, micro & permissions
let _systemHost = null;
function getSystemHost() {
    if (_systemHost) return _systemHost;
    const estNatif = () => !!(window.Capacitor && Capacitor.isNativePlatform());
    const adapter = {
        scheduleNotification: async (spec) => {
            if (estNatif()) {
                const { LocalNotifications } = Capacitor.Plugins;
                await LocalNotifications.schedule({
                    notifications: [{
                        id: spec.id,
                        title: spec.title,
                        body: spec.body,
                        schedule: { at: spec.at, allowWhileIdle: true },
                        channelId: spec.channelId || 'timer_alerts',
                        smallIcon: spec.smallIcon || 'ic_stat_jazz_traner',
                        iconColor: spec.color || '#e3a24a'
                    }]
                });
            } else if ('Notification' in window && Notification.permission === 'granted') {
                const delayMs = spec.at.getTime() - Date.now();
                if (delayMs > 0) {
                    window._webNotifHostTimer = setTimeout(() => {
                        try {
                            new Notification(spec.title, { body: spec.body });
                        } catch (e) { }
                    }, delayMs);
                }
            }
        },
        cancelNotification: async (id) => {
            if (window._webNotifHostTimer) {
                clearTimeout(window._webNotifHostTimer);
                window._webNotifHostTimer = null;
            }
            if (estNatif()) {
                try {
                    const { LocalNotifications } = Capacitor.Plugins;
                    await LocalNotifications.cancel({ notifications: [{ id }] });
                } catch (e) { }
            }
        },
        saveFile: async ({ name, blob, mime, handle }) => {
            if (handle && typeof handle.createWritable === 'function') {
                try {
                    const writable = await handle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                    return true;
                } catch (err) {
                    console.warn("Écriture via FileSystemFileHandle a échoué, repli :", err);
                }
            }
            return telechargerFichierSysteme(blob, name, mime);
        },
        checkMicrophone: async () => {
            if (window.NativeSystemBridge && typeof window.NativeSystemBridge.checkMicrophone === 'function') {
                return window.NativeSystemBridge.checkMicrophone();
            }
            return true;
        },
        requestMicrophone: () => {
            return new Promise((resolve) => {
                if (window.NativeSystemBridge && typeof window.NativeSystemBridge.requestMicrophone === 'function') {
                    window.onNativeMicResult = (res) => {
                        window.onNativeMicResult = null;
                        resolve(res);
                    };
                    window.NativeSystemBridge.requestMicrophone();
                } else {
                    resolve('granted');
                }
            });
        },
        openAppSettings: async () => {
            if (window.NativeSystemBridge && typeof window.NativeSystemBridge.openAppSettings === 'function') {
                window.NativeSystemBridge.openAppSettings();
            }
        }
    };

    _systemHost = window.SystemHost.createHost({
        adapter,
        getVisibility: () => document.visibilityState,
        isNotificationsEnabled: () => sontNotificationsActivees()
    });
    return _systemHost;
}

function sontNotificationsActivees() {
    return localStorage.getItem('piano_workout_notifications_timer') !== 'false';
}

function toggleNotificationsSysteme() {
    const act = !sontNotificationsActivees();
    localStorage.setItem('piano_workout_notifications_timer', act ? 'true' : 'false');
    majToggleNotificationsUI();
    if (!act && typeof getSystemHost === 'function') {
        getSystemHost().disarmTimerNotification();
    }
}

function majToggleNotificationsUI() {
    const sw = document.getElementById('btn-toggle-notifications-systeme');
    if (!sw) return;
    const act = sontNotificationsActivees();
    if (act) {
        sw.classList.add('on');
        sw.setAttribute('aria-checked', 'true');
    } else {
        sw.classList.remove('on');
        sw.setAttribute('aria-checked', 'false');
    }
}

function ouvrirModalMicPermission() {
    const modal = document.getElementById('modal-mic-permission');
    if (modal) modal.style.display = 'flex';
}

function fermerModalMicPermission() {
    const modal = document.getElementById('modal-mic-permission');
    if (modal) modal.style.display = 'none';
}

async function ouvrirParametresAndroidApp() {
    fermerModalMicPermission();
    if (typeof getSystemHost === 'function') {
        await getSystemHost().openAppSettings();
    }
}

function getStorageRepo() {
    if (_storageRepo) return _storageRepo;
    const estNatif = () => !!(window.Capacitor && Capacitor.isNativePlatform());
    _storageRepo = window.StorageRepo.createRepo({
        domain: window.LibraryDomain,
        store: {
            getAll: async (name) => (await lireLocal(name)) || [],
            getById: async (name, id) => (await lireLocalId(name, id)) || null,
            put: (name, obj) => ecrireLocal(name, obj, 'put'),
            delete: (name, id) => ecrireLocal(name, id, 'delete'),
            clear: (name) => viderStore(name)
        },
        files: {
            write: (name, dataUrl) => sauvegarderFichierLocal(name, dataUrl),
            read: async (name) => {
                if (estNatif()) {
                    const r = await Capacitor.Plugins.Filesystem.readFile({ path: name, directory: 'DATA' });
                    return r && r.data ? `data:${window.StorageRepo.mimeFromExtension(name.split('.').pop())};base64,${r.data}` : null;
                }
                const img = await lireLocalId('images', name);
                return img ? img.base64 : null;
            },
            list: async () => estNatif() ? [] : ((await lireLocal('images')) || []).map(i => i.id)
        }
    });
    return _storageRepo;
}

document.addEventListener("DOMContentLoaded", async () => {
    const btnRetourInit = document.getElementById('btn-nav-retour');
    if (btnRetourInit) {
        btnRetourInit.style.setProperty('display', 'none', 'important');
        btnRetourInit.classList.add('hidden');
    }
    const btnCafeInit = document.getElementById('btn-pause-cafe');
    if (btnCafeInit) {
        btnCafeInit.style.setProperty('display', 'none', 'important');
        btnCafeInit.classList.add('hidden');
    }
    try { if (typeof appliquerTraductionsDOM === 'function') appliquerTraductionsDOM(); } catch (e) { }
    try { initDraggableAnnotationToolbar(); } catch (e) { }
    try { chargerThemeConfig(); } catch (e) { }
    try { await initLocalDB(); } catch (e) { }
    try { await migrerDonneesV3(); } catch (e) { }
    try { chargerCategoriesConfig(); chargerPomodoroConfig(); chargerAudioConfig(); majAffichageTonaliteCreationUI(); } catch (e) { }
    try { await initNotifications(); initBackgroundTimers(); initShareTarget(); } catch (e) { }
    initCreationUI(); initBibliothequeUI();
    try { initDragAndDrop(); } catch (e) { }
    try { await chargerVocabulaireApi(); } catch (e) { }
    try { await chargerRoutinesApi(); } catch (e) { }
    try { await chargerDerniereSeance(); } catch (e) { afficherVue('historique'); }
    try { if (typeof verifierPremierLancementLangue === 'function') verifierPremierLancementLangue(); } catch (e) { }
    setInterval(() => { majAffichageDureeLive(); verifierAFK(); }, 1000);
});

function initCreationUI() {
    const container = document.getElementById('chips-categorie');
    if (!container) return;
    container.innerHTML = "";
    for (const cat in SOUS_CATEGORIES) {
        container.innerHTML += `<button type="button" class="chip btn-action btn-ghost-neutral" onclick="selectChip('categorie', '${cat}')">${cat}</button>`;
    }
    const inputCat = document.getElementById('input-categorie');
    if (inputCat) inputCat.value = "";
    const containerSous = document.getElementById('chips-sous-categorie');
    if (containerSous) containerSous.innerHTML = "";
    const inputSousCat = document.getElementById('input-sous-categorie');
    if (inputSousCat) inputSousCat.value = "";
    majAffichageTonaliteCreationUI();
}

// ==========================================
// --- VARIABLES GLOBALES ET SVG          ---
// ==========================================
let seanceEnCours = null; let itemsBrouillon = []; let sortableBrouillon = null; let sortablePratique = null;
let editVocabId = null; let editDraftIndex = null; let vocabulaireCache = (typeof window !== 'undefined' && Array.isArray(window.vocabulaireCache)) ? window.vocabulaireCache : []; let licksPratiquesSession = new Set();
if (typeof window !== 'undefined') {
    window.setVocabulaireCache = function(v) { vocabulaireCache = v; window.vocabulaireCache = v; };
    window.vocabulaireCache = vocabulaireCache;
}
let currentFilterBiblio = 'Toutes'; let currentSortBiblio = 'nom_asc'; let searchQueryBiblio = '';
let showFavBiblio = false; let routinesCache = [];

// --- GESTION DU TEMPS RÉEL ET DÉTECTEUR AFK ---
let dernierInteractionTimestamp = Date.now();
function resetDerniereInteraction() { dernierInteractionTimestamp = Date.now(); }
['pointerdown', 'keydown', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, resetDerniereInteraction, { passive: true });
});

// Relâchement du focus persistant sur les boutons après un tap tactile (évite l'état collé sur tablette)
window.addEventListener('touchend', function (e) {
    const btn = e.target && e.target.closest ? e.target.closest('button, .btn-action') : null;
    if (btn && typeof btn.blur === 'function') {
        setTimeout(() => btn.blur(), 60);
    }
}, { passive: true });
const AFK_LIMIT_SECONDS = 3600; // 1 heure d'inactivité

function formaterDureeSeance(secondes) {
    if (typeof window !== 'undefined' && window.SessionTimer && typeof window.SessionTimer.formaterDureeSeance === 'function') {
        return window.SessionTimer.formaterDureeSeance(secondes);
    }
    const s = Math.max(0, Math.floor(secondes));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) {
        return `${h}h${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function calculerDureeReelleSeance(seance = seanceEnCours) {
    if (typeof window !== 'undefined' && window.SessionTimer && typeof window.SessionTimer.calculateSessionRealDuration === 'function') {
        return window.SessionTimer.calculateSessionRealDuration(seance);
    }
    if (!seance || !seance.timestamp_debut) return 0;
    const now = Date.now();
    let pauseMs = Number(seance.temps_pause_cumule_ms || 0);
    if (seance.pause_active_debut) {
        pauseMs += (now - seance.pause_active_debut);
    }
    const totalMs = (now - seance.timestamp_debut) - pauseMs;
    return Math.max(0, Math.floor(totalMs / 1000));
}

function majAffichageDureeLive() {
    const el = document.getElementById('texte-duree-seance-live');
    const badge = document.getElementById('duree-seance-live');
    if (!el || !badge) return;
    if (!seanceEnCours || !seanceEnCours.timestamp_debut) {
        badge.style.display = 'none';
        return;
    }
    badge.style.display = 'inline-flex';
    const sec = calculerDureeReelleSeance();
    el.textContent = formaterDureeSeance(sec);
}

function sauvegarderEtatSeance() {
    if (!seanceEnCours) return;
    try {
        localStorage.setItem('seance_active_' + seanceEnCours.id, JSON.stringify({
            timestamp_debut: seanceEnCours.timestamp_debut,
            temps_pause_cumule_ms: seanceEnCours.temps_pause_cumule_ms || 0,
            pause_active_debut: seanceEnCours.pause_active_debut || null
        }));
    } catch (e) { }
}

function nettoyerStockageSeance(id) {
    localStorage.removeItem('session_time_' + id);
    localStorage.removeItem('seance_active_' + id);
}

async function declencherFinSeanceAFK() {
    if (!seanceEnCours) return;
    console.warn("Jazz Trane'R - Détecteur AFK activé : clôture automatique de la séance après 1h d'inactivité en dépassement.");

    if (activeTimer.interval) clearInterval(activeTimer.interval);
    activeTimer.isPaused = true;
    stopMetronome();

    if (activeTimer.index !== null && seanceEnCours.items && seanceEnCours.items[activeTimer.index]) {
        const item = seanceEnCours.items[activeTimer.index];
        item.fait = true;
        item.isOvertime = false;
        item.temps_restant = 0;
        item.duree_reelle_secondes = Number(item.temps_prevu || 0) * 60;
    }

    const dureeBrute = calculerDureeReelleSeance();
    const dureeFinale = Math.max(0, dureeBrute - AFK_LIMIT_SECONDS);

    try {
        const payload = JSON.stringify({
            duree: Math.round(dureeFinale),
            date_seance: seanceEnCours.date_seance,
            items: seanceEnCours.items
        });
        await apiFetch(`/seances/${seanceEnCours.id}/terminer`, { method: 'POST', body: payload });
        nettoyerStockageSeance(seanceEnCours.id);
    } catch (err) {
        console.error("Erreur clôture AFK :", err);
    }

    if (isPupitreActive && typeof toggleModePupitre === 'function') toggleModePupitre(false);
    alert(t('practice.afk_alert'));
    terminerEtReinitialiser('sauvegardee');
}

function verifierAFK() {
    if (!seanceEnCours || activeTimer.index === null) return;
    if (!activeTimer.isOvertime || activeTimer.isPaused) return;

    const now = Date.now();
    const tempsInactiviteSec = Math.floor((now - dernierInteractionTimestamp) / 1000);
    const tempsOvertimeSec = activeTimer.overtimeStartTime ? Math.floor((now - activeTimer.overtimeStartTime) / 1000) : 0;

    if (tempsInactiviteSec >= AFK_LIMIT_SECONDS && tempsOvertimeSec >= AFK_LIMIT_SECONDS) {
        declencherFinSeanceAFK();
    }
}

function chargerPomodoroConfig() {
    try {
        const stored = localStorage.getItem('piano_workout_pomodoro');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && typeof parsed.workMinutes === 'number' && typeof parsed.breakMinutes === 'number') {
                return parsed;
            }
        }
    } catch (e) { }
    return { workMinutes: 50, breakMinutes: 5 };
}

function getPomodoroWorkSec() {
    const config = chargerPomodoroConfig();
    return Math.max(1, config.workMinutes || 50) * 60;
}

function getPomodoroBreakSec() {
    const config = chargerPomodoroConfig();
    return Math.max(1, config.breakMinutes || 5) * 60;
}

let globalTimerData = { remaining: getPomodoroWorkSec(), isRunning: false, isBreakPending: false, endTime: null, interval: null };
let breakTimerData = { interval: null, endTime: null };

const CATEGORIES_DEFAUT = (typeof getCategoriesDefautPourLangue === 'function')
    ? getCategoriesDefautPourLangue()
    : {
        "Voicings": ["II V I majeur", "II V I mineur", "Mineur", "Majeur", "Dominante", "Diminué", "Drop 2", "So What", "Autres"],
        "Patterns": ["Majeur", "Mineur", "Dominante", "Pentatonique", "Diminué", "Autres"],
        "Licks": ["II V I majeur", "II V I mineur", "I VI II V", "Blues", "Autres"],
        "Morceaux": [],
        "Relevés": [],
        "Technique": ["Gammes majeures", "Gammes mineures", "Gammes dominantes", "Hanon", "Autres"]
    };

let SOUS_CATEGORIES = JSON.parse(JSON.stringify(CATEGORIES_DEFAUT));
if (typeof window !== 'undefined') {
    window.CATEGORIES_DEFAUT = CATEGORIES_DEFAUT;
    window.SOUS_CATEGORIES = SOUS_CATEGORIES;
    window.estStyleIrealAFiltrer = estStyleIrealAFiltrer;
    window.estTonaliteValide = estTonaliteValide;
}

function chargerCategoriesConfig() {
    try {
        const stocke = localStorage.getItem('piano_workout_categories');
        if (stocke) {
            const parsed = JSON.parse(stocke);
            if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                delete parsed['Concert'];
                delete parsed['Projets'];
                delete parsed['Projects'];
                SOUS_CATEGORIES = parsed;
                if (typeof window !== 'undefined') window.SOUS_CATEGORIES = SOUS_CATEGORIES;
                return SOUS_CATEGORIES;
            }
        }
    } catch (e) {
        console.warn("Erreur chargement catégories :", e);
    }
    const defCats = (typeof getCategoriesDefautPourLangue === 'function')
        ? getCategoriesDefautPourLangue()
        : CATEGORIES_DEFAUT;
    SOUS_CATEGORIES = JSON.parse(JSON.stringify(defCats));
    if (typeof window !== 'undefined') window.SOUS_CATEGORIES = SOUS_CATEGORIES;
    return SOUS_CATEGORIES;
}

function sauvegarderCategoriesConfig(nouvellesCategories) {
    SOUS_CATEGORIES = nouvellesCategories;
    if (typeof window !== 'undefined') window.SOUS_CATEGORIES = SOUS_CATEGORIES;
    localStorage.setItem('piano_workout_categories', JSON.stringify(SOUS_CATEGORIES));
    initCreationUI();
    initBibliothequeUI();
    if (typeof initChipsTrieur === 'function') initChipsTrieur();
    renderSettingsCategoriesUI();
}

function getCategorieParDefaut() {
    if (typeof getNomCategorieMorceaux === 'function') {
        const nomM = getNomCategorieMorceaux(SOUS_CATEGORIES);
        if (SOUS_CATEGORIES && Object.prototype.hasOwnProperty.call(SOUS_CATEGORIES, nomM)) return nomM;
    }
    const keys = Object.keys(SOUS_CATEGORIES);
    if (keys.includes('Morceaux')) return 'Morceaux';
    if (keys.includes('Tunes')) return 'Tunes';
    return keys[0] || (typeof getCurrentLang === 'function' && getCurrentLang() === 'en' ? 'Tunes' : 'Morceaux');
}

function chargerAudioConfig() {
    try {
        const stored = localStorage.getItem('piano_workout_audio');
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.theme) return parsed;
        }
    } catch (e) { }
    return { theme: 'jazz', volume: 0.8, metronomeTheme: 'bois' };
}

let activeTimer = { index: null, interval: null, endTime: null, overtimeStartTime: null, remainingSecsAtPause: 0, isOvertime: false, isPaused: false };
let audioContext = null;
let metronome = {
    isPlaying: false,
    tempo: 120,
    signature: 4,
    unit: 4, // 4 (noire) ou 8 (croche)
    slots: [2, 1, 1, 1], // Niveau 2 = Fort, 1 = Faible, 0 = Muet
    currentBeat: 0,
    theme: 'bois',
    nextNoteTime: 0.0,
    timerWorker: null,
    currentBtn: null,
    tapTimes: []
};
let metronomeState = metronome;

const svgNoteNoire = `<svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor; margin-right: 2px;"><circle cx="9" cy="18" r="3.5"/><path d="M12.5 18V4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`;
const svgNoteCroche = `<svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor; margin-right: 2px;"><circle cx="9" cy="18" r="3.5"/><path d="M12.5 18V4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path d="M12.5 4c2.5 1 4.5 2.5 5.5 6.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`;

const svgPauseSquare = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; margin: 0; fill: currentColor;"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
const svgPlaySquare = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; margin: 0; fill: currentColor; margin-left: 2px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
const svgMetronome = `<svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; margin-right: 4px;"><path d="M12 11.4V9.1"/><path d="m12 17 6.59-6.59"/><path d="m15.05 5.7-.218-.691a3 3 0 0 0-5.663 0L4.418 19.695A1 1 0 0 0 5.37 21h13.253a1 1 0 0 0 .951-1.31L18.45 16.2"/><circle cx="20" cy="9" r="2"/></svg>`;
const svgMetronomeActive = `<svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; margin-right: 4px;"><path d="M12 11.4V9.1"/><path d="m12 17-6.59-6.59"/><path d="m15.05 5.7-.218-.691a3 3 0 0 0-5.663 0L4.418 19.695A1 1 0 0 0 5.37 21h13.253a1 1 0 0 0 .951-1.31L18.45 16.2"/><circle cx="4" cy="9" r="2"/></svg>`;
const svgSave = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; margin-right: 8px;"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/></svg>`;
const svgSaveCheck = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; margin-right: 8px;"><path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/><path d="m9 15 2 2 4-4"/></svg>`;
const svgTick = `<svg viewBox="0 0 16 16" style="width: 16px; height: 16px; fill: currentColor; margin-right: 8px;"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path></svg>`;
const svgTickNoMargin = `<svg viewBox="0 0 16 16" style="width: 16px; height: 16px; fill: currentColor; margin: 0;"><path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"></path></svg>`;
const svgTrash = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; margin: 0;"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
const svgPencil = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; margin: 0;"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
const svgStarOutline = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; margin: 0;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
const svgStarFilled = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: currentColor; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; margin: 0;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
const svgHeartOutline = svgStarOutline;
const svgHeartFilled = svgStarFilled;

// SVGs Audio & Transcribe! (Jalon 9)
const svgPlay = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; margin: 0; fill: currentColor; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round;"><polygon points="6 4 20 12 6 20 6 4"/></svg>`;
const svgPause = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; margin: 0; fill: currentColor; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round;"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
const svgAudioPlay = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; margin: 0; fill: currentColor; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round;"><polygon points="6 4 20 12 6 20 6 4"/></svg>`;
const svgRewind5 = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; margin: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/></svg>`;
const svgForward5 = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; margin: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="M13 17l5-5-5-5M6 17l5-5-5-5"/></svg>`;
const svgLoop = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; margin: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>`;
const svgAudio = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; margin: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`;
const svgVolume = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; margin: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
const svgVolumeMute = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; margin: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;

function formatDureeHistorique(minutes) {
    if (minutes === 0) return "0 min"; if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h${(minutes % 60).toString().padStart(2, '0')}`;
}
function formatTonalite(tonalite) {
    if (!tonalite) return "";
    let res = tonalite.replace(/♭/g, 'b').replace(/♯/g, '#');
    res = res.replace(/^([A-Ga-g][b#]?)-$/, '$1m');
    if (typeof getCurrentLang === 'function' && getCurrentLang() === 'en') {
        res = res.replace(/\bmajeur\b/gi, 'major').replace(/\bmineur\b/gi, 'minor');
    } else {
        res = res.replace(/\bmajor\b/gi, 'majeur').replace(/\bminor\b/gi, 'mineur');
    }
    return res;
}
function formaterTemps(secondes) {
    if (typeof window !== 'undefined' && window.SessionTimer && typeof window.SessionTimer.formaterTemps === 'function') {
        return window.SessionTimer.formaterTemps(secondes);
    }
    if (!Number.isFinite(secondes) || isNaN(secondes) || secondes < 0) return "0:00";
    const sec = Math.floor(secondes);
    return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
}

function initAudio() { if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)(); if (audioContext.state === 'suspended') audioContext.resume(); }

function jouerSonFinChrono() {
    initAudio();
    const config = chargerAudioConfig();
    const vol = config.volume !== undefined ? config.volume : 0.8;
    if (vol <= 0) return;
    const now = audioContext.currentTime;

    if (config.theme === 'jazz') {
        const chord = [261.63, 329.63, 392.00, 493.88, 587.33];
        chord.forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain); gain.connect(audioContext.destination);
            osc.type = 'triangle';
            osc.frequency.value = freq;
            const start = now + i * 0.08;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.25 * vol, start + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 1.8);
            osc.start(start); osc.stop(start + 1.8);
        });
    } else if (config.theme === 'zen') {
        [528, 1056, 1584].forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain); gain.connect(audioContext.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            const amp = (0.3 / (i + 1)) * vol;
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(amp, now + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.0005, now + 2.5);
            osc.start(now); osc.stop(now + 2.5);
        });
    } else if (config.theme === 'bip') {
        [0, 0.15].forEach(delay => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain); gain.connect(audioContext.destination);
            osc.type = 'sine';
            osc.frequency.value = 880;
            const start = now + delay;
            gain.gain.setValueAtTime(0.3 * vol, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.08);
            osc.start(start); osc.stop(start + 0.08);
        });
    } else {
        [523.25, 659.25, 783.99].forEach((freq, i) => {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain); gain.connect(audioContext.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            const start = now + i * 0.1;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.3 * vol, start + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 1.5);
            osc.start(start); osc.stop(start + 1.5);
        });
    }
}

function testerSonNotification() {
    jouerSonFinChrono();
}

function jouerSonApparitionPause() {
    initAudio();
    const config = chargerAudioConfig();
    const vol = config.volume !== undefined ? config.volume : 0.8;
    if (vol <= 0) return;
    const now = audioContext.currentTime;

    [587.33, 783.99].forEach((freq, i) => {
        const osc = audioContext.createOscillator(); const gain = audioContext.createGain();
        osc.connect(gain); gain.connect(audioContext.destination); osc.type = 'sine'; osc.frequency.value = freq;
        const startTime = now + i * 0.15; gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.15 * vol, startTime + 0.05); gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.0);
        osc.start(startTime); osc.stop(startTime + 1.0);
    });
}

function jouerSonFinPause() {
    initAudio();
    const config = chargerAudioConfig();
    const vol = config.volume !== undefined ? config.volume : 0.8;
    if (vol <= 0) return;
    const now = audioContext.currentTime;

    [783.99, 659.25, 523.25].forEach((freq, i) => {
        const osc = audioContext.createOscillator(); const gain = audioContext.createGain();
        osc.connect(gain); gain.connect(audioContext.destination); osc.type = 'sine'; osc.frequency.value = freq;
        const startTime = now + i * 0.15; gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.15 * vol, startTime + 0.05); gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.5);
        osc.start(startTime); osc.stop(startTime + 1.5);
    });
}

function obtenirNomTempo(bpm) {
    if (bpm < 40) return 'Larghissimo';
    if (bpm < 60) return 'Largo';
    if (bpm < 66) return 'Larghetto';
    if (bpm < 76) return 'Adagio';
    if (bpm < 108) return 'Andante';
    if (bpm < 120) return 'Moderato';
    if (bpm < 156) return 'Allegro';
    if (bpm < 176) return 'Vivace';
    if (bpm < 200) return 'Presto';
    return 'Prestissimo';
}

function demarrerMetronome() {
    initAudio();
    if (metronome.isPlaying) return;
    metronome.isPlaying = true;
    metronome.currentBeat = 0;
    metronome.nextNoteTime = audioContext.currentTime + 0.05;
    schedulerMetronome();
    majUIMetronome();
    majBoutonPupitreMetronome();
}

function arreterMetronome() {
    metronome.isPlaying = false;
    if (metronome.timerWorker) {
        clearTimeout(metronome.timerWorker);
        metronome.timerWorker = null;
    }
    if (metronome.currentBtn) {
        metronome.currentBtn.classList.remove('playing');
        metronome.currentBtn.innerHTML = `${svgMetronome} ${metronome.tempo} bpm`;
        metronome.currentBtn = null;
    }
    document.querySelectorAll('.metro-beat-slot').forEach(el => el.classList.remove('flash-beat'));
    majUIMetronome();
    majBoutonPupitreMetronome();
}

function stopMetronome() {
    arreterMetronome();
}

function basculerLectureMetronome() {
    if (metronome.isPlaying) {
        arreterMetronome();
    } else {
        demarrerMetronome();
    }
}

function toggleMetronome(tempo, event, btnElement) {
    if (event) event.stopPropagation();
    initAudio();
    if (metronome.isPlaying && metronome.currentBtn === btnElement) {
        arreterMetronome();
    } else {
        if (metronome.isPlaying) arreterMetronome();
        metronome.tempo = parseInt(tempo) || metronome.tempo;
        metronome.currentBtn = btnElement;
        if (btnElement) {
            btnElement.classList.add('playing');
            btnElement.innerHTML = `${svgMetronomeActive} Stop`;
        }
        demarrerMetronome();
    }
}

function schedulerMetronome() {
    while (metronome.nextNoteTime < audioContext.currentTime + 0.15) {
        planifierNoteMetronome(metronome.currentBeat, metronome.nextNoteTime);
        avancerBeatMetronome();
    }
    if (metronome.isPlaying) {
        metronome.timerWorker = setTimeout(schedulerMetronome, 25);
    }
}

function avancerBeatMetronome() {
    const baseSeconds = 60.0 / metronome.tempo;
    const secondsPerBeat = (metronome.unit === 8) ? (baseSeconds / 2) : baseSeconds;
    metronome.nextNoteTime += secondsPerBeat;
    metronome.currentBeat = (metronome.currentBeat + 1) % metronome.slots.length;
}

function planifierNoteMetronome(beatIndex, time) {
    const slotLevel = metronome.slots[beatIndex] !== undefined ? metronome.slots[beatIndex] : 1;
    jouerClicMetronome(time, slotLevel);

    // Synchronisation du flash visuel avec la frappe sonore
    const delaiMs = Math.max(0, (time - audioContext.currentTime) * 1000);
    setTimeout(() => {
        if (metronome.isPlaying) {
            animerFlashBeat(beatIndex);
        }
    }, delaiMs);
}

let metronomeBuffers = {
    _sampleRate: 0,
    bois: { accent: null, normal: null },
    clic: { accent: null, normal: null },
    bip: { accent: null, normal: null }
};
let metronomeMasterGainNode = null;

function creerBufferAudio(sampleRate, dureeSec, formuleFn) {
    const numSamples = Math.floor(sampleRate * dureeSec);
    const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
    const data = buffer.getChannelData(0);
    const fadeOutSamples = 32;

    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        let s = formuleFn(t, i, numSamples);
        if (i >= numSamples - fadeOutSamples) {
            s *= (numSamples - 1 - i) / fadeOutSamples;
        }
        data[i] = s;
    }
    return buffer;
}

function assurerBuffersMetronome() {
    if (!audioContext) return;
    const sr = audioContext.sampleRate || 44100;
    if (metronomeBuffers.bois.accent && metronomeBuffers._sampleRate === sr) {
        return;
    }
    metronomeBuffers._sampleRate = sr;

    // 1. Thème BOIS (Woodblock acoustique chaud & percutant, 100% stable)
    metronomeBuffers.bois.accent = creerBufferAudio(sr, 0.042, (t, i) => {
        const attackSamples = Math.floor(sr * 0.0012);
        const env = i < attackSamples ? Math.sin((Math.PI / 2) * (i / attackSamples)) : Math.exp(-(t - 0.0012) / 0.0085);
        const click = t < 0.0018 ? 0.22 * Math.sin(2 * Math.PI * 4800 * t) * Math.exp(-t / 0.0006) : 0;
        const wave = 0.8 * Math.sin(2 * Math.PI * 2200 * t) + 0.35 * Math.sin(2 * Math.PI * 3520 * t) + click;
        return env * wave * 0.70;
    });

    metronomeBuffers.bois.normal = creerBufferAudio(sr, 0.036, (t, i) => {
        const attackSamples = Math.floor(sr * 0.0012);
        const env = i < attackSamples ? Math.sin((Math.PI / 2) * (i / attackSamples)) : Math.exp(-(t - 0.0012) / 0.0075);
        const click = t < 0.0018 ? 0.18 * Math.sin(2 * Math.PI * 3600 * t) * Math.exp(-t / 0.0006) : 0;
        const wave = 0.8 * Math.sin(2 * Math.PI * 1400 * t) + 0.35 * Math.sin(2 * Math.PI * 2240 * t) + click;
        return env * wave * 0.50;
    });

    // 2. Thème CLIC (Métronome mécanique net et précis)
    metronomeBuffers.clic.accent = creerBufferAudio(sr, 0.025, (t, i) => {
        const attackSamples = Math.floor(sr * 0.0008);
        const env = i < attackSamples ? Math.sin((Math.PI / 2) * (i / attackSamples)) : Math.exp(-(t - 0.0008) / 0.0045);
        const wave = Math.sin(2 * Math.PI * 2500 * t) + 0.3 * Math.sin(2 * Math.PI * 5000 * t);
        return env * wave * 0.60;
    });

    metronomeBuffers.clic.normal = creerBufferAudio(sr, 0.020, (t, i) => {
        const attackSamples = Math.floor(sr * 0.0008);
        const env = i < attackSamples ? Math.sin((Math.PI / 2) * (i / attackSamples)) : Math.exp(-(t - 0.0008) / 0.0040);
        const wave = Math.sin(2 * Math.PI * 1600 * t) + 0.3 * Math.sin(2 * Math.PI * 3200 * t);
        return env * wave * 0.42;
    });

    // 3. Thème BIP (Bip électronique pur)
    metronomeBuffers.bip.accent = creerBufferAudio(sr, 0.045, (t, i) => {
        const attackSamples = Math.floor(sr * 0.0020);
        const env = i < attackSamples ? Math.sin((Math.PI / 2) * (i / attackSamples)) : Math.exp(-(t - 0.0020) / 0.0090);
        return env * Math.sin(2 * Math.PI * 1760 * t) * 0.55;
    });

    metronomeBuffers.bip.normal = creerBufferAudio(sr, 0.040, (t, i) => {
        const attackSamples = Math.floor(sr * 0.0020);
        const env = i < attackSamples ? Math.sin((Math.PI / 2) * (i / attackSamples)) : Math.exp(-(t - 0.0020) / 0.0080);
        return env * Math.sin(2 * Math.PI * 880 * t) * 0.40;
    });
}

function jouerClicMetronome(time, level = 1) {
    if (!audioContext || level === 0 || level === 'mute') return;
    const config = chargerAudioConfig();
    const masterVol = config.volume !== undefined ? config.volume : 0.8;
    if (masterVol <= 0) return;

    assurerBuffersMetronome();

    const theme = config.metronomeTheme || 'bois';
    const isAccent = (level === 2 || level === 'accent');
    const themeBuffers = metronomeBuffers[theme] || metronomeBuffers.bois;
    const buffer = isAccent ? themeBuffers.accent : themeBuffers.normal;
    if (!buffer) return;

    if (!metronomeMasterGainNode || metronomeMasterGainNode.context !== audioContext) {
        metronomeMasterGainNode = audioContext.createGain();
        metronomeMasterGainNode.connect(audioContext.destination);
    }
    metronomeMasterGainNode.gain.setValueAtTime(masterVol, audioContext.currentTime);

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(metronomeMasterGainNode);
    source.start(Math.max(time, audioContext.currentTime));
}

function testerSonMetronome() {
    initAudio();
    const now = audioContext.currentTime;
    jouerClicMetronome(now, 2);
    jouerClicMetronome(now + 0.35, 1);
    jouerClicMetronome(now + 0.70, 1);
    jouerClicMetronome(now + 1.05, 1);
}

function reglerTempoMetronome(bpm) {
    const val = Math.min(300, Math.max(30, parseInt(bpm) || 120));
    metronome.tempo = val;
    majUIMetronome();
}

function ajusterTempoMetronome(delta) {
    reglerTempoMetronome(metronome.tempo + delta);
}

function tapTempoMetronome() {
    const now = Date.now();
    if (!metronome.tapTimes || metronome.tapTimes.length === 0 || (now - metronome.tapTimes[metronome.tapTimes.length - 1] > 2500)) {
        metronome.tapTimes = [now];
        animerBoutonTap();
        return;
    }
    metronome.tapTimes.push(now);
    if (metronome.tapTimes.length > 5) {
        metronome.tapTimes.shift();
    }
    let totalDelta = 0;
    for (let i = 1; i < metronome.tapTimes.length; i++) {
        totalDelta += (metronome.tapTimes[i] - metronome.tapTimes[i - 1]);
    }
    const intervalMoyen = totalDelta / (metronome.tapTimes.length - 1);
    if (intervalMoyen > 0) {
        const bpmCalcule = Math.round(60000 / intervalMoyen);
        reglerTempoMetronome(bpmCalcule);
    }
    animerBoutonTap();
}

function animerBoutonTap() {
    const btnTap = document.getElementById('btn-metro-tap');
    if (btnTap) {
        btnTap.classList.add('metro-tap-pulse');
        setTimeout(() => btnTap.classList.remove('metro-tap-pulse'), 150);
    }
}

function changerSignatureMetronome(nbTemps) {
    nbTemps = Math.min(9, Math.max(2, parseInt(nbTemps) || 4));
    metronome.signature = nbTemps;
    
    // Réinitialisation par défaut : temps 1 en fort (2), tous les autres en faible (1)
    const newSlots = [];
    for (let i = 0; i < nbTemps; i++) {
        newSlots.push(i === 0 ? 2 : 1);
    }
    metronome.slots = newSlots;
    metronome.currentBeat = metronome.currentBeat % nbTemps;
    majUIMetronome();
}

function reglerUniteMetronome(unit) {
    metronome.unit = (parseInt(unit, 10) === 8) ? 8 : 4;
    majUIMetronome();
}

function basculerUniteMetronome() {
    reglerUniteMetronome(metronome.unit === 4 ? 8 : 4);
}

function cyclerSlotMetronome(index) {
    if (index < 0 || index >= metronome.slots.length) return;
    let cur = metronome.slots[index];
    if (cur === 'accent') cur = 2;
    else if (cur === 'normal') cur = 1;
    else if (cur === 'mute') cur = 0;

    // Cycle : 2 (Fort) -> 1 (Faible) -> 0 (Muet) -> 2 (Fort)
    let next = 1;
    if (cur === 2) next = 1;
    else if (cur === 1) next = 0;
    else if (cur === 0) next = 2;

    metronome.slots[index] = next;
    majUIMetronome();
}

function animerFlashBeat(beatIndex) {
    const slotsEl = document.querySelectorAll('.metro-beat-slot');
    slotsEl.forEach((el, idx) => {
        if (idx === beatIndex) {
            el.classList.add('flash-beat');
            setTimeout(() => el.classList.remove('flash-beat'), 120);
        } else {
            el.classList.remove('flash-beat');
        }
    });
}

function attacherControlesTempoInteractifs() {
    const container = document.getElementById('metro-bpm-container');
    if (!container || container._hasGestureAttached) return;
    container._hasGestureAttached = true;

    // 1. Molette souris pour desktop
    container.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1 : -1;
        ajusterTempoMetronome(delta);
    }, { passive: false });

    // 2. Glisser vertical (souris PC + tactile tablette)
    let isDragging = false;
    let startY = 0;
    let accumulatedY = 0;
    const PIXELS_PER_BPM = 6; // 6px de mouvement vertical = 1 BPM

    const onPointerDown = (e) => {
        isDragging = true;
        startY = e.clientY;
        accumulatedY = 0;
        container.classList.add('dragging');
        if (container.setPointerCapture && e.pointerId !== undefined) {
            try { container.setPointerCapture(e.pointerId); } catch (err) { }
        }
    };

    const onPointerMove = (e) => {
        if (!isDragging) return;
        const currentY = e.clientY;
        const diffY = startY - currentY; // vers le haut = +BPM, vers le bas = -BPM
        accumulatedY += diffY;
        startY = currentY;

        const bpmDelta = Math.trunc(accumulatedY / PIXELS_PER_BPM);
        if (bpmDelta !== 0) {
            ajusterTempoMetronome(bpmDelta);
            accumulatedY -= (bpmDelta * PIXELS_PER_BPM);
        }
    };

    const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        container.classList.remove('dragging');
        if (container.releasePointerCapture && e.pointerId !== undefined) {
            try { container.releasePointerCapture(e.pointerId); } catch (err) { }
        }
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);

    // Support tactile mobile / tablette complémentaire
    let touchStartY = 0;
    let touchAccumulatedY = 0;
    container.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length > 0) {
            touchStartY = e.touches[0].clientY;
            touchAccumulatedY = 0;
            container.classList.add('dragging');
        }
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
        if (e.touches && e.touches.length > 0) {
            const currentY = e.touches[0].clientY;
            const diffY = touchStartY - currentY;
            touchAccumulatedY += diffY;
            touchStartY = currentY;

            const bpmDelta = Math.trunc(touchAccumulatedY / PIXELS_PER_BPM);
            if (bpmDelta !== 0) {
                ajusterTempoMetronome(bpmDelta);
                touchAccumulatedY -= (bpmDelta * PIXELS_PER_BPM);
            }
        }
    }, { passive: true });

    container.addEventListener('touchend', () => {
        container.classList.remove('dragging');
    });
    container.addEventListener('touchcancel', () => {
        container.classList.remove('dragging');
    });
}

function ouvrirModalMetronome() {
    try {
        const audio = chargerAudioConfig();
        if (audio.metronomeTheme) metronome.theme = audio.metronomeTheme;
    } catch (e) { }
    const modal = document.getElementById('modal-metronome');
    if (modal) {
        modal.style.display = 'flex';
        attacherControlesTempoInteractifs();
        majUIMetronome();
    }
}

function fermerModalMetronome() {
    const modal = document.getElementById('modal-metronome');
    if (modal) {
        modal.style.display = 'none';
    }
}

function majBoutonPupitreMetronome() {
    const btn = document.getElementById('btn-pupitre-metronome');
    if (!btn) return;
    if (metronome.isPlaying) {
        btn.classList.add('playing');
        btn.title = t('metronome.active_title', { bpm: metronome.tempo });
    } else {
        btn.classList.remove('playing');
        btn.title = t('metronome.title');
    }
}

function majUIMetronome() {
    const bpmValEl = document.getElementById('metro-bpm-val');
    const tempoNomEl = document.getElementById('metro-tempo-nom');
    const sliderEl = document.getElementById('metro-slider');
    const btnToggleEl = document.getElementById('btn-metro-toggle');
    const sigContainer = document.getElementById('metro-sig-container');
    const slotsContainer = document.getElementById('metro-beat-slots');
    const btnUnit4 = document.getElementById('btn-metro-unit-4');
    const btnUnit8 = document.getElementById('btn-metro-unit-8');

    if (bpmValEl) bpmValEl.textContent = metronome.tempo;
    if (tempoNomEl) tempoNomEl.textContent = `BPM • ${obtenirNomTempo(metronome.tempo)}`;
    if (sliderEl) sliderEl.value = metronome.tempo;

    // Mise à jour visuelle des boutons Noire (4) / Croche (8)
    if (btnUnit4) {
        if (metronome.unit === 4) btnUnit4.classList.add('active');
        else btnUnit4.classList.remove('active');
    }
    if (btnUnit8) {
        if (metronome.unit === 8) btnUnit8.classList.add('active');
        else btnUnit8.classList.remove('active');
    }

    // Mise à jour des boutons de signatures (2 à 9) - Numéros purs, sans /4 ni /8
    if (sigContainer) {
        let sigHtml = '';
        for (let s = 2; s <= 9; s++) {
            const isActive = (metronome.signature === s) ? 'active' : '';
            sigHtml += `<button type="button" class="metro-sig-btn ${isActive}" onclick="changerSignatureMetronome(${s})">${s}</button>`;
        }
        sigContainer.innerHTML = sigHtml;
    }

    // Mise à jour des slots de clave/mesure (2 barres de niveau Soundbrenner)
    if (slotsContainer) {
        let html = '';
        metronome.slots.forEach((val, idx) => {
            let lvl = 1;
            if (val === 2 || val === 'accent') lvl = 2;
            else if (val === 1 || val === 'normal') lvl = 1;
            else if (val === 0 || val === 'mute') lvl = 0;

            const beatNum = idx + 1;
            html += `
                <div class="metro-beat-slot slot-level-${lvl}" onclick="cyclerSlotMetronome(${idx})" title="${t('metronome.beat_slot_title', { beat: beatNum, lvl: lvl })}">
                    <span class="slot-num">${beatNum}</span>
                    <div class="slot-bars">
                        <div class="slot-bar-top"></div>
                        <div class="slot-bar-bot"></div>
                    </div>
                </div>
            `;
        });
        slotsContainer.innerHTML = html;
    }

    // Bouton rond Démarrer / Arrêter
    if (btnToggleEl) {
        if (metronome.isPlaying) {
            btnToggleEl.className = 'metro-play-btn playing';
            btnToggleEl.title = t('metronome.stop');
            btnToggleEl.innerHTML = `
                <span class="rec-icon-inner" style="width: 20px; height: 20px; border-radius: 4px; background: #ffffff; display: block;"></span>
            `;
        } else {
            btnToggleEl.className = 'metro-play-btn';
            btnToggleEl.title = t('metronome.start');
            btnToggleEl.innerHTML = `
                <svg viewBox="0 0 24 24" style="width: 26px; height: 26px; fill: currentColor; margin-left: 3px;">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
            `;
        }
    }
}

function afficherVue(nomVue) {
    document.getElementById('vue-pratique').classList.remove('vue-active');
    document.getElementById('vue-creation').classList.remove('vue-active');
    document.getElementById('vue-historique').classList.remove('vue-active');
    document.getElementById('vue-bibliotheque').classList.remove('vue-active');

    const btnPratique = document.getElementById('btn-nav-pratique');
    const btnHist = document.getElementById('btn-nav-historique');
    const btnBiblio = document.getElementById('btn-nav-biblio');
    const btnRetour = document.getElementById('btn-nav-retour');
    const btnNouvelle = document.getElementById('btn-nav-nouvelle');
    const btnCafe = document.getElementById('btn-pause-cafe');

    [btnPratique, btnNouvelle, btnHist, btnBiblio].forEach(b => {
        if (b) {
            b.style.backgroundColor = ''; b.style.borderColor = ''; b.classList.remove('active');
        }
    });

    // Détection d'une séance active en cours
    const aVraieSeanceActive = !!(seanceEnCours && seanceEnCours.statut === 'en_cours');

    // Pause café : STRICTEMENT réservée à la vue pratique et UNIQUEMENT si séance active
    if (btnCafe) {
        if (nomVue !== 'pratique' || !aVraieSeanceActive) {
            btnCafe.style.setProperty('display', 'none', 'important');
            btnCafe.classList.add('hidden');
        }
    }

    // Bouton de retour : STRICTEMENT réservé aux vues hors pratique et UNIQUEMENT si séance active
    if (btnRetour) {
        if (nomVue === 'pratique' || !aVraieSeanceActive) {
            btnRetour.style.setProperty('display', 'none', 'important');
            btnRetour.classList.add('hidden');
        } else {
            btnRetour.style.setProperty('display', 'inline-flex', 'important');
            btnRetour.classList.remove('hidden');
        }
    }

    if (nomVue === 'pratique') {
        document.getElementById('vue-pratique').classList.add('vue-active');
        if (btnPratique) btnPratique.classList.add('active');
        if (seanceEnCours && seanceEnCours.statut === 'en_cours') {
            const conteneur = document.getElementById('conteneur-items');
            const estDejaRendu = conteneur && conteneur.dataset.seanceId === String(seanceEnCours.id) && conteneur.children.length > 0;
            if (!estDejaRendu) {
                afficherSeancePratique();
            } else {
                majAffichageDureeLive();
            }
        }
    } else if (nomVue === 'creation') {
        document.getElementById('vue-creation').classList.add('vue-active');
        if (btnNouvelle) btnNouvelle.classList.add('active');
        itemsBrouillon = []; afficherBrouillon();
        if (typeof attacherControlesTempsExerciceInteractifs === 'function') attacherControlesTempsExerciceInteractifs();
    } else if (nomVue === 'historique') {
        document.getElementById('vue-historique').classList.add('vue-active');
        if (btnHist) btnHist.classList.add('active');
        chargerHistorique();
    } else if (nomVue === 'bibliotheque') {
        document.getElementById('vue-bibliotheque').classList.add('vue-active');
        if (btnBiblio) btnBiblio.classList.add('active');
        chargerVocabulaireApi(); gererSousCategoriesForm();
    }
}

// ==========================================
// --- LECTEUR AUDIO & TRANSCRIBE! (JALON 9) ---
// ==========================================
const transcribeState = {
    audio: null,
    currentFichier: null,
    currentTitre: "",
    currentItemId: null,
    isPlaying: false,
    duration: 0,
    currentTime: 0,
    playbackRate: 1.0,
    loopA: null,
    loopB: null,
    loopABActive: true,
    waveformPeaks: null,
    waveformCache: {},
    volume: 1.0,
    isMuted: false
};

function initTranscribePlayer() {
    if (!transcribeState.audio) {
        transcribeState.audio = new Audio();
        transcribeState.audio.preservesPitch = true;

        transcribeState.audio.ontimeupdate = () => {
            if (!transcribeState.audio) return;
            if (Number.isFinite(transcribeState.audio.currentTime)) {
                transcribeState.currentTime = transcribeState.audio.currentTime;
            }
            if (Number.isFinite(transcribeState.audio.duration) && transcribeState.audio.duration > 0 && transcribeState.duration !== transcribeState.audio.duration) {
                transcribeState.duration = transcribeState.audio.duration;
            }

            // Boucle A-B intelligente ou Boucle intégrale
            if (transcribeState.loopABActive) {
                if (transcribeState.loopA !== null && transcribeState.loopB !== null) {
                    if (transcribeState.audio.currentTime >= transcribeState.loopB || transcribeState.audio.currentTime < transcribeState.loopA) {
                        transcribeState.audio.currentTime = transcribeState.loopA;
                        if (transcribeState.audio.paused && transcribeState.isPlaying) {
                            transcribeState.audio.play().catch(() => {});
                        }
                    }
                } else if (transcribeState.duration > 0 && transcribeState.audio.currentTime >= transcribeState.duration - 0.05) {
                    transcribeState.audio.currentTime = (transcribeState.loopA !== null) ? transcribeState.loopA : 0;
                    if (transcribeState.audio.paused && transcribeState.isPlaying) {
                        transcribeState.audio.play().catch(() => {});
                    }
                }
            }

            mettreAJourUIAudioProgress();
            dessinerWaveformTranscribe();
        };

        const majDureeChargee = () => {
            if (!transcribeState.audio) return;
            const dur = transcribeState.audio.duration;
            if (Number.isFinite(dur) && dur > 0) {
                transcribeState.duration = dur;
            } else if (dur === Infinity) {
                // Pour les audios WebM ou sans en-tête fixe dans Chrome, chercher la fin pour résoudre la durée
                transcribeState.audio.currentTime = 1e101;
                transcribeState.audio.addEventListener('timeupdate', function onDurSeek() {
                    transcribeState.audio.removeEventListener('timeupdate', onDurSeek);
                    transcribeState.audio.currentTime = 0;
                    if (Number.isFinite(transcribeState.audio.duration) && transcribeState.audio.duration > 0) {
                        transcribeState.duration = transcribeState.audio.duration;
                    }
                    mettreAJourUIAudioProgress();
                    dessinerWaveformTranscribe();
                }, { once: true });
            }
            transcribeState.audio.preservesPitch = true;
            transcribeState.audio.playbackRate = transcribeState.playbackRate;
            synchroniserLoopAudio();
            mettreAJourUIAudioProgress();
            dessinerWaveformTranscribe();
        };

        transcribeState.audio.onloadedmetadata = majDureeChargee;
        transcribeState.audio.ondurationchange = majDureeChargee;

        transcribeState.audio.onplay = () => {
            transcribeState.isPlaying = true;
            mettreAJourCartesAudioStatus();
            dessinerWaveformTranscribe();
        };

        transcribeState.audio.onpause = () => {
            transcribeState.isPlaying = false;
            mettreAJourCartesAudioStatus();
            dessinerWaveformTranscribe();
        };

        transcribeState.audio.onended = () => {
            if (transcribeState.loopABActive) {
                transcribeState.audio.currentTime = (transcribeState.loopA !== null) ? transcribeState.loopA : 0;
                transcribeState.audio.play().catch(() => {});
            } else {
                transcribeState.isPlaying = false;
                transcribeState.audio.currentTime = 0;
                transcribeState.currentTime = 0;
                mettreAJourCartesAudioStatus();
                dessinerWaveformTranscribe();
            }
        };

        initTranscribeWaveformInteractions();
    }
}

function synchroniserLoopAudio() {
    if (!transcribeState.audio) return;
    if (transcribeState.loopABActive && transcribeState.loopA === null && transcribeState.loopB === null) {
        transcribeState.audio.loop = true;
    } else {
        transcribeState.audio.loop = false;
    }
}

async function chargerAudioDansLecteur(fichierAudio, titre, itemId, autoPlay = false) {
    initTranscribePlayer();
    if (transcribeState.audio && !transcribeState.audio.paused) {
        transcribeState.audio.pause();
    }

    transcribeState.currentFichier = fichierAudio;
    transcribeState.currentTitre = titre || "Morceau";
    transcribeState.currentItemId = itemId || null;
    transcribeState.loopA = null;
    transcribeState.loopB = null;
    transcribeState.loopABActive = true;
    transcribeState.currentTime = 0;
    transcribeState.duration = 0;

    const trackTitleEl = document.getElementById('transcribe-track-title');
    if (trackTitleEl) trackTitleEl.textContent = '';
    synchroniserLoopAudio();

    mettreAJourUIAudioProgress();

    try {
        const url = await getFichierUrl(fichierAudio);
        if (!url) throw new Error("Fichier audio introuvable");
        transcribeState.audio.src = url;
        transcribeState.audio.preservesPitch = true;
        transcribeState.audio.playbackRate = transcribeState.playbackRate;
        transcribeState.audio.volume = transcribeState.volume;
        transcribeState.audio.muted = transcribeState.isMuted;

        genererWaveformPeaks(fichierAudio, url);

        if (autoPlay) {
            transcribeState.audio.play().then(() => {
                transcribeState.isPlaying = true;
                mettreAJourCartesAudioStatus();
            }).catch(e => console.warn("Autoplay audio bloqué ou interrompu :", e));
        }
    } catch (e) {
        console.error("Erreur chargement audio dans le lecteur :", e);
    }

    mettreAJourCartesAudioStatus();
}

function togglePlayPauseAudio() {
    if (!transcribeState.audio || !transcribeState.audio.src) return;
    if (transcribeState.audio.paused) {
        if (transcribeState.loopABActive && transcribeState.loopA !== null && transcribeState.loopB !== null) {
            if (transcribeState.audio.currentTime < transcribeState.loopA || transcribeState.audio.currentTime >= transcribeState.loopB) {
                transcribeState.audio.currentTime = transcribeState.loopA;
            }
        }
        transcribeState.audio.play().then(() => {
            transcribeState.isPlaying = true;
            mettreAJourCartesAudioStatus();
            dessinerWaveformTranscribe();
        }).catch(e => console.warn("Lecture audio bloquée :", e));
    } else {
        transcribeState.audio.pause();
        transcribeState.isPlaying = false;
        mettreAJourCartesAudioStatus();
        dessinerWaveformTranscribe();
    }
}

function stopperAudio() {
    if (!transcribeState.audio) return;
    transcribeState.audio.pause();
    const restartPos = (transcribeState.loopABActive && transcribeState.loopA !== null) ? transcribeState.loopA : 0;
    transcribeState.audio.currentTime = restartPos;
    transcribeState.currentTime = restartPos;
    transcribeState.isPlaying = false;
    mettreAJourCartesAudioStatus();
    mettreAJourUIAudioProgress();
    dessinerWaveformTranscribe();
}

function sauterAudioSecondes(delta) {
    if (!transcribeState.audio) return;
    let target = transcribeState.audio.currentTime + delta;
    if (transcribeState.duration > 0) target = Math.max(0, Math.min(transcribeState.duration, target));
    else target = Math.max(0, target);
    transcribeState.audio.currentTime = target;
    transcribeState.currentTime = target;
    mettreAJourUIAudioProgress();
    dessinerWaveformTranscribe();
}

function poserPointA() {
    if (!transcribeState.audio) return;
    transcribeState.loopA = transcribeState.audio.currentTime;
    if (transcribeState.loopB !== null && transcribeState.loopB <= transcribeState.loopA) {
        transcribeState.loopB = null;
    }
    transcribeState.loopABActive = true;
    synchroniserLoopAudio();
    mettreAJourUIAudioProgress();
    dessinerWaveformTranscribe();
}

function poserPointB() {
    if (!transcribeState.audio) return;
    transcribeState.loopB = transcribeState.audio.currentTime;
    if (transcribeState.loopA !== null && transcribeState.loopB <= transcribeState.loopA) {
        const temp = transcribeState.loopA;
        transcribeState.loopA = transcribeState.loopB;
        transcribeState.loopB = temp;
    }
    transcribeState.loopABActive = true;
    synchroniserLoopAudio();
    mettreAJourUIAudioProgress();
    dessinerWaveformTranscribe();
}

function reinitialiserBoucleAB() {
    transcribeState.loopA = null;
    transcribeState.loopB = null;
    transcribeState.loopABActive = true;
    synchroniserLoopAudio();
    mettreAJourUIAudioProgress();
    dessinerWaveformTranscribe();
}

function toggleBoucleAB() {
    transcribeState.loopABActive = !transcribeState.loopABActive;
    synchroniserLoopAudio();
    mettreAJourUIAudioProgress();
    dessinerWaveformTranscribe();
}

function reglerVitesseAudio(taux, btnElement) {
    transcribeState.playbackRate = taux;
    if (transcribeState.audio) {
        transcribeState.audio.preservesPitch = true;
        transcribeState.audio.playbackRate = taux;
    }
    const display = document.getElementById('transcribe-rate-display');
    if (display) display.textContent = `${Math.round(taux * 100)}%`;

    const pills = document.querySelectorAll('#transcribe-speed-pills .chip');
    pills.forEach(p => {
        p.classList.remove('active', 'btn-ghost-blue');
        p.classList.add('btn-ghost-neutral');
    });
    if (btnElement) {
        btnElement.classList.add('active', 'btn-ghost-blue');
        btnElement.classList.remove('btn-ghost-neutral');
    }
}

function reglerVolumeAudio(val) {
    const vol = parseFloat(val);
    transcribeState.volume = vol;
    if (transcribeState.audio) {
        transcribeState.audio.volume = vol;
    }
}

function toggleMuteAudio() {
    transcribeState.isMuted = !transcribeState.isMuted;
    if (transcribeState.audio) {
        transcribeState.audio.muted = transcribeState.isMuted;
    }
    const btn = document.getElementById('transcribe-btn-mute');
    if (btn) {
        btn.innerHTML = transcribeState.isMuted ? svgVolumeMute : svgVolume;
        btn.className = transcribeState.isMuted ? 'btn-action btn-ghost-red btn-square' : 'btn-action btn-ghost-neutral btn-square';
    }
}

async function genererWaveformPeaks(fichierAudio, url) {
    if (transcribeState.waveformCache[fichierAudio]) {
        transcribeState.waveformPeaks = transcribeState.waveformCache[fichierAudio];
        dessinerWaveformTranscribe();
        return;
    }

    try {
        let arrayBuffer;
        if (url.startsWith('data:')) {
            const base64Clean = url.split(',')[1];
            const binaryStr = atob(base64Clean);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) bytes[i] = binaryStr.charCodeAt(i);
            arrayBuffer = bytes.buffer;
        } else {
            const resp = await fetch(url);
            arrayBuffer = await resp.arrayBuffer();
        }

        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        if (audioBuffer && Number.isFinite(audioBuffer.duration) && audioBuffer.duration > 0) {
            if (!Number.isFinite(transcribeState.duration) || transcribeState.duration <= 0) {
                transcribeState.duration = audioBuffer.duration;
                mettreAJourUIAudioProgress();
            }
        }
        const channelData = audioBuffer.getChannelData(0);
        const numBars = 120;
        const step = Math.floor(channelData.length / numBars);
        const peaks = [];

        for (let i = 0; i < numBars; i++) {
            let sum = 0;
            const start = i * step;
            for (let j = 0; j < step; j++) {
                sum += Math.abs(channelData[start + j]);
            }
            const avg = sum / step;
            const amplified = Math.min(1.0, Math.pow(avg * 3.5, 0.75));
            peaks.push(amplified);
        }

        transcribeState.waveformCache[fichierAudio] = peaks;
        transcribeState.waveformPeaks = peaks;
        try { audioCtx.close(); } catch (e) { }
        dessinerWaveformTranscribe();
    } catch (e) {
        console.warn("Profil dynamique waveform utilisé (décodage AudioContext indisponible) :", e);
        const numBars = 120;
        const peaks = [];
        for (let i = 0; i < numBars; i++) {
            const wave = 0.2 + 0.5 * Math.abs(Math.sin(i * 0.15) * Math.cos(i * 0.08) + 0.2 * Math.sin(i * 0.6));
            peaks.push(Math.min(1.0, wave));
        }
        transcribeState.waveformPeaks = peaks;
        dessinerWaveformTranscribe();
    }
}

function redimensionnerWaveformCanvas() {
    const canvas = document.getElementById('transcribe-waveform');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0) {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
    }
}

function dessinerWaveformTranscribe() {
    const canvas = document.getElementById('transcribe-waveform');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const width = rect.width || canvas.width || 520;
    const height = rect.height || canvas.height || 96;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const dpr = window.devicePixelRatio || 1;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const peaks = transcribeState.waveformPeaks || [];
    const numBars = peaks.length > 0 ? peaks.length : 100;
    const barWidth = Math.max(2, (width / numBars) * 0.72);
    const barGap = Math.max(1, (width / numBars) * 0.28);
    const centerY = height / 2;

    const duration = transcribeState.duration || 1;
    const currentProgress = Math.max(0, Math.min(1, (transcribeState.currentTime || 0) / duration));
    const loopAProgress = transcribeState.loopA !== null ? Math.max(0, Math.min(1, transcribeState.loopA / duration)) : null;
    const loopBProgress = transcribeState.loopB !== null ? Math.max(0, Math.min(1, transcribeState.loopB / duration)) : null;

    const accentWave = (typeof window !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue('--accent-blue').trim() : '') || '#f59e0b';
    const accentWaveRgb = (typeof window !== 'undefined' ? getComputedStyle(document.documentElement).getPropertyValue('--accent-blue-rgb').trim() : '') || '245, 158, 11';

    // 1. Zone de boucle surlignée en arrière-plan et barre de déplacement
    if (loopAProgress !== null && loopBProgress !== null && transcribeState.loopABActive) {
        const ax = loopAProgress * width;
        const bx = loopBProgress * width;
        const minX = Math.min(ax, bx);
        const loopW = Math.max(2, Math.abs(bx - ax));

        ctx.fillStyle = `rgba(${accentWaveRgb}, 0.16)`;
        ctx.fillRect(minX, 0, loopW, height);

        // Barre supérieure interactive
        ctx.fillStyle = `rgba(${accentWaveRgb}, 0.55)`;
        ctx.fillRect(minX, 0, loopW, 3);
    }

    // 2. Barres verticales d'intensité
    for (let i = 0; i < numBars; i++) {
        const x = i * (barWidth + barGap);
        const barProgress = i / numBars;
        const peakVal = peaks.length > 0 ? peaks[i] : (0.15 + 0.35 * Math.abs(Math.sin(i * 0.2)));
        const barHeight = Math.max(4, peakVal * (height * 0.78));

        const isInLoop = (loopAProgress !== null && loopBProgress !== null && barProgress >= Math.min(loopAProgress, loopBProgress) && barProgress <= Math.max(loopAProgress, loopBProgress) && transcribeState.loopABActive);
        const isPlayed = barProgress <= currentProgress;

        if (isInLoop) {
            ctx.fillStyle = isPlayed ? accentWave : `rgba(${accentWaveRgb}, 0.65)`;
        } else if (isPlayed) {
            ctx.fillStyle = accentWave;
        } else {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        }

        const topY = centerY - (barHeight / 2);
        ctx.beginPath();
        const r = Math.min(barWidth / 2, 2);
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(x, topY, barWidth, barHeight, r);
        } else {
            ctx.rect(x, topY, barWidth, barHeight);
        }
        ctx.fill();
    }

    // 3. Poignée / Marqueur Point A
    if (loopAProgress !== null) {
        const ax = loopAProgress * width;
        ctx.strokeStyle = accentWave;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ax, 0);
        ctx.lineTo(ax, height);
        ctx.stroke();

        ctx.fillStyle = accentWave;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(ax - 9, 0, 18, 15, [0, 0, 4, 4]);
        } else {
            ctx.rect(ax - 9, 0, 18, 15);
        }
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('A', ax, 11);
    }

    // 4. Poignée / Marqueur Point B
    if (loopBProgress !== null) {
        const bx = loopBProgress * width;
        ctx.strokeStyle = accentWave;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(bx, 0);
        ctx.lineTo(bx, height);
        ctx.stroke();

        ctx.fillStyle = accentWave;
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            ctx.roundRect(bx - 9, 0, 18, 15, [0, 0, 4, 4]);
        } else {
            ctx.rect(bx - 9, 0, 18, 15);
        }
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('B', bx, 11);
    }

    // 5. Tête de lecture (Playhead)
    const playheadX = currentProgress * width;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(playheadX, centerY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

function initTranscribeWaveformInteractions() {
    const canvas = document.getElementById('transcribe-waveform');
    if (!canvas || canvas._hasTranscribeListeners) return;
    canvas._hasTranscribeListeners = true;

    let dragMode = null; // 'handleA' | 'handleB' | 'loopWindow' | 'seek'
    let dragStartRatio = 0;
    let initialLoopA = 0;
    let initialLoopB = 0;

    function getCanvasX(e) {
        const rect = canvas.getBoundingClientRect();
        const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
        return Math.max(0, Math.min(clientX - rect.left, rect.width));
    }

    function updateCursor(x) {
        if (!transcribeState.audio || !transcribeState.duration) {
            canvas.style.cursor = 'default';
            return;
        }
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const duration = transcribeState.duration;
        const ax = transcribeState.loopA !== null ? (transcribeState.loopA / duration) * width : null;
        const bx = transcribeState.loopB !== null ? (transcribeState.loopB / duration) * width : null;

        if (ax !== null && Math.abs(x - ax) <= 14) {
            canvas.style.cursor = 'ew-resize';
        } else if (bx !== null && Math.abs(x - bx) <= 14) {
            canvas.style.cursor = 'ew-resize';
        } else if (ax !== null && bx !== null && x > Math.min(ax, bx) + 14 && x < Math.max(ax, bx) - 14 && transcribeState.loopABActive) {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = 'pointer';
        }
    }

    function onPointerDown(e) {
        if (!transcribeState.audio || !transcribeState.duration) return;
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const duration = transcribeState.duration;
        const x = getCanvasX(e);

        const ax = transcribeState.loopA !== null ? (transcribeState.loopA / duration) * width : null;
        const bx = transcribeState.loopB !== null ? (transcribeState.loopB / duration) * width : null;

        if (ax !== null && Math.abs(x - ax) <= 14) {
            dragMode = 'handleA';
            canvas.style.cursor = 'ew-resize';
        } else if (bx !== null && Math.abs(x - bx) <= 14) {
            dragMode = 'handleB';
            canvas.style.cursor = 'ew-resize';
        } else if (ax !== null && bx !== null && x > Math.min(ax, bx) + 14 && x < Math.max(ax, bx) - 14 && transcribeState.loopABActive) {
            dragMode = 'loopWindow';
            dragStartRatio = x / width;
            initialLoopA = transcribeState.loopA;
            initialLoopB = transcribeState.loopB;
            canvas.style.cursor = 'grabbing';
        } else {
            dragMode = 'seek';
            const targetTime = (x / width) * duration;
            transcribeState.audio.currentTime = targetTime;
            transcribeState.currentTime = targetTime;
            mettreAJourUIAudioProgress();
            dessinerWaveformTranscribe();
        }
    }

    function onPointerMove(e) {
        if (!dragMode) {
            const x = getCanvasX(e);
            updateCursor(x);
            return;
        }
        if (!transcribeState.audio || !transcribeState.duration) return;
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const duration = transcribeState.duration;
        const x = getCanvasX(e);
        const currentRatio = x / width;

        if (dragMode === 'handleA') {
            let targetTime = currentRatio * duration;
            if (transcribeState.loopB !== null && targetTime >= transcribeState.loopB - 0.2) {
                targetTime = Math.max(0, transcribeState.loopB - 0.2);
            }
            transcribeState.loopA = Math.max(0, Math.min(duration, targetTime));
            transcribeState.loopABActive = true;
            canvas.style.cursor = 'ew-resize';
        } else if (dragMode === 'handleB') {
            let targetTime = currentRatio * duration;
            if (transcribeState.loopA !== null && targetTime <= transcribeState.loopA + 0.2) {
                targetTime = Math.min(duration, transcribeState.loopA + 0.2);
            }
            transcribeState.loopB = Math.max(0, Math.min(duration, targetTime));
            transcribeState.loopABActive = true;
            canvas.style.cursor = 'ew-resize';
        } else if (dragMode === 'loopWindow') {
            const deltaRatio = currentRatio - dragStartRatio;
            const deltaTime = deltaRatio * duration;
            const loopLen = initialLoopB - initialLoopA;
            let newA = initialLoopA + deltaTime;
            if (newA < 0) newA = 0;
            if (newA + loopLen > duration) newA = duration - loopLen;
            transcribeState.loopA = newA;
            transcribeState.loopB = newA + loopLen;
            transcribeState.loopABActive = true;
            canvas.style.cursor = 'grabbing';
        } else if (dragMode === 'seek') {
            const targetTime = Math.max(0, Math.min(duration, currentRatio * duration));
            transcribeState.audio.currentTime = targetTime;
            transcribeState.currentTime = targetTime;
            canvas.style.cursor = 'pointer';
        }

        mettreAJourUIAudioProgress();
        dessinerWaveformTranscribe();
    }

    function onPointerUp() {
        if (dragMode) {
            dragMode = null;
            canvas.style.cursor = 'pointer';
        }
    }

    canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    canvas.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
}

function mettreAJourUIAudioProgress() {
    const curEl = document.getElementById('transcribe-time-current');
    const totEl = document.getElementById('transcribe-time-total');
    const loopStatusEl = document.getElementById('transcribe-loop-status');
    const btnA = document.getElementById('transcribe-btn-set-a');
    const btnB = document.getElementById('transcribe-btn-set-b');
    const loopToggleBtn = document.getElementById('transcribe-btn-loop-toggle');

    if (curEl) curEl.textContent = formaterTemps(Math.round(transcribeState.currentTime || 0));
    if (totEl) totEl.textContent = formaterTemps(Math.round(transcribeState.duration || 0));

    if (btnA) {
        if (transcribeState.loopA !== null) {
            btnA.textContent = `A (${formaterTemps(Math.round(transcribeState.loopA))})`;
            btnA.classList.add('btn-ghost-blue');
            btnA.classList.remove('btn-ghost-neutral');
        } else {
            btnA.textContent = t('audio.set_a');
            btnA.classList.remove('btn-ghost-blue');
            btnA.classList.add('btn-ghost-neutral');
        }
    }

    if (btnB) {
        if (transcribeState.loopB !== null) {
            btnB.textContent = `B (${formaterTemps(Math.round(transcribeState.loopB))})`;
            btnB.classList.add('btn-ghost-blue');
            btnB.classList.remove('btn-ghost-neutral');
        } else {
            btnB.textContent = t('audio.set_b');
            btnB.classList.remove('btn-ghost-blue');
            btnB.classList.add('btn-ghost-neutral');
        }
    }

    if (loopToggleBtn) {
        if (transcribeState.loopABActive) {
            loopToggleBtn.className = 'btn-action btn-ghost-blue active btn-square';
            loopToggleBtn.title = t('audio.loop_active_title');
        } else {
            loopToggleBtn.className = 'btn-action btn-ghost-neutral btn-square';
            loopToggleBtn.title = t('audio.loop_inactive_title');
        }
    }

    if (loopStatusEl) {
        if (transcribeState.loopA !== null && transcribeState.loopB !== null) {
            const dureeBoucle = Math.max(0, Math.round(transcribeState.loopB - transcribeState.loopA));
            if (transcribeState.loopABActive) {
                loopStatusEl.textContent = t('audio.loop_range_status', {
                    a: formaterTemps(Math.round(transcribeState.loopA)),
                    b: formaterTemps(Math.round(transcribeState.loopB)),
                    dur: dureeBoucle
                });
                loopStatusEl.style.color = 'var(--accent-blue)';
            } else {
                loopStatusEl.textContent = t('audio.loop_disabled_status', { dur: dureeBoucle });
                loopStatusEl.style.color = 'var(--text-muted)';
            }
        } else if (transcribeState.loopA !== null) {
            loopStatusEl.textContent = t('audio.loop_a_waiting_b', { a: formaterTemps(Math.round(transcribeState.loopA)) });
            loopStatusEl.style.color = 'var(--text-muted)';
        } else if (transcribeState.loopABActive) {
            loopStatusEl.textContent = t('audio.full_loop_active');
            loopStatusEl.style.color = 'var(--accent-blue)';
        } else {
            loopStatusEl.textContent = ``;
        }
    }
}

function mettreAJourCartesAudioStatus() {
    // 1. Bouton Play/Pause rond central de la modale (metro-audio-play-btn)
    const btnModalPlay = document.getElementById('transcribe-btn-play-pause');
    if (btnModalPlay) {
        if (transcribeState.isPlaying) {
            btnModalPlay.classList.add('playing');
            btnModalPlay.innerHTML = `<svg viewBox="0 0 24 24" style="width: 22px; height: 22px; fill: currentColor; display: block; margin: 0 auto;"><rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/></svg>`;
        } else {
            btnModalPlay.classList.remove('playing');
            btnModalPlay.innerHTML = `<svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: currentColor; margin-left: 3px; display: block;"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
        }
    }

    // 2. Boutons sur les cartes de la bibliothèque
    const btns = document.querySelectorAll('.btn-card-audio');
    btns.forEach(b => {
        const itemId = b.getAttribute('data-item-id');
        const isCurrentPlaying = (transcribeState.currentItemId !== null && Number(transcribeState.currentItemId) === Number(itemId) && transcribeState.isPlaying);
        if (isCurrentPlaying) {
            b.classList.add('active', 'btn-ghost-blue');
            b.classList.remove('btn-ghost-neutral');
            b.innerHTML = svgPause;
        } else {
            b.classList.remove('active', 'btn-ghost-blue');
            b.classList.add('btn-ghost-neutral');
            b.innerHTML = svgAudioPlay;
        }
    });

    // 3. Bouton HUD partition
    if (typeof majHUDPartition === 'function') {
        majHUDPartition();
    }

    // 4. Bouton pupitre top bar
    if (typeof majBoutonPupitreAudio === 'function') {
        majBoutonPupitreAudio();
    }
}

function ouvrirModalAudioPlayer() {
    const modal = document.getElementById('modal-audio-player');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            redimensionnerWaveformCanvas();
            dessinerWaveformTranscribe();
        }, 60);
    }
}

function fermerModalAudioPlayer() {
    const modal = document.getElementById('modal-audio-player');
    if (modal) {
        modal.style.display = 'none';
    }
    // L'audio continue en tâche de fond ! (Multitâche)
}

async function ouvrirLecteurAudioItem(id, event) {
    if (event) event.stopPropagation();
    const item = (typeof vocabulaireCache !== 'undefined' && Array.isArray(vocabulaireCache))
        ? vocabulaireCache.find(i => Number(i.id) === Number(id))
        : null;
    if (!item || !item.fichier_audio) return;

    // Si ce morceau est déjà chargé
    if (transcribeState.currentItemId !== null && Number(transcribeState.currentItemId) === Number(id) && transcribeState.audio) {
        if (transcribeState.isPlaying) {
            transcribeState.audio.pause();
            transcribeState.isPlaying = false;
            mettreAJourCartesAudioStatus();
            dessinerWaveformTranscribe();
        } else {
            try {
                await transcribeState.audio.play();
                transcribeState.isPlaying = true;
                mettreAJourCartesAudioStatus();
                dessinerWaveformTranscribe();
            } catch (e) {
                console.warn("Lecture audio bloquée :", e);
            }
        }
        ouvrirModalAudioPlayer();
        return;
    }

    await chargerAudioDansLecteur(item.fichier_audio, item.titre || item.nom, item.id, true);
    ouvrirModalAudioPlayer();
}

async function ouvrirLecteurAudioDepuisPartition() {
    try {
        let currentScoreItem = null;
        if (concertState.isActive && concertState.morceaux && concertState.currentIndex < concertState.morceaux.length) {
            currentScoreItem = concertState.morceaux[concertState.currentIndex];
        } else if (partitionState.itemId && typeof vocabulaireCache !== 'undefined') {
            currentScoreItem = vocabulaireCache.find(i => Number(i.id) === Number(partitionState.itemId));
        } else if (typeof vocabulaireCache !== 'undefined' && Array.isArray(vocabulaireCache)) {
            currentScoreItem = vocabulaireCache.find(i => (
                (i.titre && i.titre === partitionState.titre) ||
                (Array.isArray(i.fichier_image) && i.fichier_image.includes(partitionState.sourceNom)) ||
                i.fichier_image === partitionState.sourceNom
            ));
        }

        if (currentScoreItem && currentScoreItem.fichier_audio) {
            if (!transcribeState.currentItemId || Number(transcribeState.currentItemId) !== Number(currentScoreItem.id)) {
                await chargerAudioDansLecteur(currentScoreItem.fichier_audio, currentScoreItem.titre || currentScoreItem.nom, currentScoreItem.id, false);
            }
        }
    } catch (e) {
        console.error("Erreur chargement audio partition :", e);
    }
    ouvrirModalAudioPlayer();
}

function majBoutonPupitreAudio() {
    const btn = document.getElementById('btn-pupitre-audio');
    if (!btn) return;
    const currentItem = (currentShuffleQueue && currentShuffleQueue.length > currentShuffleIndex && currentShuffleIndex >= 0)
        ? currentShuffleQueue[currentShuffleIndex]
        : null;
    const hasAudio = !!(currentItem && currentItem.fichier_audio);

    if (hasAudio || (transcribeState.isPlaying && transcribeState.currentFichier)) {
        btn.style.display = 'inline-flex';
        if (transcribeState.isPlaying && transcribeState.currentItemId === (currentItem ? currentItem.id : transcribeState.currentItemId)) {
            btn.classList.add('active', 'btn-ghost-blue');
            btn.classList.remove('btn-ghost-neutral');
            btn.title = t('audio.player_active_title', { title: transcribeState.currentTitre || '' });
        } else {
            btn.classList.remove('active', 'btn-ghost-blue');
            btn.classList.add('btn-ghost-neutral');
            btn.title = hasAudio ? t('audio.listen_item_title', { title: currentItem.titre || currentItem.nom }) : t('audio.title');
        }
    } else {
        btn.style.display = 'none';
    }
}

async function ouvrirAudioMorceauActuelImmersif() {
    const currentItem = (currentShuffleQueue && currentShuffleQueue.length > currentShuffleIndex && currentShuffleIndex >= 0)
        ? currentShuffleQueue[currentShuffleIndex]
        : null;
    if (currentItem && currentItem.fichier_audio) {
        if (!transcribeState.currentItemId || Number(transcribeState.currentItemId) !== Number(currentItem.id)) {
            await chargerAudioDansLecteur(currentItem.fichier_audio, currentItem.titre || currentItem.nom, currentItem.id, false);
        }
        ouvrirModalAudioPlayer();
    } else if (transcribeState.currentFichier) {
        ouvrirModalAudioPlayer();
    }
}

// ==========================================
// --- DICTAPHONE EMBARQUÉ (JALON 10)    ---
// ==========================================
const dictaphoneState = {
    stream: null,
    mediaRecorder: null,
    audioChunks: [],
    audioBlob: null,
    audioUrl: null,
    isRecording: false,
    isPaused: false,
    timerInterval: null,
    elapsedSeconds: 0,
    targetItemId: null,
    audioContext: null,
    analyser: null,
    sourceNode: null,
    animFrameId: null,
    cancelled: false
};

function formaterTempsDictaphone(totalSec) {
    const s = Math.floor(totalSec % 60);
    const m = Math.floor((totalSec / 60) % 60);
    const h = Math.floor(totalSec / 3600);
    const pad = (n) => n.toString().padStart(2, '0');
    if (h > 0) {
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }
    return `${pad(m)}:${pad(s)}`;
}

function majBoutonPupitreDictaphone() {
    const btn = document.getElementById('btn-pupitre-dictaphone');
    if (!btn) return;
    if (dictaphoneState.isRecording) {
        btn.classList.add('active', 'btn-ghost-red');
        btn.classList.remove('btn-ghost-neutral');
        btn.title = t('dictaphone.rec_active_btn');
    } else {
        btn.classList.remove('active', 'btn-ghost-red');
        btn.classList.add('btn-ghost-neutral');
        btn.title = t('dictaphone.rec_idle_btn');
    }
}

function majBoutonBiblioDictaphone() {
    const btn = document.getElementById('btn-biblio-dictaphone');
    if (!btn) return;
    if (dictaphoneState.isRecording) {
        btn.classList.add('active', 'btn-ghost-red');
        btn.classList.remove('btn-ghost-neutral');
        btn.title = t('dictaphone.rec_active_btn');
    } else {
        btn.classList.remove('active', 'btn-ghost-red');
        btn.classList.add('btn-ghost-neutral');
        btn.title = t('dictaphone.rec_idle_btn');
    }
}

function dessinerVisualiseurMicroNeutre() {
    const canvas = document.getElementById('dictaphone-visualizer');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && Math.round(rect.width) !== canvas.width) {
        canvas.width = Math.round(rect.width);
    }
    const width = canvas.width || 440;
    const height = canvas.height || 60;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    const centerY = height / 2;

    // Ligne de base subtile
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(12, centerY);
    ctx.lineTo(width - 12, centerY);
    ctx.stroke();

    // Barres de repos
    const numBars = 36;
    const barWidth = 4;
    const availableW = width - 24;
    const gap = Math.max(2, (availableW - numBars * barWidth) / (numBars - 1));
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';

    for (let i = 0; i < numBars; i++) {
        const x = 12 + i * (barWidth + gap);
        const barH = 4;
        if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(x, centerY - barH / 2, barWidth, barH, 2);
            ctx.fill();
        } else {
            ctx.fillRect(x, centerY - barH / 2, barWidth, barH);
        }
    }
    ctx.restore();
}

function animerVisualiseurMicro() {
    if (!dictaphoneState.isRecording) return;
    const canvas = document.getElementById('dictaphone-visualizer');
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    if (rect.width > 0 && Math.round(rect.width) !== canvas.width) {
        canvas.width = Math.round(rect.width);
    }
    const width = canvas.width || 440;
    const height = canvas.height || 60;
    const ctx = canvas.getContext('2d');
    const centerY = height / 2;

    if (dictaphoneState.isPaused) {
        // En pause : affichage discret sans réanimer
        return;
    }

    if (dictaphoneState.analyser) {
        const bufferLength = dictaphoneState.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        dictaphoneState.analyser.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, width, height);

        const numBars = 36;
        const barWidth = 4;
        const availableW = width - 24;
        const gap = Math.max(2, (availableW - numBars * barWidth) / (numBars - 1));
        const step = Math.max(1, Math.floor(bufferLength / numBars));

        for (let i = 0; i < numBars; i++) {
            const rawVal = dataArray[i * step] || 0;
            const ratio = rawVal / 255;
            const barH = Math.max(4, ratio * (height * 0.90));
            const x = 12 + i * (barWidth + gap);

            const gradient = ctx.createLinearGradient(0, centerY - barH / 2, 0, centerY + barH / 2);
            gradient.addColorStop(0, '#f85149');
            gradient.addColorStop(0.5, '#ff7b72');
            gradient.addColorStop(1, '#f85149');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(x, centerY - barH / 2, barWidth, barH, 2);
            } else {
                ctx.rect(x, centerY - barH / 2, barWidth, barH);
            }
            ctx.fill();
        }
    }

    dictaphoneState.animFrameId = requestAnimationFrame(animerVisualiseurMicro);
}

function arreterStreamMicro() {
    if (dictaphoneState.animFrameId) {
        cancelAnimationFrame(dictaphoneState.animFrameId);
        dictaphoneState.animFrameId = null;
    }
    if (dictaphoneState.stream) {
        try {
            dictaphoneState.stream.getTracks().forEach(track => track.stop());
        } catch (e) { }
        dictaphoneState.stream = null;
    }
    if (dictaphoneState.audioContext) {
        try {
            dictaphoneState.audioContext.close();
        } catch (e) { }
        dictaphoneState.audioContext = null;
        dictaphoneState.analyser = null;
        dictaphoneState.sourceNode = null;
    }
}

function reinitialiserUIDictaphone() {
    dictaphoneState.isRecording = false;
    dictaphoneState.isPaused = false;
    dictaphoneState.elapsedSeconds = 0;
    dictaphoneState.audioChunks = [];
    dictaphoneState.audioBlob = null;
    if (dictaphoneState.audioUrl) {
        try { URL.revokeObjectURL(dictaphoneState.audioUrl); } catch (e) { }
        dictaphoneState.audioUrl = null;
    }

    const timerLive = document.getElementById('dictaphone-timer-live');
    if (timerLive) timerLive.textContent = "00:00";

    const recStatus = document.getElementById('dictaphone-rec-status');
    if (recStatus) recStatus.textContent = t('dictaphone.ready');

    const recDot = document.getElementById('dictaphone-rec-indicator');
    if (recDot) recDot.classList.remove('active');

    const btnToggle = document.getElementById('dictaphone-btn-toggle-rec');
    if (btnToggle) {
        btnToggle.classList.remove('recording');
        btnToggle.title = t('dictaphone.start_rec');
    }

    const btnCancel = document.getElementById('dictaphone-btn-cancel');
    if (btnCancel) btnCancel.style.display = 'none';

    const btnPause = document.getElementById('dictaphone-btn-pause');
    if (btnPause) {
        btnPause.style.display = 'none';
        btnPause.title = t('dictaphone.pause_rec');
        btnPause.innerHTML = `<svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
    }

    dessinerVisualiseurMicroNeutre();
    majBoutonPupitreDictaphone();
    majBoutonBiblioDictaphone();
}

async function ouvrirModalDictaphone(targetItemId = null) {
    if (typeof getSystemHost === 'function') {
        const micStatus = await getSystemHost().ensureMicrophone();
        if (micStatus === 'permanently_denied') {
            ouvrirModalMicPermission();
            return;
        }
    }
    if (!targetItemId && typeof isPupitreActive !== 'undefined' && isPupitreActive && typeof currentShuffleQueue !== 'undefined' && Array.isArray(currentShuffleQueue) && currentShuffleQueue.length > currentShuffleIndex && currentShuffleIndex >= 0) {
        targetItemId = currentShuffleQueue[currentShuffleIndex].id;
    }

    dictaphoneState.targetItemId = targetItemId;

    const vueRecord = document.getElementById('dictaphone-vue-record');
    const vueResultat = document.getElementById('dictaphone-vue-resultat');
    if (vueRecord) vueRecord.style.display = 'block';
    if (vueResultat) vueResultat.style.display = 'none';

    const selectCat = document.getElementById('dictaphone-select-categorie');
    if (selectCat) {
        selectCat.innerHTML = '';
        const cats = (typeof SOUS_CATEGORIES === 'object' && SOUS_CATEGORIES) ? Object.keys(SOUS_CATEGORIES) : [getCategorieParDefaut()];
        cats.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            selectCat.appendChild(opt);
        });
        majSousCategoriesDictaphone();
    }

    reinitialiserUIDictaphone();

    const modal = document.getElementById('modal-dictaphone');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => {
            dessinerVisualiseurMicroNeutre();
        }, 60);
    }
}

function majSousCategoriesDictaphone() {
    const selectCat = document.getElementById('dictaphone-select-categorie');
    const selectSousCat = document.getElementById('dictaphone-select-sous-categorie');
    if (!selectCat || !selectSousCat) return;

    const cat = selectCat.value;
    const sousCats = (typeof SOUS_CATEGORIES === 'object' && SOUS_CATEGORIES && Array.isArray(SOUS_CATEGORIES[cat]))
        ? SOUS_CATEGORIES[cat]
        : [];

    selectSousCat.innerHTML = '';
    if (sousCats.length > 0) {
        selectSousCat.style.display = 'block';
        sousCats.forEach((sc, idx) => {
            const opt = document.createElement('option');
            opt.value = sc;
            opt.textContent = sc;
            if (idx === 0) opt.selected = true;
            selectSousCat.appendChild(opt);
        });
        selectSousCat.value = sousCats[0];
    } else {
        selectSousCat.style.display = 'none';
    }
}

function ouvrirDictaphoneDepuisImmersif() {
    let targetId = null;
    if (typeof currentShuffleQueue !== 'undefined' && Array.isArray(currentShuffleQueue) && currentShuffleQueue.length > currentShuffleIndex && currentShuffleIndex >= 0) {
        targetId = currentShuffleQueue[currentShuffleIndex].id;
    }
    ouvrirModalDictaphone(targetId);
}

function fermerModalDictaphone() {
    if (dictaphoneState.isRecording) {
        if (!confirm(t('dictaphone.confirm_abort_close'))) {
            return;
        }
        dictaphoneState.cancelled = true;
        dictaphoneState.isRecording = false;
        if (dictaphoneState.mediaRecorder && dictaphoneState.mediaRecorder.state !== 'inactive') {
            try { dictaphoneState.mediaRecorder.stop(); } catch (e) { }
        }
    }

    arreterStreamMicro();
    if (dictaphoneState.timerInterval) {
        clearInterval(dictaphoneState.timerInterval);
        dictaphoneState.timerInterval = null;
    }

    const audioPlayer = document.getElementById('dictaphone-audio-player');
    if (audioPlayer) {
        try { audioPlayer.pause(); } catch (e) { }
    }

    const modal = document.getElementById('modal-dictaphone');
    if (modal) modal.style.display = 'none';

    majBoutonPupitreDictaphone();
    majBoutonBiblioDictaphone();
}

async function basculerEnregistrementDictaphone() {
    if (dictaphoneState.isRecording) {
        arreterEnregistrementDictaphone();
    } else {
        await demarrerEnregistrementDictaphone();
    }
}

async function demarrerEnregistrementDictaphone() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert(t('dictaphone.unavailable_alert'));
        return;
    }

    try {
        if (typeof transcribeState !== 'undefined' && transcribeState.audio && transcribeState.isPlaying) {
            transcribeState.audio.pause();
            transcribeState.isPlaying = false;
            mettreAJourCartesAudioStatus();
            dessinerWaveformTranscribe();
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        dictaphoneState.stream = stream;

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            dictaphoneState.audioContext = new AudioContextClass();
            dictaphoneState.analyser = dictaphoneState.audioContext.createAnalyser();
            dictaphoneState.analyser.fftSize = 128;
            dictaphoneState.sourceNode = dictaphoneState.audioContext.createMediaStreamSource(stream);
            dictaphoneState.sourceNode.connect(dictaphoneState.analyser);
        }

        let mimeType = '';
        if (typeof MediaRecorder !== 'undefined') {
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mimeType = 'audio/webm;codecs=opus';
            else if (MediaRecorder.isTypeSupported('audio/webm')) mimeType = 'audio/webm';
            else if (MediaRecorder.isTypeSupported('audio/mp4')) mimeType = 'audio/mp4';
            else if (MediaRecorder.isTypeSupported('audio/aac')) mimeType = 'audio/aac';
        }

        const options = mimeType ? { mimeType } : undefined;
        dictaphoneState.mediaRecorder = new MediaRecorder(stream, options);
        dictaphoneState.audioChunks = [];
        dictaphoneState.cancelled = false;

        dictaphoneState.mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                dictaphoneState.audioChunks.push(event.data);
            }
        };

        dictaphoneState.mediaRecorder.onstop = () => {
            arreterStreamMicro();
            if (dictaphoneState.timerInterval) {
                clearInterval(dictaphoneState.timerInterval);
                dictaphoneState.timerInterval = null;
            }
            if (dictaphoneState.cancelled) {
                reinitialiserUIDictaphone();
            } else {
                finaliserPriseDictaphone();
            }
        };

        dictaphoneState.mediaRecorder.start(250);
        dictaphoneState.isRecording = true;
        dictaphoneState.isPaused = false;
        dictaphoneState.elapsedSeconds = 0;

        const timerLive = document.getElementById('dictaphone-timer-live');
        if (timerLive) timerLive.textContent = "00:00";

        const recStatus = document.getElementById('dictaphone-rec-status');
        if (recStatus) recStatus.textContent = t('dictaphone.recording');

        const recDot = document.getElementById('dictaphone-rec-indicator');
        if (recDot) recDot.classList.add('active');

        const btnToggle = document.getElementById('dictaphone-btn-toggle-rec');
        if (btnToggle) {
            btnToggle.classList.add('recording');
            btnToggle.title = t('dictaphone.stop_save_rec');
        }

        const btnCancel = document.getElementById('dictaphone-btn-cancel');
        if (btnCancel) btnCancel.style.display = 'inline-flex';

        const btnPause = document.getElementById('dictaphone-btn-pause');
        if (btnPause) {
            btnPause.style.display = 'inline-flex';
            btnPause.title = t('dictaphone.pause_rec');
            btnPause.innerHTML = `<svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
        }

        dictaphoneState.timerInterval = setInterval(() => {
            if (!dictaphoneState.isPaused) {
                dictaphoneState.elapsedSeconds++;
                if (timerLive) timerLive.textContent = formaterTempsDictaphone(dictaphoneState.elapsedSeconds);
            }
        }, 1000);

        majBoutonPupitreDictaphone();
        majBoutonBiblioDictaphone();
        animerVisualiseurMicro();
    } catch (err) {
        console.error("Erreur accès microphone :", err);
        if (err && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.name === 'SecurityError')) {
            ouvrirModalMicPermission();
        } else {
            alert(t('dictaphone.mic_error_alert', { err: err.message || err.name || "Permission error" }));
        }
        reinitialiserUIDictaphone();
    }
}

function arreterEnregistrementDictaphone() {
    if (!dictaphoneState.isRecording || !dictaphoneState.mediaRecorder) return;
    dictaphoneState.isRecording = false;
    dictaphoneState.isPaused = false;
    dictaphoneState.cancelled = false;
    try {
        if (dictaphoneState.mediaRecorder.state !== 'inactive') {
            dictaphoneState.mediaRecorder.stop();
        }
    } catch (e) {
        console.warn("Erreur arrêt MediaRecorder :", e);
    }
    majBoutonPupitreDictaphone();
    majBoutonBiblioDictaphone();
}

function basculerPauseDictaphone() {
    if (!dictaphoneState.isRecording || !dictaphoneState.mediaRecorder) return;
    const btnPause = document.getElementById('dictaphone-btn-pause');
    const recStatus = document.getElementById('dictaphone-rec-status');
    const recDot = document.getElementById('dictaphone-rec-indicator');

    if (!dictaphoneState.isPaused) {
        try {
            dictaphoneState.mediaRecorder.pause();
            dictaphoneState.isPaused = true;
            if (recStatus) recStatus.textContent = t('dictaphone.paused');
            if (recDot) recDot.classList.remove('active');
            if (btnPause) {
                btnPause.title = t('dictaphone.resume_rec');
                btnPause.innerHTML = `<svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor; margin-left: 2px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
            }
        } catch (e) { }
    } else {
        try {
            dictaphoneState.mediaRecorder.resume();
            dictaphoneState.isPaused = false;
            if (recStatus) recStatus.textContent = t('dictaphone.recording');
            if (recDot) recDot.classList.add('active');
            if (btnPause) {
                btnPause.title = t('dictaphone.pause_rec');
                btnPause.innerHTML = `<svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: currentColor;"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
            }
            animerVisualiseurMicro();
        } catch (e) { }
    }
}

function annulerPriseDictaphone() {
    if (!confirm(t('dictaphone.confirm_cancel_rec'))) return;
    dictaphoneState.cancelled = true;
    dictaphoneState.isRecording = false;
    dictaphoneState.isPaused = false;
    if (dictaphoneState.mediaRecorder && dictaphoneState.mediaRecorder.state !== 'inactive') {
        try { dictaphoneState.mediaRecorder.stop(); } catch (e) { }
    } else {
        arreterStreamMicro();
        if (dictaphoneState.timerInterval) clearInterval(dictaphoneState.timerInterval);
        reinitialiserUIDictaphone();
    }
    majBoutonPupitreDictaphone();
    majBoutonBiblioDictaphone();
}

function finaliserPriseDictaphone() {
    const mimeType = (dictaphoneState.mediaRecorder && dictaphoneState.mediaRecorder.mimeType) || 'audio/webm';
    dictaphoneState.audioBlob = new Blob(dictaphoneState.audioChunks, { type: mimeType });
    dictaphoneState.audioUrl = URL.createObjectURL(dictaphoneState.audioBlob);

    const audioPlayer = document.getElementById('dictaphone-audio-player');
    if (audioPlayer) {
        audioPlayer.src = dictaphoneState.audioUrl;
        audioPlayer.load();
    }

    const dureeEl = document.getElementById('dictaphone-duree-prise');
    if (dureeEl) {
        dureeEl.textContent = formaterTempsDictaphone(dictaphoneState.elapsedSeconds);
    }

    const inputTitre = document.getElementById('dictaphone-input-titre');
    let defaultTitre = '';
    const now = new Date();
    const locale = typeof getLocaleCode === 'function' ? getLocaleCode() : 'fr-FR';
    const dateStr = now.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
    const heureStr = now.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });

    let targetItem = null;
    if (dictaphoneState.targetItemId && typeof vocabulaireCache !== 'undefined' && Array.isArray(vocabulaireCache)) {
        targetItem = vocabulaireCache.find(i => Number(i.id) === Number(dictaphoneState.targetItemId));
    }

    if (targetItem) {
        defaultTitre = t('dictaphone.default_title_with_item', { title: targetItem.titre || targetItem.nom, date: dateStr });
    } else {
        defaultTitre = t('dictaphone.default_title', { date: dateStr, time: heureStr });
    }
    if (inputTitre) inputTitre.value = defaultTitre;

    const containerAssocier = document.getElementById('container-dictaphone-associer');
    const btnAssocier = document.getElementById('dictaphone-btn-associer-morceau');
    const txtAssocier = document.getElementById('dictaphone-txt-associer-morceau');
    if (btnAssocier && txtAssocier) {
        if (targetItem) {
            if (containerAssocier) containerAssocier.style.display = 'flex';
            btnAssocier.style.display = 'inline-flex';
            txtAssocier.textContent = t('dictaphone.link_to_item_btn', { title: targetItem.titre || targetItem.nom });
            btnAssocier.title = t('dictaphone.link_to_item_title', { title: targetItem.titre || targetItem.nom });
        } else {
            if (containerAssocier) containerAssocier.style.display = 'none';
            btnAssocier.style.display = 'none';
        }
    }

    const vueRecord = document.getElementById('dictaphone-vue-record');
    const vueResultat = document.getElementById('dictaphone-vue-resultat');
    if (vueRecord) vueRecord.style.display = 'none';
    if (vueResultat) vueResultat.style.display = 'block';
}

function recommencerPriseDictaphone() {
    const audioPlayer = document.getElementById('dictaphone-audio-player');
    if (audioPlayer) {
        try { audioPlayer.pause(); } catch (e) { }
        audioPlayer.src = '';
    }
    if (dictaphoneState.audioUrl) {
        try { URL.revokeObjectURL(dictaphoneState.audioUrl); } catch (e) { }
        dictaphoneState.audioUrl = null;
    }
    dictaphoneState.audioBlob = null;
    dictaphoneState.audioChunks = [];

    const vueRecord = document.getElementById('dictaphone-vue-record');
    const vueResultat = document.getElementById('dictaphone-vue-resultat');
    if (vueRecord) vueRecord.style.display = 'block';
    if (vueResultat) vueResultat.style.display = 'none';

    reinitialiserUIDictaphone();
}

async function sauvegarderDictaphoneAssocieMorceau() {
    if (!dictaphoneState.audioBlob || !dictaphoneState.targetItemId) return;
    const btn = document.getElementById('dictaphone-btn-associer-morceau');
    const origHTML = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span>${t('dictaphone.saving')}</span>`;
    }

    try {
        let ext = 'webm';
        if (dictaphoneState.audioBlob.type) {
            if (dictaphoneState.audioBlob.type.includes('mp4')) ext = 'mp4';
            else if (dictaphoneState.audioBlob.type.includes('ogg')) ext = 'ogg';
            else if (dictaphoneState.audioBlob.type.includes('wav')) ext = 'wav';
        }

        const titre = (document.getElementById('dictaphone-input-titre').value || '').trim() || 'prise';
        const cleanTitre = titre.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
        const fileName = `${cleanTitre}.${ext}`;
        const audioFile = new File([dictaphoneState.audioBlob], fileName, { type: dictaphoneState.audioBlob.type || 'audio/webm' });

        const formData = new FormData();
        formData.append('fichier_audio', audioFile);

        await apiFetch(`/vocabulaire/${dictaphoneState.targetItemId}`, { method: 'PUT', body: formData });
        await chargerVocabulaireApi();

        if (typeof currentShuffleQueue !== 'undefined' && Array.isArray(currentShuffleQueue) && currentShuffleQueue[currentShuffleIndex] && Number(currentShuffleQueue[currentShuffleIndex].id) === Number(dictaphoneState.targetItemId)) {
            const updated = vocabulaireCache.find(i => Number(i.id) === Number(dictaphoneState.targetItemId));
            if (updated) currentShuffleQueue[currentShuffleIndex] = updated;
            majBoutonPupitreAudio();
        }

        if (typeof renderBibliotheque === 'function') {
            renderBibliotheque();
        }

        const targetItem = (typeof vocabulaireCache !== 'undefined' && Array.isArray(vocabulaireCache)) ? vocabulaireCache.find(i => Number(i.id) === Number(dictaphoneState.targetItemId)) : null;
        alert(t('dictaphone.linked_success', { title: targetItem ? (targetItem.titre || targetItem.nom) : '' }));
        fermerModalDictaphone();
    } catch (err) {
        console.error("Erreur association audio dictaphone :", err);
        alert(t('dictaphone.link_error', { error: err.message || err }));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = origHTML;
        }
    }
}

async function sauvegarderDictaphoneNouvelItem() {
    if (!dictaphoneState.audioBlob) return;
    const inputTitre = document.getElementById('dictaphone-input-titre');
    const locale = typeof getLocaleCode === 'function' ? getLocaleCode() : 'fr-FR';
    const titre = (inputTitre ? inputTitre.value : '').trim() || `Take ${new Date().toLocaleDateString(locale)}`;
    const selectCat = document.getElementById('dictaphone-select-categorie');
    const categorie = (selectCat ? selectCat.value : '') || getCategorieParDefaut();

    try {
        let ext = 'webm';
        if (dictaphoneState.audioBlob.type) {
            if (dictaphoneState.audioBlob.type.includes('mp4')) ext = 'mp4';
            else if (dictaphoneState.audioBlob.type.includes('ogg')) ext = 'ogg';
            else if (dictaphoneState.audioBlob.type.includes('wav')) ext = 'wav';
        }
        const cleanTitre = titre.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
        const fileName = `${cleanTitre}.${ext}`;
        const audioFile = new File([dictaphoneState.audioBlob], fileName, { type: dictaphoneState.audioBlob.type || 'audio/webm' });

        const selectSousCat = document.getElementById('dictaphone-select-sous-categorie');
        const sousCat = (selectSousCat && selectSousCat.style.display !== 'none' ? selectSousCat.value : '').trim();

        const formData = new FormData();
        formData.append('nom', titre);
        formData.append('type_item', categorie);
        if (sousCat) formData.append('sous_categorie', sousCat);
        formData.append('fichier_audio', audioFile);

        await apiFetch('/vocabulaire', { method: 'POST', body: formData });
        await chargerVocabulaireApi();

        if (typeof renderBibliotheque === 'function') {
            renderBibliotheque();
        }

        const detailSousCat = sousCat ? (getCurrentLang() === 'en' ? ` (subcategory "${sousCat}")` : ` (sous-catégorie "${sousCat}")`) : '';
        alert(t('dictaphone.added_lib_success', { title: titre, cat: categorie, sub: detailSousCat }));
        fermerModalDictaphone();
    } catch (err) {
        console.error("Erreur création item dictaphone :", err);
        alert(t('dictaphone.add_lib_error', { err: err.message || err }));
    }
}

async function telechargerFichierDictaphone() {
    if (!dictaphoneState.audioBlob) return;
    const inputTitre = document.getElementById('dictaphone-input-titre');
    const titre = (inputTitre ? inputTitre.value : '').trim() || `enregistrement_${Date.now()}`;
    const cleanTitre = titre.replace(/[^a-zA-Z0-9_\-]/g, '_');

    let ext = 'webm';
    if (dictaphoneState.audioBlob.type) {
        if (dictaphoneState.audioBlob.type.includes('mp4')) ext = 'mp4';
        else if (dictaphoneState.audioBlob.type.includes('ogg')) ext = 'ogg';
        else if (dictaphoneState.audioBlob.type.includes('wav')) ext = 'wav';
    }

    const fileName = `${cleanTitre}.${ext}`;
    await telechargerBlob(dictaphoneState.audioBlob, fileName);
}

function safeSortSeances(seances) {
    return seances.sort((a, b) => {
        const timeA = a.date_seance ? new Date(a.date_seance).getTime() : 0;
        const timeB = b.date_seance ? new Date(b.date_seance).getTime() : 0;
        if (timeA !== timeB && !isNaN(timeA) && !isNaN(timeB)) return timeB - timeA;
        return (b.id || 0) - (a.id || 0);
    });
}

async function chargerDerniereSeance() {
    try {
        let seances = await apiFetch(`/seances`);
        if (!Array.isArray(seances)) seances = [];
        safeSortSeances(seances);

        const seanceActive = seances.find(s => s.statut === 'en_cours');

        if (seanceActive) {
            seanceEnCours = seanceActive;
            try {
                const savedMetaStr = localStorage.getItem('seance_active_' + seanceEnCours.id);
                if (savedMetaStr) {
                    const savedMeta = JSON.parse(savedMetaStr);
                    if (savedMeta.timestamp_debut) seanceEnCours.timestamp_debut = savedMeta.timestamp_debut;
                    if (savedMeta.temps_pause_cumule_ms) seanceEnCours.temps_pause_cumule_ms = savedMeta.temps_pause_cumule_ms;
                    if (savedMeta.pause_active_debut) seanceEnCours.pause_active_debut = savedMeta.pause_active_debut;
                }
            } catch (err) { }
            afficherSeancePratique();
            afficherVue('pratique');
            majAffichageDureeLive();
        } else {
            seanceEnCours = null;
            const btnRetour = document.getElementById('btn-nav-retour');
            if (btnRetour) {
                btnRetour.style.setProperty('display', 'none', 'important');
                btnRetour.classList.add('hidden');
            }
            const btnCafe = document.getElementById('btn-pause-cafe');
            if (btnCafe) {
                btnCafe.style.setProperty('display', 'none', 'important');
                btnCafe.classList.add('hidden');
            }
            afficherVue('historique');
        }
    } catch (e) {
        seanceEnCours = null;
        const btnRetour = document.getElementById('btn-nav-retour');
        if (btnRetour) {
            btnRetour.style.setProperty('display', 'none', 'important');
            btnRetour.classList.add('hidden');
        }
        const btnCafe = document.getElementById('btn-pause-cafe');
        if (btnCafe) {
            btnCafe.style.setProperty('display', 'none', 'important');
            btnCafe.classList.add('hidden');
        }
        afficherVue('historique');
    }
}

function afficherSeancePratique(forcerRebuild = false) {
    if (!seanceEnCours) return;
    const [y, m, d] = seanceEnCours.date_seance.split('-');
    const locale = typeof getLocaleCode === 'function' ? getLocaleCode() : 'fr-FR';
    const dateBrute = new Date(y, m - 1, d).toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('titre-date').textContent = t('practice.session_of', { date: getCurrentLang() === 'en' ? dateBrute : dateBrute.toLowerCase() });
    const elTon = document.getElementById('tonalite');
    if (elTon) {
        if (seanceEnCours.tonalite_du_jour) {
            elTon.style.display = '';
            elTon.textContent = t('practice.main_key', { key: formatTonalite(seanceEnCours.tonalite_du_jour) });
        } else {
            elTon.style.display = 'none';
            elTon.textContent = "";
        }
    }

    const conteneur = document.getElementById('conteneur-items');
    if (!forcerRebuild && conteneur && conteneur.dataset.seanceId === String(seanceEnCours.id) && conteneur.children.length > 0) {
        majAffichageDureeLive();
        return;
    }

    conteneur.innerHTML = "";
    conteneur.dataset.seanceId = String(seanceEnCours.id);

    const aTimerActif = activeTimer.index !== null;
    const activeIndex = activeTimer.index;
    const activeRemaining = activeTimer.remainingSecsAtPause;
    const activeIsPaused = activeTimer.isPaused;
    const activeIsOvertime = activeTimer.isOvertime;

    if (!aTimerActif) {
        if (activeTimer.interval) clearInterval(activeTimer.interval);
        activeTimer.index = null; activeTimer.isPaused = false; stopMetronome();
    }

    const btnPause = document.getElementById('btn-pause-global');
    if (!aTimerActif) {
        btnPause.disabled = true; btnPause.innerHTML = svgPauseSquare; btnPause.className = 'btn-action btn-ghost-neutral btn-square';
    } else {
        btnPause.disabled = false;
        btnPause.innerHTML = activeIsPaused ? svgPlaySquare : svgPauseSquare;
        btnPause.className = activeIsPaused ? 'btn-action btn-ghost-amber btn-square' : 'btn-action btn-ghost-blue btn-square';
    }

    seanceEnCours.items.forEach((item, index) => {
        const estActif = (aTimerActif && activeIndex === index);
        const div = document.createElement('div');
        div.id = `card-${index}`; div.className = `item-card ${item.fait ? 'done' : ''} ${estActif ? 'active' : ''}`;
        div.onclick = () => gererClicCarte(index);

        let badgesHtml = `<div class="badges-container">`;
        const scArray = (Array.isArray(item.sous_categories) ? item.sous_categories : (item.sous_categorie ? [item.sous_categorie] : [])).filter(sc => !estStyleIrealAFiltrer(sc));
        scArray.forEach(sc => {
            const labelSc = (typeof estLabelFavoris === 'function' && estLabelFavoris(sc)) ? t('common.favorites') : sc;
            badgesHtml += `<span class="badge badge-blue">${labelSc}</span>`;
        });
        if (item.tempo) badgesHtml += `<button class="badge badge-tempo" onclick="toggleMetronome(${item.tempo}, event, this)">${svgMetronome} ${item.tempo} bpm</button>`;
        if (item.type_gamme) badgesHtml += `<span class="badge badge-neutral">${item.type_gamme}</span>`;
        if (item.mains) badgesHtml += `<span class="badge badge-neutral">${item.mains}</span>`;
        if (item.lien_ressource) badgesHtml += `<a href="${item.lien_ressource}" target="_blank" class="badge badge-link" onclick="event.stopPropagation()">${t('common.resource')}</a>`;
        badgesHtml += `</div>`;

        let chronoAffiche = `${item.temps_prevu} min`;
        let badgeTempsClass = 'badge-temps';
        if (estActif) {
            const tFormate = formaterTemps(activeRemaining);
            if (activeIsOvertime) {
                badgeTempsClass = 'badge-temps overtime';
                chronoAffiche = activeIsPaused ? t('immersive.paused_overtime', { time: tFormate }) : `+ ${tFormate}`;
            } else if (activeIsPaused) {
                badgeTempsClass = 'badge-temps paused';
                chronoAffiche = t('immersive.paused_time', { time: tFormate });
            } else {
                badgeTempsClass = 'badge-temps running';
                chronoAffiche = `${tFormate}`;
            }
        }

        div.innerHTML = `
            <div class="item-header">
                <div style="display: flex; align-items: center;">
                    <span class="drag-handle" title="${t('common.reorder')}" onclick="event.stopPropagation()"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg></span>
                    <span class="categorie">${item.categorie}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span class="${badgeTempsClass}" id="timer-display-${index}">${chronoAffiche}</span>
                    <div class="exercise-check-indicator ${item.fait ? 'checked' : ''}" id="check-exo-${index}">
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.8"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                </div>
            </div>
            ${badgesHtml}
        `;
        conteneur.appendChild(div);
    });

    const btnTerminer = document.getElementById('btn-terminer');
    document.getElementById('fin-seance-container').style.display = 'flex'; btnTerminer.style.display = 'inline-flex';
    document.getElementById('fin-seance-actions').style.display = 'none';
    btnTerminer.className = "btn-action btn-ghost-neutral"; btnTerminer.innerHTML = `${svgTick} ${t('practice.finish_session')}`;
    btnTerminer.onclick = demanderFinSeance; verifierFinSeance();
}

async function gererClicCarte(index) {
    const item = seanceEnCours.items[index]; initAudio(); const btnPause = document.getElementById('btn-pause-global');
    resetDerniereInteraction();

    if (!seanceEnCours.timestamp_debut) {
        seanceEnCours.timestamp_debut = Date.now();
        seanceEnCours.temps_pause_cumule_ms = 0;
        seanceEnCours.pause_active_debut = null;
    }
    if (seanceEnCours.pause_active_debut) {
        seanceEnCours.temps_pause_cumule_ms = (seanceEnCours.temps_pause_cumule_ms || 0) + (Date.now() - seanceEnCours.pause_active_debut);
        seanceEnCours.pause_active_debut = null;
    }
    sauvegarderEtatSeance();
    majAffichageDureeLive();

    if (item.fait) {
        item.fait = false;
        let remaining = (item.temps_restant != null) ? item.temps_restant : (Number(item.temps_prevu) * 60);
        const cardEl = document.getElementById(`card-${index}`);
        if (cardEl) cardEl.classList.remove('done');
        const checkEl = document.getElementById(`check-exo-${index}`);
        if (checkEl) checkEl.classList.remove('checked');
        try { await apiFetch(`/seances/${seanceEnCours.id}`, { method: 'PUT', body: JSON.stringify(seanceEnCours) }); } catch (e) { }
        verifierFinSeance(); activerChronoItem(index, remaining, item, btnPause, cardEl);
        await lancerImmersif(item);
    } else if (activeTimer.index === index) {
        await lancerImmersif(item);
    } else {
        let remaining = (item.temps_restant != null) ? item.temps_restant : (Number(item.temps_prevu) * 60);
        activerChronoItem(index, remaining, item, btnPause, document.getElementById(`card-${index}`));
        await lancerImmersif(item);
    }
}

// ==========================================
// --- CHRONOMÈTRES ET POMODORO           ---
// ==========================================

function reinitialiserPomodoro() {
    if (globalTimerData.interval) {
        clearInterval(globalTimerData.interval);
        globalTimerData.interval = null;
    }
    if (breakTimerData.interval) {
        clearInterval(breakTimerData.interval);
        breakTimerData.interval = null;
    }
    globalTimerData.isRunning = false;
    globalTimerData.isBreakPending = false;
    globalTimerData.endTime = null;
    globalTimerData.remaining = getPomodoroWorkSec();
    breakTimerData.endTime = null;

    const btn = document.getElementById('btn-pause-cafe');
    if (btn) {
        btn.style.setProperty('display', 'none', 'important');
        btn.classList.add('hidden');
        btn.classList.remove('btn-fade-out');
        btn.className = 'btn-action btn-ghost-blue btn-square hidden';
    }
    const txt = document.getElementById('texte-pause-cafe');
    if (txt) {
        txt.style.display = 'none';
        txt.textContent = '';
    }
    annulerNotificationPause();
}

function startGlobalTimer() {
    if (globalTimerData.isRunning) return;
    if (activeTimer.index === null || activeTimer.isPaused) return;
    if (breakTimerData.interval !== null) return;
    if (globalTimerData.remaining <= 0) {
        globalTimerData.remaining = getPomodoroWorkSec();
    }
    globalTimerData.isRunning = true;
    globalTimerData.endTime = Date.now() + (globalTimerData.remaining * 1000);
    if (globalTimerData.interval) clearInterval(globalTimerData.interval);
    globalTimerData.interval = setInterval(checkGlobalTimer, 1000);
}

function checkGlobalTimer() {
    if (!seanceEnCours || seanceEnCours.statut !== 'en_cours') {
        reinitialiserPomodoro();
        return;
    }
    let left = Math.ceil((globalTimerData.endTime - Date.now()) / 1000);
    if (left <= 0) {
        clearInterval(globalTimerData.interval);
        globalTimerData.interval = null;
        globalTimerData.isRunning = false;
        globalTimerData.isBreakPending = true;
        showBreakButton();
    } else { globalTimerData.remaining = left; }
}

function pauseGlobalTimer() {
    if (globalTimerData.isRunning) {
        clearInterval(globalTimerData.interval);
        globalTimerData.interval = null;
        globalTimerData.isRunning = false;
        if (globalTimerData.endTime) {
            globalTimerData.remaining = Math.max(0, Math.ceil((globalTimerData.endTime - Date.now()) / 1000));
        }
    }
}

function showBreakButton() {
    if (!seanceEnCours || seanceEnCours.statut !== 'en_cours') return;
    const vuePratique = document.getElementById('vue-pratique');
    if (!vuePratique || !vuePratique.classList.contains('vue-active')) return;
    const btn = document.getElementById('btn-pause-cafe'); const txt = document.getElementById('texte-pause-cafe');
    if (!btn) return;
    btn.style.setProperty('display', 'inline-flex', 'important');
    btn.classList.remove('hidden', 'btn-fade-out');
    btn.className = 'btn-action btn-ghost-blue btn-square'; btn.title = t('practice.break_prompt');
    if (txt) txt.style.display = 'none';
    jouerSonApparitionPause();
}

function demarrerPauseCafe() {
    const btn = document.getElementById('btn-pause-cafe'); const txt = document.getElementById('texte-pause-cafe');
    resetDerniereInteraction();
    if (breakTimerData.interval !== null) {
        terminerPauseCafe(true); return;
    }
    if (activeTimer.index !== null && !activeTimer.isPaused) {
        togglePause();
    } else if (seanceEnCours && !seanceEnCours.pause_active_debut) {
        seanceEnCours.pause_active_debut = Date.now();
        sauvegarderEtatSeance();
    }
    if (btn) {
        btn.style.setProperty('display', 'inline-flex', 'important');
        btn.classList.remove('hidden');
        btn.className = 'btn-action btn-ghost-yellow';
        btn.title = t('practice.cancel_break');
    }
    if (txt) txt.style.display = 'inline-block';
    breakTimerData.endTime = Date.now() + (getPomodoroBreakSec() * 1000);
    programmerNotificationPause(new Date(breakTimerData.endTime));
    if (breakTimerData.interval) clearInterval(breakTimerData.interval);
    breakTimerData.interval = setInterval(updateBreakTimer, 1000); updateBreakTimer();
}

function updateBreakTimer() {
    if (!breakTimerData.interval) return;
    let left = Math.ceil((breakTimerData.endTime - Date.now()) / 1000);
    if (left <= 0) { terminerPauseCafe(false); return; }
    const txt = document.getElementById('texte-pause-cafe'); if (txt) txt.textContent = formaterTemps(left);
}

function terminerPauseCafe(estAnnulee = false) {
    if (!estAnnulee) jouerSonFinPause();
    annulerNotificationPause();
    if (breakTimerData.interval) {
        clearInterval(breakTimerData.interval);
        breakTimerData.interval = null;
    }
    breakTimerData.endTime = null;
    globalTimerData.isBreakPending = false;
    globalTimerData.remaining = getPomodoroWorkSec();
    globalTimerData.isRunning = false;
    globalTimerData.endTime = null;

    const btn = document.getElementById('btn-pause-cafe');
    const txt = document.getElementById('texte-pause-cafe');
    if (txt) {
        txt.style.display = 'none';
        txt.textContent = '';
    }
    if (btn) {
        btn.classList.add('btn-fade-out');
        setTimeout(() => {
            btn.style.setProperty('display', 'none', 'important');
            btn.classList.add('hidden');
            btn.classList.remove('btn-fade-out');
            btn.className = 'btn-action btn-ghost-blue btn-square hidden';
        }, 300);
    }
    if (seanceEnCours && seanceEnCours.pause_active_debut && activeTimer.index === null) {
        seanceEnCours.temps_pause_cumule_ms = (seanceEnCours.temps_pause_cumule_ms || 0) + (Date.now() - seanceEnCours.pause_active_debut);
        seanceEnCours.pause_active_debut = null;
        sauvegarderEtatSeance();
    }
}

function togglePause() {
    if (activeTimer.index === null) return;
    resetDerniereInteraction();
    const btnPause = document.getElementById('btn-pause-global');
    const now = Date.now();
    if (activeTimer.isPaused) {
        activeTimer.isPaused = false; btnPause.innerHTML = svgPauseSquare; btnPause.className = 'btn-action btn-ghost-blue btn-square';
        if (!activeTimer.isOvertime) activeTimer.endTime = now + (activeTimer.remainingSecsAtPause * 1000);
        else activeTimer.overtimeStartTime = now - (activeTimer.remainingSecsAtPause * 1000);

        if (seanceEnCours && seanceEnCours.pause_active_debut) {
            seanceEnCours.temps_pause_cumule_ms = (seanceEnCours.temps_pause_cumule_ms || 0) + (now - seanceEnCours.pause_active_debut);
            seanceEnCours.pause_active_debut = null;
            sauvegarderEtatSeance();
        }
        demarrerBoucleChrono();
        activerWakeLock();
        if (!activeTimer.isOvertime && activeTimer.endTime) {
            const currentExo = seanceEnCours && seanceEnCours.items ? seanceEnCours.items[activeTimer.index] : null;
            const nom = currentExo ? (currentExo.categorie + (currentExo.contenu ? ` - ${currentExo.contenu}` : '')) : t('practice.exercise_fallback');
            programmerNotificationTimer(t('practice.timer_done_title'), t('practice.timer_done_body', { name: nom }), new Date(activeTimer.endTime));
        }
    } else {
        activeTimer.isPaused = true; clearInterval(activeTimer.interval);
        btnPause.innerHTML = svgPlaySquare; btnPause.className = 'btn-action btn-ghost-yellow btn-square';

        if (seanceEnCours && !seanceEnCours.pause_active_debut) {
            seanceEnCours.pause_active_debut = now;
            sauvegarderEtatSeance();
        }
        majAffichageChrono(activeTimer.index, activeTimer.remainingSecsAtPause); pauseGlobalTimer();
        desactiverWakeLock();
        annulerNotificationTimer();
    }
}

function demarrerBoucleChrono() {
    if (activeTimer.interval) clearInterval(activeTimer.interval);
    try { if (!globalTimerData.isRunning && !globalTimerData.isBreakPending && !breakTimerData.interval) startGlobalTimer(); } catch (e) { }

    let tickCounter = 0;
    const tick = () => {
        if (activeTimer.index === null || activeTimer.isPaused) return;
        const now = Date.now(); let displaySecs = 0;
        if (!activeTimer.isOvertime) {
            displaySecs = Math.ceil((activeTimer.endTime - now) / 1000);
            if (displaySecs <= 0) {
                activeTimer.isOvertime = true; activeTimer.overtimeStartTime = activeTimer.endTime || now;
                displaySecs = Math.floor((now - activeTimer.overtimeStartTime) / 1000);
                annulerNotificationTimer();
                jouerSonFinChrono();
            }
        } else {
            displaySecs = Math.floor((now - activeTimer.overtimeStartTime) / 1000);
        }
        activeTimer.remainingSecsAtPause = displaySecs;
        majAffichageChrono(activeTimer.index, displaySecs);
        majAffichageDureeLive();
        verifierAFK();

        tickCounter++;
        if (tickCounter % 5 === 0) {
            sauvegarderEtatSeance();
        }
    };
    tick(); activeTimer.interval = setInterval(tick, 1000);
}

function activerChronoItem(index, remainingSecs, item, btnPause, cardElement) {
    // 1. Nettoyer les classes 'active' de toutes les autres cartes
    document.querySelectorAll('#conteneur-items .item-card').forEach(c => c.classList.remove('active'));

    // 2. Mettre la carte cliquée en surbrillance
    if (cardElement) cardElement.classList.add('active');

    // 3. Réinitialiser et configurer le timer actif
    if (activeTimer.interval) clearInterval(activeTimer.interval);

    activeTimer.index = index;
    const estEnOvertime = (item && item.isOvertime) ? true : (remainingSecs < 0);
    const secsAbs = Math.abs(remainingSecs);
    activeTimer.isOvertime = estEnOvertime;
    activeTimer.remainingSecsAtPause = secsAbs;
    activeTimer.isPaused = false;

    const now = Date.now();
    if (activeTimer.isOvertime) {
        activeTimer.endTime = null;
        // Si on est en dépassement, on calcule le début du dépassement dans le passé
        activeTimer.overtimeStartTime = now - (secsAbs * 1000);
    } else {
        activeTimer.endTime = now + (secsAbs * 1000);
        activeTimer.overtimeStartTime = null;
    }

    // 4. Activer le bouton pause global en haut de la page
    if (btnPause) {
        btnPause.disabled = false;
        btnPause.innerHTML = svgPauseSquare;
        btnPause.className = 'btn-action btn-ghost-blue btn-square';
    }

    // 5. Lancer la boucle
    demarrerBoucleChrono();

    // 6. Anti-veille et programmation de la notification locale
    activerWakeLock();
    if (!activeTimer.isOvertime && activeTimer.endTime) {
        const nom = item ? (item.categorie + (item.contenu ? ` - ${item.contenu}` : '')) : t('practice.exercise_fallback');
        programmerNotificationTimer(t('practice.timer_done_title'), t('practice.timer_done_body', { name: nom }), new Date(activeTimer.endTime));
    } else {
        annulerNotificationTimer();
    }
}

// ==========================================
// --- FIN DE SÉANCE                      ---
// ==========================================

function verifierFinSeance() {
    if (!seanceEnCours || !seanceEnCours.items) return;
    const btn = document.getElementById('btn-terminer'); if (btn.classList.contains('done')) return;
    const toutFini = seanceEnCours.items.every(item => item.fait);
    if (toutFini && seanceEnCours.items.length > 0) { btn.classList.add('btn-glow-success'); btn.classList.replace('btn-ghost-neutral', 'btn-ghost-green'); }
    else { btn.classList.remove('btn-glow-success'); btn.classList.replace('btn-ghost-green', 'btn-ghost-neutral'); }
}

function demanderFinSeance() {
    if (activeTimer.interval) {
        clearInterval(activeTimer.interval); activeTimer.isPaused = true;
        const btnPause = document.getElementById('btn-pause-global');
        if (btnPause) { btnPause.innerHTML = svgPlaySquare; btnPause.className = 'btn-action btn-ghost-yellow btn-square'; }
        majAffichageChrono(activeTimer.index, activeTimer.remainingSecsAtPause); pauseGlobalTimer();
    }
    stopMetronome();
    document.getElementById('btn-terminer').style.display = 'none'; document.getElementById('fin-seance-actions').style.display = 'flex';
}

async function sauvegarderStats() {
    if (!seanceEnCours) return;
    try {
        if (activeTimer.index !== null && seanceEnCours.items && seanceEnCours.items[activeTimer.index]) {
            const currentExo = seanceEnCours.items[activeTimer.index];
            currentExo.fait = true;
            currentExo.isOvertime = activeTimer.isOvertime;
            currentExo.temps_restant = activeTimer.remainingSecsAtPause;
            const prevuSecs = Number(currentExo.temps_prevu || 0) * 60;
            currentExo.duree_reelle_secondes = activeTimer.isOvertime
                ? (prevuSecs + activeTimer.remainingSecsAtPause)
                : Math.max(0, prevuSecs - activeTimer.remainingSecsAtPause);
        }

        let dureeTotaleSecondes = calculerDureeReelleSeance();
        if (dureeTotaleSecondes <= 0 && seanceEnCours.items) {
            seanceEnCours.items.forEach(item => {
                if (item.fait) {
                    const prevuSecs = Number(item.temps_prevu || 0) * 60;
                    const restantSecs = Number(item.temps_restant || 0);
                    const reelSecs = item.isOvertime ? prevuSecs + restantSecs : prevuSecs - restantSecs;
                    dureeTotaleSecondes += Math.max(0, reelSecs);
                }
            });
        }

        const payload = JSON.stringify({
            duree: Math.round(dureeTotaleSecondes),
            date_seance: seanceEnCours.date_seance,
            items: seanceEnCours.items
        });
        const btnRetour = document.getElementById('btn-nav-retour');
        if (btnRetour) {
            btnRetour.style.setProperty('display', 'none', 'important');
            btnRetour.classList.add('hidden');
        }
        const btnCafe = document.getElementById('btn-pause-cafe');
        if (btnCafe) {
            btnCafe.style.setProperty('display', 'none', 'important');
            btnCafe.classList.add('hidden');
        }
        await apiFetch(`/seances/${seanceEnCours.id}/terminer`, { method: 'POST', body: payload });
        nettoyerStockageSeance(seanceEnCours.id);
        terminerEtReinitialiser('sauvegardee');
    } catch (e) {
        nettoyerStockageSeance(seanceEnCours.id);
        terminerEtReinitialiser('sauvegardee');
    }
}

async function ignorerStats() {
    if (seanceEnCours) {
        nettoyerStockageSeance(seanceEnCours.id);
        try { await apiFetch(`/seances/${seanceEnCours.id}`, { method: 'DELETE' }); } catch (e) { }
    }
    const btnRetour = document.getElementById('btn-nav-retour');
    if (btnRetour) {
        btnRetour.style.setProperty('display', 'none', 'important');
        btnRetour.classList.add('hidden');
    }
    const btnCafe = document.getElementById('btn-pause-cafe');
    if (btnCafe) {
        btnCafe.style.setProperty('display', 'none', 'important');
        btnCafe.classList.add('hidden');
    }
    terminerEtReinitialiser('ignoree');
}

function terminerEtReinitialiser(statut) {
    annulerNotificationTimer();
    annulerNotificationPause();
    desactiverWakeLock();
    reinitialiserPomodoro();
    if (activeTimer.interval) { clearInterval(activeTimer.interval); activeTimer.interval = null; }
    activeTimer.index = null; activeTimer.isPaused = true;
    const btnCafe = document.getElementById('btn-pause-cafe');
    if (btnCafe) {
        btnCafe.style.setProperty('display', 'none', 'important');
        btnCafe.classList.add('hidden');
    }
    const btnRetour = document.getElementById('btn-nav-retour');
    if (btnRetour) {
        btnRetour.style.setProperty('display', 'none', 'important');
        btnRetour.classList.add('hidden');
    }
    document.getElementById('fin-seance-actions').style.display = 'none';
    const btn = document.getElementById('btn-terminer');
    if (btn) {
        btn.style.display = 'inline-flex';
        btn.className = "btn-action done";
        btn.onclick = null;
        btn.innerHTML = statut === 'sauvegardee' ? `${svgSaveCheck} ${t('practice.session_finished_saved')}` : `${svgTick} ${t('practice.session_finished')}`;
    }
    const oldId = seanceEnCours ? seanceEnCours.id : null;
    seanceEnCours = null;
    const conteneurItems = document.getElementById('conteneur-items');
    if (conteneurItems) conteneurItems.dataset.seanceId = '';
    if (oldId) nettoyerStockageSeance(oldId);
    licksPratiquesSession.clear();

    setTimeout(() => { afficherVue('historique'); }, 1500);
}

function selectChip(groupType, value, forceSelect = false) {
    const group = document.getElementById(`chips-${groupType}`);
    if (!group) return;
    const chips = group.querySelectorAll('.chip');
    if (groupType === 'sous-categorie') {
        const clickedChip = Array.from(chips).find(c => (c.getAttribute('data-value') || c.innerText.trim()) === value || c.innerText.trim() === value || (c.getAttribute('onclick') && c.getAttribute('onclick').includes(`'${value}'`)));
        if (clickedChip) {
            if (clickedChip.classList.contains('active') && !forceSelect) { clickedChip.classList.remove('active', 'btn-ghost-blue'); clickedChip.classList.add('btn-ghost-neutral'); }
            else { clickedChip.classList.add('active', 'btn-ghost-blue'); clickedChip.classList.remove('btn-ghost-neutral'); }
        }
    } else if (groupType === 'note' || groupType === 'mode') {
        const hiddenInput = document.getElementById(`input-ton-${groupType}`);
        const clickedChip = Array.from(chips).find(c => (c.getAttribute('data-value') || c.innerText.trim()) === value || c.innerText.trim() === value || (c.getAttribute('onclick') && c.getAttribute('onclick').includes(`'${value}'`)));
        const wasActive = clickedChip && clickedChip.classList.contains('active');

        chips.forEach(c => { c.classList.remove('active', 'btn-ghost-blue'); c.classList.add('btn-ghost-neutral'); });

        if (wasActive && !forceSelect) {
            if (hiddenInput) hiddenInput.value = "";
        } else {
            if (clickedChip) { clickedChip.classList.add('active', 'btn-ghost-blue'); clickedChip.classList.remove('btn-ghost-neutral'); }
            if (hiddenInput) hiddenInput.value = value;
            if (groupType === 'note') {
                const modeInput = document.getElementById('input-ton-mode');
                if (modeInput && !modeInput.value) {
                    selectChip('mode', 'majeur', true);
                }
            }
        }
    } else {
        chips.forEach(c => { c.classList.remove('active', 'btn-ghost-blue'); c.classList.add('btn-ghost-neutral'); });
        const activeChip = Array.from(chips).find(c => (c.getAttribute('data-value') || c.innerText.trim()) === value || c.innerText.trim() === value || (c.getAttribute('onclick') && c.getAttribute('onclick').includes(`'${value}'`)));
        if (activeChip) { activeChip.classList.add('active', 'btn-ghost-blue'); activeChip.classList.remove('btn-ghost-neutral'); }
        const hiddenInput = document.getElementById(`input-${groupType}`);
        if (hiddenInput) hiddenInput.value = value;
        if (groupType === 'categorie') renderSousCategoriesChips(value);
    }
}

function toggleChampPrecis() {
    const champ = document.getElementById('container-preciser');
    champ.style.display = champ.style.display === 'none' ? 'block' : 'none';
    if (champ.style.display === 'block') document.getElementById('input-contenu').focus();
}

function fixerTempsExercice(val) {
    let v = Math.max(1, Math.min(180, Math.round(Number(val) || 25)));
    const input = document.getElementById('input-temps');
    if (input) input.value = v;
    const display = document.getElementById('display-temps-val');
    if (display) display.textContent = v;
}

function changerTemps(delta) {
    let input = document.getElementById('input-temps');
    let val = parseInt(input ? input.value : 25);
    if (isNaN(val)) val = 25;
    if (Math.abs(delta) === 5) {
        val = delta > 0 ? Math.ceil((val + 0.1) / 5) * 5 : Math.floor((val - 0.1) / 5) * 5;
    } else {
        val += delta;
    }
    fixerTempsExercice(val);
}

let exoTimeDragState = { active: false, startY: 0, startVal: 25 };

function attacherControlesTempsExerciceInteractifs() {
    const zone = document.getElementById('exo-time-swipe-zone');
    if (!zone || zone.dataset.interactiveAttached === 'true') return;
    zone.dataset.interactiveAttached = 'true';

    zone.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1 : -1;
        const input = document.getElementById('input-temps');
        const cur = parseInt(input ? input.value : 25) || 25;
        fixerTempsExercice(cur + delta);
    }, { passive: false });

    const onStart = (clientY) => {
        exoTimeDragState.active = true;
        exoTimeDragState.startY = clientY;
        const input = document.getElementById('input-temps');
        exoTimeDragState.startVal = parseInt(input ? input.value : 25) || 25;
        zone.classList.add('dragging');
    };

    const onMove = (clientY) => {
        if (!exoTimeDragState.active) return;
        const diffY = exoTimeDragState.startY - clientY;
        const deltaMins = Math.round(diffY / 8);
        fixerTempsExercice(exoTimeDragState.startVal + deltaMins);
    };

    const onEnd = () => {
        if (!exoTimeDragState.active) return;
        exoTimeDragState.active = false;
        zone.classList.remove('dragging');
    };

    zone.addEventListener('mousedown', (e) => { e.preventDefault(); onStart(e.clientY); });
    window.addEventListener('mousemove', (e) => { if (exoTimeDragState.active) onMove(e.clientY); });
    window.addEventListener('mouseup', onEnd);

    zone.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            e.preventDefault();
            onStart(e.touches[0].clientY);
        }
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
        if (exoTimeDragState.active && e.touches.length === 1) {
            e.preventDefault();
            onMove(e.touches[0].clientY);
        }
    }, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        attacherControlesTempsExerciceInteractifs();
    });
}

window.genererTonaliteAleatoire = function () {
    const notes = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
    const modes = ["majeur", "mineur"];
    const chosenNote = notes[Math.floor(Math.random() * notes.length)];
    const chosenMode = modes[Math.floor(Math.random() * modes.length)];
    selectChip('note', chosenNote, true);
    selectChip('mode', chosenMode, true);
}

function ajouterItemBrouillon() {
    let cat = document.getElementById('input-categorie').value;
    if (!cat) {
        if (typeof afficherNotification === 'function') afficherNotification(t('creation.choose_category_alert'));
        else alert(t('creation.choose_category_alert'));
        return;
    }
    let sousCatChips = document.querySelectorAll('#chips-sous-categorie .chip.active');
    let sousCatArray = Array.from(sousCatChips).map(c => c.getAttribute('data-value') || c.innerText.trim());
    let tempsVal = parseInt(document.getElementById('input-temps').value); if (isNaN(tempsVal) || tempsVal < 1) tempsVal = 25;
    let contenuPrecis = document.getElementById('input-contenu').value.trim();
    let contenuFinal = sousCatArray.join(', ');
    if (contenuPrecis) contenuFinal = contenuFinal ? `${contenuFinal} - ${contenuPrecis}` : contenuPrecis;

    const item = { categorie: cat, sous_categories: sousCatArray, contenu: contenuFinal, temps_prevu: tempsVal, tempo: null, fait: false, ordre: itemsBrouillon.length };

    if (editDraftIndex !== null) {
        itemsBrouillon[editDraftIndex] = item; editDraftIndex = null;
        const btn = document.getElementById('btn-add-draft');
        btn.innerHTML = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; margin-right: 8px;"><path d="M5 12h14"/><path d="M12 5v14"/></svg> ${t('creation.add_to_session')}`;
        btn.className = 'btn-action btn-ghost-green';
    } else { itemsBrouillon.push(item); }

    afficherBrouillon(); document.getElementById('input-contenu').value = ""; document.getElementById('container-preciser').style.display = 'none';
}

function editerBrouillon(index) {
    editDraftIndex = index; const item = itemsBrouillon[index]; selectChip('categorie', item.categorie);
    const chipGroup = document.getElementById('chips-sous-categorie'); const chips = chipGroup.querySelectorAll('.chip');
    chips.forEach(c => { c.classList.remove('active', 'btn-ghost-blue'); c.classList.add('btn-ghost-neutral'); });
    if (item.sous_categories && item.sous_categories.length > 0) {
        item.sous_categories.forEach(sc => {
            const targetChip = Array.from(chips).find(c => (c.getAttribute('data-value') || c.innerText.trim()) === sc || c.innerText.trim() === sc);
            if (targetChip) { targetChip.classList.add('active', 'btn-ghost-blue'); targetChip.classList.remove('btn-ghost-neutral'); }
        });
    }
    fixerTempsExercice(item.temps_prevu);
    let sousCatString = item.sous_categories ? item.sous_categories.join(', ') : "";
    let contenuBase = item.contenu || "";

    if (sousCatString && contenuBase.startsWith(sousCatString + " - ")) {
        contenuBase = contenuBase.replace(sousCatString + " - ", "");
        document.getElementById('input-contenu').value = contenuBase; document.getElementById('container-preciser').style.display = 'block';
    } else if (contenuBase !== sousCatString && contenuBase !== "") {
        document.getElementById('input-contenu').value = contenuBase; document.getElementById('container-preciser').style.display = 'block';
    } else { document.getElementById('input-contenu').value = ""; document.getElementById('container-preciser').style.display = 'none'; }

    const btn = document.getElementById('btn-add-draft');
    btn.innerHTML = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; margin-right: 8px;"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg> ${t('creation.update_exercise')}`;
    btn.className = 'btn-action btn-ghost-green'; document.getElementById('vue-creation').scrollIntoView({ behavior: 'smooth' });
}

function afficherBrouillon() {
    const liste = document.getElementById('liste-brouillon'); liste.innerHTML = "";
    let totalMins = itemsBrouillon.reduce((sum, item) => sum + Number(item.temps_prevu), 0);
    const badgeTime = document.getElementById('total-time-badge');
    if (badgeTime) badgeTime.textContent = Math.floor(totalMins / 60) + "h" + (totalMins % 60).toString().padStart(2, '0');
    const btnSaveRoutine = document.getElementById('btn-save-routine');
    if (btnSaveRoutine) btnSaveRoutine.disabled = itemsBrouillon.length === 0;

    itemsBrouillon.forEach((item, index) => {
        const scArray = Array.isArray(item.sous_categories) ? item.sous_categories : (item.sous_categorie ? [item.sous_categorie] : []);
        let badgesHtml = scArray.map(sc => {
            const labelSc = (typeof estLabelFavoris === 'function' && estLabelFavoris(sc)) ? t('common.favorites') : sc;
            return `<span class="badge badge-neutral" style="font-size: 11px; padding: 2px 8px;">${labelSc}</span>`;
        }).join(' ');
        let texteAffiche = item.contenu || ""; let scString = scArray.join(', ');
        if (texteAffiche === scString) texteAffiche = ""; else if (scString && texteAffiche.startsWith(scString + " - ")) texteAffiche = texteAffiche.replace(scString + " - ", "");
        let contenuHtml = texteAffiche ? `<div style="font-size:13px; color:var(--text-muted); margin-top: 4px;">${texteAffiche}</div>` : "";

        liste.innerHTML += `
            <div class="item-draft">
                <div style="display: flex; align-items: center; flex-grow: 1;">
                    <span class="drag-handle" title="${t('common.reorder')}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2; stroke-linecap: round; stroke-linejoin: round;"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg></span>
                    <div>
                        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            <span style="font-weight:600; color:var(--text-primary); font-size:15px;">${item.categorie}</span> 
                            <span style="color:var(--text-muted); font-size:13px; font-weight:500;">(${item.temps_prevu} min)</span>${badgesHtml}
                        </div>${contenuHtml}
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-action btn-ghost-neutral btn-square" onclick="editerBrouillon(${index})" title="${t('common.edit')}">${svgPencil}</button>
                    <button class="btn-action btn-ghost-red btn-square" onclick="supprimerBrouillon(${index})" title="${t('common.delete')}">${svgTrash}</button>
                </div>
            </div>`;
    });
}

function supprimerBrouillon(index) {
    if (editDraftIndex === index) {
        editDraftIndex = null; const btn = document.getElementById('btn-add-draft');
        btn.innerHTML = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; margin-right: 8px;"><path d="M5 12h14"/><path d="M12 5v14"/></svg> ${t('creation.add_to_session')}`;
        btn.className = 'btn-action btn-ghost-green';
    }
    itemsBrouillon.splice(index, 1); afficherBrouillon();
}

async function sauvegarderSeance() {
    if (itemsBrouillon.length === 0) return;
    if (seanceEnCours) { try { await apiFetch(`/seances/${seanceEnCours.id}`, { method: 'DELETE' }); } catch (e) { } }
    const note = (document.getElementById('input-ton-note')?.value || "").trim();
    const mode = (document.getElementById('input-ton-mode')?.value || "").trim();
    const tonalite_du_jour = (note && mode) ? (note + " " + mode) : (note || null);
    const dateStr = new Date().toISOString().split('T')[0];
    const nouvelleSeance = { date_seance: dateStr, tonalite_du_jour: tonalite_du_jour, items: itemsBrouillon };
    try {
        const cree = await apiFetch(`/seances`, { method: 'POST', body: JSON.stringify(nouvelleSeance) });
        seanceEnCours = cree;
        reinitialiserPomodoro();
        afficherSeancePratique(true);
        afficherVue('pratique');
    } catch (e) {
        console.error("Erreur sauvegarde séance :", e);
    }
}

function initDragAndDrop() {
    sortableBrouillon = new Sortable(document.getElementById('liste-brouillon'), {
        handle: '.drag-handle', animation: 150, ghostClass: 'sortable-ghost', dragClass: 'sortable-drag',
        onEnd: function (evt) {
            if (evt.oldIndex === evt.newIndex) return;
            itemsBrouillon.splice(evt.newIndex, 0, itemsBrouillon.splice(evt.oldIndex, 1)[0]);
            itemsBrouillon.forEach((item, idx) => item.ordre = idx); afficherBrouillon();
        }
    });

    sortablePratique = new Sortable(document.getElementById('conteneur-items'), {
        handle: '.drag-handle', animation: 150, ghostClass: 'sortable-ghost', dragClass: 'sortable-drag',
        onEnd: async function (evt) {
            if (evt.oldIndex === evt.newIndex) return;
            seanceEnCours.items.splice(evt.newIndex, 0, seanceEnCours.items.splice(evt.oldIndex, 1)[0]);
            seanceEnCours.items.forEach((item, idx) => item.ordre = idx);
            if (activeTimer.index === evt.oldIndex) activeTimer.index = evt.newIndex;
            else if (activeTimer.index !== null) {
                if (evt.oldIndex < activeTimer.index && evt.newIndex >= activeTimer.index) activeTimer.index--;
                else if (evt.oldIndex > activeTimer.index && evt.newIndex <= activeTimer.index) activeTimer.index++;
            }
            Array.from(document.getElementById('conteneur-items').children).forEach((card, idx) => {
                card.id = `card-${idx}`; card.onclick = () => gererClicCarte(idx);
                const timerDisplay = card.querySelector('.badge-temps'); if (timerDisplay) timerDisplay.id = `timer-display-${idx}`;
            });
            try { await apiFetch(`/seances/${seanceEnCours.id}`, { method: 'PUT', body: JSON.stringify(seanceEnCours) }); } catch (e) { }
            verifierFinSeance();
        }
    });
}

// ==========================================
// --- HISTORIQUE, STATS & GRAPHIQUES     ---
// ==========================================
let historiquesTerminees = []; let graphTypeActuel = ''; let graphPeriodeActuelle = 'semaine'; let monGraphique = null; let limiteHistorique = 10;
function getMonday(d) {
    if (typeof window !== 'undefined' && window.HistoryAnalytics && typeof window.HistoryAnalytics.getMonday === 'function') {
        return window.HistoryAnalytics.getMonday(d);
    }
    d = new Date(d); let day = d.getDay(), diff = d.getDate() - day + (day == 0 ? -6 : 1); return new Date(d.setDate(diff));
}
function getTonaliteMajeureRelative(tona) {
    if (typeof window !== 'undefined' && window.HistoryAnalytics && typeof window.HistoryAnalytics.getRelativeMajorKey === 'function') {
        return window.HistoryAnalytics.getRelativeMajorKey(tona) || tona;
    }
    if (!tona) return tona;
    const norm = tona.replace(/\bminor\b/gi, 'mineur').replace(/\bmajor\b/gi, 'majeur');
    if (!norm.includes('mineur')) return norm;
    const mapping = { "C mineur": "Eb majeur", "Db mineur": "E majeur", "D mineur": "F majeur", "Eb mineur": "Gb majeur", "E mineur": "G majeur", "F mineur": "Ab majeur", "Gb mineur": "A majeur", "G mineur": "Bb majeur", "Ab mineur": "B majeur", "A mineur": "C majeur", "Bb mineur": "Db majeur", "B mineur": "D majeur" };
    return mapping[norm] || norm;
}

async function chargerHistorique() {
    try {
        let seances = await apiFetch(`/seances`); if (!Array.isArray(seances)) seances = [];
        historiquesTerminees = seances.filter(s => s.statut === 'terminee'); safeSortSeances(historiquesTerminees);
        const listeHist = document.getElementById('liste-historique-seances'); listeHist.innerHTML = "";
        if (historiquesTerminees.length === 0) {
            listeHist.innerHTML = `
                <div style="text-align: center; padding: 32px 20px; color: var(--text-muted);">
                    <p style="margin: 0 0 16px 0; font-size: 14px;">${t('history.empty')}</p>
                    <button class="btn-action btn-ghost-neutral" onclick="injecterSeancesDemo()" style="margin: 0 auto; display: inline-flex; align-items: center; gap: 8px; font-size: 13px;">
                        <svg viewBox="0 0 24 24" style="width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                        Charger des séances d'exemple
                    </button>
                </div>`;
            document.getElementById('stat-temps-7j').textContent = "-- min";
            updateCardObjectifUI(null);
            document.getElementById('stat-streak').querySelector('span').textContent = "--";
            document.getElementById('stat-tonalite-reine').querySelector('span').textContent = "--";
            return;
        }

        historiquesTerminees.forEach(s => {
            if (typeof window !== 'undefined' && window.HistoryAnalytics && typeof window.HistoryAnalytics.calculateSessionDurationMinutes === 'function') {
                s.tempsTotalCalc = window.HistoryAnalytics.calculateSessionDurationMinutes(s);
            } else if (typeof window !== 'undefined' && window.SessionTimer && typeof window.SessionTimer.calculateSessionRealDuration === 'function') {
                s.tempsTotalCalc = Math.round(window.SessionTimer.calculateSessionRealDuration(s) / 60);
            } else if (s.duree_reelle !== undefined && s.duree_reelle !== null && Number(s.duree_reelle) > 0) {
                s.tempsTotalCalc = Math.round(Number(s.duree_reelle) / 60);
            } else if (s.items && Array.isArray(s.items)) {
                let itemsMins = 0;
                s.items.forEach(item => {
                    if (item.fait) {
                        const prevu = Number(item.temps_prevu || 0);
                        const restant = Number(item.temps_restant || 0);
                        const reelSecs = item.isOvertime ? (prevu * 60 + restant) : Math.max(0, prevu * 60 - restant);
                        itemsMins += Math.round(reelSecs / 60) || prevu;
                    }
                });
                s.tempsTotalCalc = itemsMins;
            } else {
                s.tempsTotalCalc = 0;
            }
        });

        renderHistoriqueListe();

        const rawGoal = localStorage.getItem('piano_workout_weekly_goal_hours');
        const weeklyGoalHours = rawGoal ? parseInt(rawGoal, 10) : 0;

        if (typeof window !== 'undefined' && window.HistoryAnalytics && typeof window.HistoryAnalytics.calculateHistorySummary === 'function') {
            const summary = window.HistoryAnalytics.calculateHistorySummary(historiquesTerminees, { weeklyGoalHours });
            document.getElementById('stat-temps-7j').textContent = summary.weeklyDurationFormatted;
            updateCardObjectifUI(summary.weeklyGoal);
            document.getElementById('stat-streak').querySelector('span').textContent = `${summary.streakDays} ${t('history.days_unit')}`;
            document.getElementById('stat-tonalite-reine').querySelector('span').textContent = formatTonalite(summary.reineTonalite || "--");
        } else {
            let tempsTotalSemaineMins = 0; let tonsCount = {}; let itemsFaits = 0; let itemsTotal = 0;
            const lundiCetteSemaine = getMonday(new Date()); lundiCetteSemaine.setHours(0, 0, 0, 0);
            let datesSet = new Set(historiquesTerminees.map(s => s.date_seance ? s.date_seance.split('T')[0] : null));
            let streak = 0; let d = new Date(); let dateStr = d.toISOString().split('T')[0];
            if (!datesSet.has(dateStr)) { d.setDate(d.getDate() - 1); dateStr = d.toISOString().split('T')[0]; }
            while (datesSet.has(dateStr)) { streak++; d.setDate(d.getDate() - 1); dateStr = d.toISOString().split('T')[0]; }

            historiquesTerminees.forEach(s => {
                if (s.tonalite_du_jour) { const tRelative = getTonaliteMajeureRelative(s.tonalite_du_jour); tonsCount[tRelative] = (tonsCount[tRelative] || 0) + 1; }
                const tempsSeanceMins = s.tempsTotalCalc || 0;
                if (s.date_seance) { const dateSeance = new Date(s.date_seance); if (dateSeance >= lundiCetteSemaine) tempsTotalSemaineMins += tempsSeanceMins; }
                if (s.items && Array.isArray(s.items)) { s.items.forEach(item => { itemsTotal++; if (item.fait) itemsFaits++; }); }
            });

            document.getElementById('stat-temps-7j').textContent = formatDureeHistorique(tempsTotalSemaineMins);
            if (weeklyGoalHours > 0) {
                const pct = Math.round((tempsTotalSemaineMins / (weeklyGoalHours * 60)) * 100);
                updateCardObjectifUI({ hasGoal: true, formattedPercentage: `${pct} %`, isCompleted: pct >= 100, progressRatio: pct / 100 });
            } else {
                updateCardObjectifUI(null);
            }
            document.getElementById('stat-streak').querySelector('span').textContent = `${streak} ${t('history.days_unit')}`;

            let reine = "--"; let maxCount = 0;
            for (const [ton, count] of Object.entries(tonsCount)) { if (count > maxCount) { maxCount = count; reine = ton; } }
            document.getElementById('stat-tonalite-reine').querySelector('span').textContent = formatTonalite(reine);
        }
    } catch (err) { }
}

async function supprimerSeance(id) {
    if (!confirm(t('history.confirm_delete_session'))) return;
    try { await apiFetch(`/seances/${id}`, { method: 'DELETE' }); chargerHistorique(); } catch (e) { }
}
async function reinitialiserHistorique() {
    if (confirm(t('history.confirm_reset_all'))) { try { await apiFetch(`/seances/reset`, { method: 'DELETE' }); chargerHistorique(); } catch (e) { } }
}

async function injecterSeancesDemo() {
    const now = new Date();
    const demoSeances = [
        // Aujourd'hui (J0) : 45 min, C mineur (relative Eb majeur)
        {
            id: Date.now() - 1000,
            statut: 'terminee',
            date_seance: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
            duree_reelle: 2700,
            tonalite_du_jour: 'C mineur',
            items: [
                { fait: true, categorie: 'Morceaux', titre: 'Autumn Leaves', temps_prevu: 20, temps_restant: 0, isOvertime: false, duree_reelle_secondes: 1200 },
                { fait: true, categorie: 'Voicings', titre: 'II-V-I Voicings Bud Powell', temps_prevu: 15, temps_restant: 0, isOvertime: false, duree_reelle_secondes: 900 },
                { fait: true, categorie: 'Technique', titre: 'Gammes Bebop majeures', temps_prevu: 10, temps_restant: 0, isOvertime: false, duree_reelle_secondes: 600 }
            ]
        },
        // Hier (J-1) : 60 min, Eb majeur
        {
            id: Date.now() - 2000,
            statut: 'terminee',
            date_seance: new Date(now.getTime() - 24 * 3600 * 1000).toISOString(),
            duree_reelle: 3600,
            tonalite_du_jour: 'Eb majeur',
            items: [
                { fait: true, categorie: 'Morceaux', titre: "Take the 'A' Train", temps_prevu: 25, temps_restant: 0, isOvertime: false, duree_reelle_secondes: 1500 },
                { fait: true, categorie: 'Licks', titre: 'Charlie Parker Enclosures', temps_prevu: 15, temps_restant: 0, isOvertime: false, duree_reelle_secondes: 900 },
                { fait: true, categorie: 'Patterns', titre: 'Trane Digital Patterns 1-2-3-5', temps_prevu: 20, temps_restant: 0, isOvertime: false, duree_reelle_secondes: 1200 }
            ]
        },
        // J-2 : 50 min, A mineur (relative C majeur)
        {
            id: Date.now() - 3000,
            statut: 'terminee',
            date_seance: new Date(now.getTime() - 48 * 3600 * 1000).toISOString(),
            duree_reelle: 3000,
            tonalite_du_jour: 'A mineur',
            items: [
                { fait: true, categorie: 'Relevés', titre: 'Solo Bill Evans sur So What', temps_prevu: 25, temps_restant: 0, isOvertime: false, duree_reelle_secondes: 1500 },
                { fait: true, categorie: 'Morceaux', titre: 'Solar', temps_prevu: 15, temps_restant: 0, isOvertime: false, duree_reelle_secondes: 900 },
                { fait: true, categorie: 'Technique', titre: 'Arpèges brisés mains alternées', temps_prevu: 10, temps_restant: 0, isOvertime: false, duree_reelle_secondes: 600 }
            ]
        },
        // J-3 : 40 min, C majeur
        {
            id: Date.now() - 4000,
            statut: 'terminee',
            date_seance: new Date(now.getTime() - 72 * 3600 * 1000).toISOString(),
            duree_reelle: 2400,
            tonalite_du_jour: 'C majeur',
            items: [
                { fait: true, categorie: 'Voicings', titre: 'Drop 2 Quartaux', temps_prevu: 20, temps_restant: 0, isOvertime: false, duree_reelle_secondes: 1200 },
                { fait: true, categorie: 'Morceaux', titre: 'All The Things You Are', temps_prevu: 20, temps_restant: 0, isOvertime: false, duree_reelle_secondes: 1200 }
            ]
        },
        // J-4 : 60 min, Eb mineur (relative Gb majeur)
        {
            id: Date.now() - 5000,
            statut: 'terminee',
            date_seance: new Date(now.getTime() - 96 * 3600 * 1000).toISOString(),
            duree_reelle: 3600,
            tonalite_du_jour: 'Eb mineur',
            items: [
                { fait: true, categorie: 'Morceaux', titre: "'Round Midnight", temps_prevu: 30, temps_restant: 0, isOvertime: false, duree_reelle_secondes: 1800 },
                { fait: true, categorie: 'Licks', titre: 'Turnarounds coltraniens', temps_prevu: 15, temps_restant: 0, isOvertime: false, duree_reelle_secondes: 900 },
                { fait: true, categorie: 'Voicings', titre: 'So What Chords', temps_prevu: 15, temps_restant: 0, isOvertime: false, duree_reelle_secondes: 900 }
            ]
        },
        // J-10 (il y a 10 jours) : 70 min, G mineur (relative Bb majeur)
        {
            id: Date.now() - 6000,
            statut: 'terminee',
            date_seance: new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString(),
            duree_reelle: 4200,
            tonalite_du_jour: 'G mineur',
            items: [
                { fait: true, categorie: 'Morceaux', titre: 'Blue Bossa', temps_prevu: 30, temps_restant: 0, isOvertime: false, duree_reelle_secondes: 1800 },
                { fait: true, categorie: 'Patterns', titre: 'Pentatoniques modernes', temps_prevu: 20, temps_restant: 0, isOvertime: false, duree_reelle_secondes: 1200 },
                { fait: true, categorie: 'Technique', titre: 'Rythmique swing main gauche', temps_prevu: 20, temps_restant: 0, isOvertime: false, duree_reelle_secondes: 1200 }
            ]
        },
        // J-20 (il y a 20 jours) : 60 min, F majeur
        {
            id: Date.now() - 7000,
            statut: 'terminee',
            date_seance: new Date(now.getTime() - 20 * 24 * 3600 * 1000).toISOString(),
            duree_reelle: 3600,
            tonalite_du_jour: 'F majeur',
            items: [
                { fait: true, categorie: 'Morceaux', titre: "Now's The Time", temps_prevu: 30, temps_restant: 0, isOvertime: false, duree_reelle_secondes: 1800 },
                { fait: true, categorie: 'Relevés', titre: 'Thelonious Monk voicings', temps_prevu: 30, temps_restant: 0, isOvertime: false, duree_reelle_secondes: 1800 }
            ]
        }
    ];

    for (const s of demoSeances) {
        await ecrireLocal('seances', s);
    }
    await chargerHistorique();
}
window.injecterSeancesDemo = injecterSeancesDemo;

function fermerTousLesDropdowns() {
    document.querySelectorAll('.dropdown.show').forEach(d => d.classList.remove('show'));
}

function changerLimiteHistorique(val, label) {
    limiteHistorique = val;
    document.querySelectorAll('#dd-limite-historique .dropdown-content button').forEach(b => b.classList.remove('active'));
    const btnActive = document.getElementById(`limite-hist-${val}`);
    if (btnActive) btnActive.classList.add('active');
    fermerTousLesDropdowns();
    renderHistoriqueListe();
}

function renderHistoriqueListe() {
    const listeHist = document.getElementById('liste-historique-seances'); listeHist.innerHTML = "";
    let seancesAafficher = historiquesTerminees;
    if (limiteHistorique !== "toutes") seancesAafficher = historiquesTerminees.slice(0, parseInt(limiteHistorique));
    if (seancesAafficher.length === 0) { listeHist.innerHTML = `<div style="text-align: center; padding: 20px; color: var(--text-muted);">${t('history.empty')}</div>`; return; }

    const locale = typeof getLocaleCode === 'function' ? getLocaleCode() : 'fr-FR';
    seancesAafficher.forEach(s => {
        let itemsHtml = "";
        if (s.items && Array.isArray(s.items)) {
            s.items.forEach(item => { if (item.fait) itemsHtml += `<span class="badge badge-neutral" style="margin-right: 4px; margin-bottom: 4px; display: inline-block;">${item.categorie}</span>`; });
        }
        let dateFormatee = t('history.unknown_date');
        if (s.date_seance) {
            const [y, m, day] = s.date_seance.split('T')[0].split('-');
            const dateBrute = new Date(y, m - 1, day).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
            dateFormatee = dateBrute.charAt(0).toUpperCase() + dateBrute.slice(1);
        }
        const dureeFormatee = formatDureeHistorique(s.tempsTotalCalc || 0);

        listeHist.innerHTML += `
            <div class="history-item">
                <div class="item-header" style="align-items: center;">
                    <div style="display:flex; flex-direction:column; gap:4px;">
                        <div><span class="categorie" style="color: var(--text-primary);">${dateFormatee}</span>${s.tonalite_du_jour ? `<span style="color: var(--text-muted); margin-left: 8px; font-size: 14px;">${formatTonalite(s.tonalite_du_jour)}</span>` : ''}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span class="badge-temps" style="color: var(--text-muted); border-color: var(--border-color); background: transparent; margin:0;">${dureeFormatee}</span>
                        <button class="btn-action btn-ghost-red btn-square" onclick="supprimerSeance(${s.id})" title="${t('common.delete')}" style="height: 28px; width: 28px;">${svgTrash}</button>
                    </div>
                </div>
                <div style="margin-top: 8px;">${itemsHtml}</div>
            </div>`;
    });
}

function ouvrirModalGraph(type, event) {
    if (event) event.stopPropagation();
    graphTypeActuel = type;
    if (type === 'tonalites') { document.getElementById('dd-type-graph').style.display = 'none'; }
    else {
        document.getElementById('dd-type-graph').style.display = 'inline-block';
        document.querySelectorAll('#dd-type-graph .dropdown-content button').forEach(b => b.classList.remove('active'));
        const btnType = document.getElementById(`filter-type-${type}`);
        if (btnType) btnType.classList.add('active');
    }
    document.getElementById('modal-graph').style.display = 'flex'; changerPeriodeGraph('semaine');
}

function changerTypeGraph(type) {
    graphTypeActuel = type;
    document.querySelectorAll('#dd-type-graph .dropdown-content button').forEach(b => b.classList.remove('active'));
    const btnType = document.getElementById(`filter-type-${type}`);
    if (btnType) btnType.classList.add('active');
    fermerTousLesDropdowns();
    changerPeriodeGraph(graphPeriodeActuelle);
}

function changerPeriodeGraph(periode) {
    graphPeriodeActuelle = periode;
    document.querySelectorAll('#dd-periode-graph .dropdown-content button').forEach(b => b.classList.remove('active'));
    const btnPer = document.getElementById(`filter-graph-${periode}`);
    if (btnPer) btnPer.classList.add('active');
    fermerTousLesDropdowns();

    let chartData;
    if (typeof window !== 'undefined' && window.HistoryAnalytics && typeof window.HistoryAnalytics.calculatePeriodChartData === 'function') {
        chartData = window.HistoryAnalytics.calculatePeriodChartData(historiquesTerminees, periode, {
            i18n: {
                days_week: t('history.days_week'),
                weeks_month: t('history.weeks_month'),
                months_year: t('history.months_year')
            }
        });
    } else {
        const now = new Date();
        let startDate = new Date(0);
        let labels = [];
        let dataMap = {};
        if (periode === 'semaine') {
            startDate = getMonday(now);
            startDate.setHours(0, 0, 0, 0);
            labels = [...t('history.days_week')];
        } else if (periode === 'mois') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            labels = [...t('history.weeks_month')];
        } else if (periode === 'annee') {
            startDate = new Date(now.getFullYear(), 0, 1);
            labels = [...t('history.months_year')];
        } else {
            labels = [];
        }
        labels.forEach(l => { dataMap[l] = 0; });

        let totalMinutes = 0;
        const categoriesMap = {};
        const tonalitiesMap = {};

        historiquesTerminees.forEach(s => {
            if (!s.date_seance) return;
            const dateSeance = new Date(s.date_seance);
            if (dateSeance >= startDate) {
                const sessionMins = s.tempsTotalCalc || Math.round((s.duree_reelle || 0) / 60);
                totalMinutes += sessionMins;

                if (Array.isArray(s.items)) {
                    s.items.forEach(item => {
                        if (item && item.fait && item.categorie) {
                            const prevu = Number(item.temps_prevu || 0) * 60;
                            const restant = Number(item.temps_restant || 0);
                            const reelSecs = item.isOvertime ? (prevu + restant) : Math.max(0, prevu - restant);
                            categoriesMap[item.categorie] = (categoriesMap[item.categorie] || 0) + Math.round(reelSecs / 60);
                        }
                    });
                }

                if (s.tonalite_du_jour) {
                    const tRel = getTonaliteMajeureRelative(s.tonalite_du_jour);
                    tonalitiesMap[tRel] = (tonalitiesMap[tRel] || 0) + 1;
                }

                if (periode === 'semaine') {
                    const day = dateSeance.getDay();
                    const idx = day === 0 ? 6 : day - 1;
                    if (labels[idx]) dataMap[labels[idx]] += sessionMins;
                } else if (periode === 'mois') {
                    let weekIdx = Math.floor((dateSeance.getDate() - 1) / 7);
                    if (weekIdx > 4) weekIdx = 4;
                    if (labels[weekIdx]) dataMap[labels[weekIdx]] += sessionMins;
                } else if (periode === 'annee') {
                    if (labels[dateSeance.getMonth()]) dataMap[labels[dateSeance.getMonth()]] += sessionMins;
                } else {
                    const yr = dateSeance.getFullYear().toString();
                    if (!labels.includes(yr)) { labels.push(yr); dataMap[yr] = 0; }
                    dataMap[yr] += sessionMins;
                }
            }
        });

        const catLabels = Object.keys(categoriesMap);
        const catMinutes = catLabels.map(l => categoriesMap[l]);
        const catTotal = catMinutes.reduce((a, b) => a + b, 0) || 1;
        const catPercentages = catMinutes.map(m => Math.round((m / catTotal) * 100));

        chartData = {
            totalMinutes,
            totalHoursFormatted: (totalMinutes / 60).toFixed(1),
            labels,
            dataHours: labels.map(l => parseFloat(((dataMap[l] || 0) / 60).toFixed(1))),
            categories: {
                labels: catLabels,
                dataMinutes: catMinutes,
                percentages: catPercentages,
                formattedLabels: catLabels.map((l, i) => `${l} · ${catPercentages[i]}%`)
            },
            tonalities: {
                labels: Object.keys(tonalitiesMap),
                counts: Object.values(tonalitiesMap)
            }
        };
    }

    document.getElementById('total-temps-graph').innerText = t('history.total_hours', { hours: chartData.totalHoursFormatted });
    if (monGraphique) {
        try { monGraphique.destroy(); } catch (e) { }
        monGraphique = null;
    }
    if (typeof Chart !== 'undefined' && typeof Chart.getChart === 'function') {
        const existing = Chart.getChart('myChart');
        if (existing) {
            try { existing.destroy(); } catch (e) { }
        }
    }
    const ctx = document.getElementById('myChart').getContext('2d');
    const titre = document.getElementById('titre-graph');

    // Couleurs dynamiques héritées du thème CSS actif
    const rootStyle = getComputedStyle(document.documentElement);
    const themeAccent = rootStyle.getPropertyValue('--accent-amber').trim() || '#e3a24a';
    const themeAccentSec = rootStyle.getPropertyValue('--accent-secondary').trim() || '#9aae7c';
    const themeText = rootStyle.getPropertyValue('--text-primary').trim() || '#f3e8d8';
    const themeMuted = rootStyle.getPropertyValue('--text-muted').trim() || '#dbc8ae';
    const themeBorder = rootStyle.getPropertyValue('--border-color').trim() || 'rgba(255,255,255,0.08)';
    const themeCard = rootStyle.getPropertyValue('--card-bg').trim() || '#1b1612';
    const themeDanger = rootStyle.getPropertyValue('--accent-red').trim() || '#cc6a4e';

    const colorsPalette = [
        themeAccent,
        themeAccentSec,
        '#d4a359',
        themeDanger,
        '#b8bb26',
        '#c9a86a',
        '#8fa876',
        themeMuted
    ];

    if (graphTypeActuel === 'temps') {
        titre.textContent = t('history.chart_time_spent');
        if (chartData.totalMinutes === 0) {
            monGraphique = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: [t('history.no_data')],
                    datasets: [{ label: t('history.hours_label'), data: [0], backgroundColor: themeBorder, borderRadius: 4 }]
                },
                options: {
                    responsive: true,
                    color: themeText,
                    scales: { y: { display: false }, x: { display: false } },
                    plugins: { legend: { display: false } }
                }
            });
        } else {
            monGraphique = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: chartData.labels,
                    datasets: [{
                        label: t('history.hours_label'),
                        data: chartData.dataHours,
                        backgroundColor: themeAccent,
                        borderRadius: 6,
                        maxBarThickness: 40
                    }]
                },
                options: {
                    responsive: true,
                    color: themeText,
                    scales: {
                        y: { grid: { color: themeBorder }, ticks: { color: themeMuted } },
                        x: { grid: { display: false }, ticks: { color: themeMuted } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }
    } else if (graphTypeActuel === 'categories') {
        titre.textContent = t('history.chart_time_dist');
        const categories = chartData.categories || { labels: [], dataMinutes: [], percentages: [], formattedLabels: [] };
        if (!categories.labels || categories.labels.length === 0) {
            monGraphique = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: [t('history.no_data')],
                    datasets: [{ data: [1], backgroundColor: [themeBorder], borderColor: themeCard, borderWidth: 2 }]
                },
                options: {
                    responsive: true,
                    color: themeText,
                    plugins: { tooltip: { enabled: false }, legend: { display: false } }
                }
            });
        } else {
            const isThemeClair = document.documentElement.getAttribute('data-theme') === 'clair' || document.documentElement.getAttribute('data-theme') === 'creme';
            const doughnutPalette = (typeof window !== 'undefined' && window.HistoryAnalytics && typeof window.HistoryAnalytics.getCategoryPalette === 'function')
                ? window.HistoryAnalytics.getCategoryPalette(categories.labels.length, isThemeClair)
                : ((typeof window !== 'undefined' && window.HistoryAnalytics && typeof window.HistoryAnalytics.getContrastingPalette === 'function')
                    ? window.HistoryAnalytics.getContrastingPalette(colorsPalette, categories.labels.length, isThemeClair)
                    : colorsPalette);

            const pluginsList = [];
            if (typeof window !== 'undefined' && window.HistoryAnalytics && typeof window.HistoryAnalytics.createCategoryDoughnutPlugin === 'function') {
                pluginsList.push(window.HistoryAnalytics.createCategoryDoughnutPlugin({
                    textColor: themeText,
                    textMutedColor: themeMuted,
                    textSecondaryColor: themeAccentSec,
                    centerTitleColor: isThemeClair ? themeAccentSec : themeText,
                    isLight: isThemeClair
                }));
            }

            const durationsFormatted = categories.dataMinutes.map(m => (typeof formatDureeHistorique === 'function' ? formatDureeHistorique(m) : `${m} min`));

            monGraphique = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: categories.labels,
                    formattedLabels: categories.formattedLabels,
                    durationsFormatted: durationsFormatted,
                    totalHoursFormatted: chartData.totalHoursFormatted,
                    datasets: [{
                        data: categories.dataMinutes,
                        backgroundColor: doughnutPalette,
                        borderColor: themeCard,
                        borderWidth: 2,
                        hoverOffset: 6
                    }]
                },
                plugins: pluginsList,
                options: {
                    responsive: true,
                    color: themeText,
                    cutout: '58%',
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    }
                }
            });
        }
    } else if (graphTypeActuel === 'tonalites') {
        titre.textContent = t('history.chart_sessions_key');
        const tonalities = chartData.tonalities || { labels: [], counts: [] };
        if (!tonalities.labels || tonalities.labels.length === 0) {
            monGraphique = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: [t('history.no_data')],
                    datasets: [{ label: t('history.sessions_count'), data: [0], backgroundColor: themeBorder, borderRadius: 4, maxBarThickness: 40 }]
                },
                options: {
                    responsive: true,
                    color: themeText,
                    scales: {
                        y: { ticks: { stepSize: 1, color: themeMuted }, grid: { color: themeBorder } },
                        x: { ticks: { color: themeMuted }, grid: { display: false } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        } else {
            const bgColors = tonalities.labels.map((_, i) => colorsPalette[i % colorsPalette.length]);
            const labelsNettoyes = tonalities.labels.map(ton => formatTonalite(ton));
            monGraphique = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labelsNettoyes,
                    datasets: [{
                        label: t('history.sessions_count'),
                        data: tonalities.counts,
                        backgroundColor: bgColors,
                        borderRadius: 6,
                        maxBarThickness: 40
                    }]
                },
                options: {
                    responsive: true,
                    color: themeText,
                    scales: {
                        y: { ticks: { stepSize: 1, color: themeMuted }, grid: { color: themeBorder } },
                        x: { ticks: { color: themeMuted }, grid: { display: false } }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }
    }
}
function fermerModal() { document.getElementById('modal-graph').style.display = 'none'; }

function updateCardObjectifUI(weeklyGoal) {
    const goalEl = document.getElementById('stat-objectif-pct');
    const barContainer = document.getElementById('stat-objectif-bar-container');
    const barFill = document.getElementById('stat-objectif-bar-fill');
    if (!goalEl) return;

    if (!weeklyGoal || !weeklyGoal.hasGoal) {
        goalEl.textContent = (typeof t === 'function' ? t('history.set_goal_hint') : null) || "Cliquer pour fixer un objectif";
        goalEl.style.fontSize = "12px";
        goalEl.style.fontWeight = "500";
        goalEl.style.color = "var(--text-muted)";
        goalEl.style.opacity = "0.7";
        if (barContainer) barContainer.style.display = "none";
    } else {
        goalEl.textContent = weeklyGoal.formattedPercentage;
        goalEl.style.fontSize = "20px";
        goalEl.style.fontWeight = "700";
        goalEl.style.opacity = "1";

        if (weeklyGoal.isCompleted) {
            goalEl.style.color = "var(--accent-secondary)";
        } else {
            goalEl.style.color = "var(--text-primary)";
        }

        if (barContainer && barFill) {
            barContainer.style.display = "block";
            const fillPct = Math.min(100, Math.round(weeklyGoal.progressRatio * 100));
            barFill.style.width = `${fillPct}%`;
            if (weeklyGoal.isCompleted) {
                barFill.style.backgroundColor = "var(--accent-secondary)";
            } else {
                barFill.style.backgroundColor = "var(--accent-amber)";
            }
        }
    }
}
window.updateCardObjectifUI = updateCardObjectifUI;

// --- MODALE OBJECTIF HEBDOMADAIRE ---
function ouvrirModalObjectifHebdo(event) {
    if (event) event.stopPropagation();
    const rawGoal = localStorage.getItem('piano_workout_weekly_goal_hours');
    let val = rawGoal ? parseInt(rawGoal, 10) : 0;
    if (isNaN(val) || val < 0) val = 0;

    syncObjectifHebdoDisplay(val);
    attacherControlesObjectifInteractifs();

    const modal = document.getElementById('modal-objectif-hebdo');
    if (modal) modal.style.display = 'flex';
}
window.ouvrirModalObjectifHebdo = ouvrirModalObjectifHebdo;

function fermerModalObjectifHebdo() {
    const modal = document.getElementById('modal-objectif-hebdo');
    if (modal) modal.style.display = 'none';
}
window.fermerModalObjectifHebdo = fermerModalObjectifHebdo;

function syncObjectifHebdoDisplay(v) {
    const input = document.getElementById('input-goal-hours');
    if (input) input.value = v;

    const displayVal = document.getElementById('display-goal-hours-val');
    const displayUnit = document.getElementById('display-goal-hours-unit');

    if (displayVal && displayUnit) {
        if (v === 0) {
            displayVal.textContent = '0';
            displayVal.style.color = 'var(--text-muted)';
            displayUnit.textContent = (typeof t === 'function' ? t('history.no_goal_label') : null) || "Ne pas définir d'objectif";
            displayUnit.style.color = 'var(--text-muted)';
        } else {
            displayVal.textContent = v;
            displayVal.style.color = 'var(--accent-amber)';
            displayUnit.textContent = v > 1 ? 'HEURES / SEMAINE' : 'HEURE / SEMAINE';
            displayUnit.style.color = 'var(--text-muted)';
        }
    }
}

function fixerObjectifHebdo(val) {
    let v = parseInt(val, 10);
    if (isNaN(v) || v < 0) v = 0;
    if (v > 168) v = 168; // 7 * 24 heures maximum

    syncObjectifHebdoDisplay(v);

    if (v === 0) {
        localStorage.removeItem('piano_workout_weekly_goal_hours');
    } else {
        localStorage.setItem('piano_workout_weekly_goal_hours', v.toString());
    }

    chargerHistorique();
}
window.fixerObjectifHebdo = fixerObjectifHebdo;

function changerObjectifHebdo(delta) {
    const input = document.getElementById('input-goal-hours');
    let cur = parseInt(input ? input.value : 0, 10);
    if (isNaN(cur)) cur = 0;
    fixerObjectifHebdo(cur + delta);
}
window.changerObjectifHebdo = changerObjectifHebdo;

let goalTimeDragState = { active: false, startY: 0, startVal: 0 };
function attacherControlesObjectifInteractifs() {
    const zone = document.getElementById('goal-time-swipe-zone');
    if (!zone || zone.dataset.interactiveAttached === 'true') return;
    zone.dataset.interactiveAttached = 'true';

    zone.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 1 : -1;
        const input = document.getElementById('input-goal-hours');
        const cur = parseInt(input ? input.value : 0, 10) || 0;
        fixerObjectifHebdo(cur + delta);
    }, { passive: false });

    const onStart = (clientY) => {
        goalTimeDragState.active = true;
        goalTimeDragState.startY = clientY;
        const input = document.getElementById('input-goal-hours');
        goalTimeDragState.startVal = parseInt(input ? input.value : 0, 10) || 0;
        zone.classList.add('dragging');
    };

    const onMove = (clientY) => {
        if (!goalTimeDragState.active) return;
        const diffY = goalTimeDragState.startY - clientY;
        const deltaHours = Math.round(diffY / 14);
        fixerObjectifHebdo(goalTimeDragState.startVal + deltaHours);
    };

    const onEnd = () => {
        if (!goalTimeDragState.active) return;
        goalTimeDragState.active = false;
        zone.classList.remove('dragging');
    };

    zone.addEventListener('mousedown', (e) => { e.preventDefault(); onStart(e.clientY); });
    window.addEventListener('mousemove', (e) => { if (goalTimeDragState.active) onMove(e.clientY); });
    window.addEventListener('mouseup', onEnd);

    zone.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            e.preventDefault();
            onStart(e.touches[0].clientY);
        }
    }, { passive: false });

    window.addEventListener('touchmove', (e) => {
        if (goalTimeDragState.active && e.touches.length === 1) {
            onMove(e.touches[0].clientY);
        }
    }, { passive: true });

    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
}

// --- MODALE RÉGULARITÉ & SÉRIES ---
let streakCalCurrentYear = null;
let streakCalCurrentMonth = null;

function naviguerMoisStreak(delta) {
    if (streakCalCurrentYear === null || streakCalCurrentMonth === null) {
        const now = new Date();
        streakCalCurrentYear = now.getFullYear();
        streakCalCurrentMonth = now.getMonth();
    }
    streakCalCurrentMonth += delta;
    if (streakCalCurrentMonth < 0) {
        streakCalCurrentMonth = 11;
        streakCalCurrentYear--;
    } else if (streakCalCurrentMonth > 11) {
        streakCalCurrentMonth = 0;
        streakCalCurrentYear++;
    }
    renderStreakCalendar();
}
window.naviguerMoisStreak = naviguerMoisStreak;

function renderStreakCalendar() {
    const now = new Date();
    if (streakCalCurrentYear === null || streakCalCurrentMonth === null) {
        streakCalCurrentYear = now.getFullYear();
        streakCalCurrentMonth = now.getMonth();
    }

    const locale = typeof getLocaleCode === 'function' ? getLocaleCode() : 'fr-FR';

    let cal;
    if (typeof window !== 'undefined' && window.HistoryAnalytics && typeof window.HistoryAnalytics.calculateMonthCalendar === 'function') {
        cal = window.HistoryAnalytics.calculateMonthCalendar(historiquesTerminees, streakCalCurrentYear, streakCalCurrentMonth, { now, locale });
    } else {
        cal = {
            year: streakCalCurrentYear,
            month: streakCalCurrentMonth,
            monthTitle: `${streakCalCurrentYear}-${streakCalCurrentMonth + 1}`,
            weekdays: ['L', 'M', 'M', 'J', 'V', 'S', 'D'],
            days: [],
            monthActiveDays: 0,
            daysInMonth: 31,
            activeRatioFormatted: '0 j'
        };
    }

    // 1. Titre et pratique du mois
    const titleEl = document.getElementById('streak-cal-month-title');
    if (titleEl) titleEl.textContent = cal.monthTitle;

    const subtitleEl = document.getElementById('streak-cal-month-subtitle');
    const isEn = (typeof getCurrentLang === 'function' && getCurrentLang() === 'en') || locale.startsWith('en');
    const count = cal.monthActiveDays || 0;

    if (count > 0) {
        if (subtitleEl) {
            subtitleEl.textContent = isEn
                ? `${count} practice ${count > 1 ? 'days' : 'day'}`
                : `${count} ${count > 1 ? 'jours' : 'jour'} de pratique`;
            subtitleEl.style.display = 'inline';
        }
    } else {
        if (subtitleEl) {
            subtitleEl.textContent = '';
            subtitleEl.style.display = 'none';
        }
    }

    // 2. En-têtes des jours de la semaine
    const weekdaysEl = document.getElementById('streak-cal-weekdays');
    if (weekdaysEl) {
        weekdaysEl.innerHTML = cal.weekdays.map(w => `<span style="font-size: 11px; font-weight: 700; color: var(--text-muted); opacity: 0.8;">${w}</span>`).join('');
    }

    // 3. Grille des jours
    const daysEl = document.getElementById('streak-cal-days');
    if (daysEl) {
        daysEl.innerHTML = cal.days.map(day => {
            const isCur = day.isCurrentMonth;
            const hasPrat = day.hasPractice;
            const isToday = day.isToday;

            let bg = 'transparent';
            let color = isCur ? 'var(--text-primary)' : 'var(--text-muted)';
            let opacity = isCur ? '1' : '0.28';
            let border = '2px solid transparent';
            let fontWeight = isCur ? '600' : '400';

            if (hasPrat && isCur) {
                bg = 'var(--accent-amber)';
                color = '#110d0a';
                fontWeight = '800';
            }

            if (isToday) {
                border = hasPrat ? '2px solid var(--text-primary)' : '2px solid var(--accent-amber)';
                fontWeight = '800';
            }

            const title = `${day.dateKey}${day.totalMinutes ? ` : ${day.totalMinutes} min` : ''}`;

            return `
                <div style="width: 34px; height: 34px; box-sizing: border-box; border-radius: 999px; background: ${bg}; border: ${border}; opacity: ${opacity}; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: ${fontWeight}; color: ${color}; cursor: pointer; transition: transform 0.1s ease;" title="${title}">
                    ${day.dayNum}
                </div>`;
        }).join('');
    }
}
window.renderStreakCalendar = renderStreakCalendar;

function ouvrirModalStreak(event) {
    if (event) event.stopPropagation();

    const now = new Date();
    streakCalCurrentYear = now.getFullYear();
    streakCalCurrentMonth = now.getMonth();

    let stats;
    if (typeof window !== 'undefined' && window.HistoryAnalytics && typeof window.HistoryAnalytics.calculateStreakStats === 'function') {
        stats = window.HistoryAnalytics.calculateStreakStats(historiquesTerminees, now);
    } else {
        stats = {
            currentStreak: 0,
            maxStreak: 0,
            monthActiveDays: 0,
            totalActiveDays: 0
        };
    }

    const curEl = document.getElementById('streak-modal-current');
    if (curEl) {
        const span = curEl.querySelector('span');
        if (span) span.textContent = `${stats.currentStreak} j`;
    }

    const recEl = document.getElementById('streak-modal-record');
    if (recEl) {
        const span = recEl.querySelector('span');
        if (span) span.textContent = `${stats.maxStreak} j`;
    }

    const monthEl = document.getElementById('streak-modal-month');
    if (monthEl) {
        const span = monthEl.querySelector('span');
        if (span) span.textContent = `${stats.monthActiveDays} j`;
    }

    renderStreakCalendar();

    const modal = document.getElementById('modal-streak-detail');
    if (modal) modal.style.display = 'flex';
}
window.ouvrirModalStreak = ouvrirModalStreak;

function fermerModalStreak() {
    const modal = document.getElementById('modal-streak-detail');
    if (modal) modal.style.display = 'none';
}
window.fermerModalStreak = fermerModalStreak;


// ==========================================
// --- VOCABULAIRE ET BIBLIOTHÈQUE        ---
// ==========================================
const MODAL_BACKDROP_CLOSERS = {
    'modal-audio-player': () => typeof fermerModalAudioPlayer === 'function' && fermerModalAudioPlayer(),
    'modal-metronome': () => typeof fermerModalMetronome === 'function' && fermerModalMetronome(),
    'modal-dictaphone': () => typeof fermerModalDictaphone === 'function' && fermerModalDictaphone(),
    'modal-graph': () => typeof fermerModal === 'function' && fermerModal(),
    'modal-objectif-hebdo': () => typeof fermerModalObjectifHebdo === 'function' && fermerModalObjectifHebdo(),
    'modal-streak-detail': () => typeof fermerModalStreak === 'function' && fermerModalStreak(),
    'modal-image-fullscreen': () => typeof fermerModalImage === 'function' && fermerModalImage(),
    'modal-routines': () => typeof fermerModalRoutines === 'function' && fermerModalRoutines(),
    'modal-save-routine': () => typeof fermerModalSaveRoutine === 'function' && fermerModalSaveRoutine(),
    'modal-playlist': () => typeof fermerModalPlaylist === 'function' && fermerModalPlaylist(),
    'modal-settings': () => typeof fermerModalSettings === 'function' && fermerModalSettings(),
    'modal-trieur': () => typeof fermerTrieur === 'function' && fermerTrieur(),
    'modal-cahier-choix': () => typeof fermerModalCahierChoix === 'function' && fermerModalCahierChoix(),
    'modal-cahier-save': () => typeof fermerModalCahierSave === 'function' && fermerModalCahierSave(),
    'modal-concert-setlist': () => typeof fermerSetlistDrawer === 'function' && fermerSetlistDrawer(),
    'modal-item': () => typeof fermerModalItem === 'function' && fermerModalItem()
};

window.onclick = function (event) {
    if (!event.target.closest('.dropdown') || event.target.closest('.dropdown-content button')) {
        fermerTousLesDropdowns();
    }
    if (event.target.classList.contains('modal')) {
        const closeFn = MODAL_BACKDROP_CLOSERS[event.target.id];
        if (closeFn) closeFn();
    }
};

function toggleDropdown(id, event) {
    event.stopPropagation();
    document.querySelectorAll('.dropdown').forEach(d => { if (d.id !== id) d.classList.remove('show') });
    document.getElementById(id).classList.toggle('show');
}

function rechercherBiblio(val) { searchQueryBiblio = val.trim().toLowerCase(); renderBibliotheque(); }

function toggleFilterFav(context = 'biblio') {
    if (context === 'biblio') {
        showFavBiblio = !showFavBiblio; const btn = document.getElementById('btn-filter-fav-biblio');
        if (showFavBiblio) { btn.classList.replace('btn-ghost-neutral', 'btn-ghost-amber'); btn.innerHTML = svgStarFilled; }
        else { btn.classList.replace('btn-ghost-amber', 'btn-ghost-neutral'); btn.innerHTML = svgStarOutline; }
        renderBibliotheque();
    }
}

async function toggleFavori(id, event) {
    if (event) event.stopPropagation();
    try {
        const data = await apiFetch(`/vocabulaire/${id}/favori`, { method: 'PUT' });
        const index = vocabulaireCache.findIndex(i => i.id === id);
        if (index !== -1) vocabulaireCache[index].favori = data.favori;

        if (document.getElementById('vue-bibliotheque').classList.contains('vue-active')) renderBibliotheque();

        if (isPupitreActive) {
            const qIdx = currentShuffleQueue.findIndex(i => i.id === id);
            if (qIdx !== -1) {
                currentShuffleQueue[qIdx].favori = data.favori;
                currentShuffleQueue = window.LibraryDomain.sortImmersiveQueue(currentShuffleQueue);
            }
            renderShuffleCard();
        }
    } catch (e) { }
}

function setFilter(context, filterValue, filterLabel) {
    if (context === 'biblio') {
        currentFilterBiblio = filterValue;
        document.querySelectorAll('#dd-filter-biblio .dropdown-content button').forEach(b => b.classList.remove('active'));
        const safeId = filterValue.replace(/[^a-zA-Z0-9]/g, '_');
        const btnFilter = document.getElementById(`filter-biblio-${safeId}`);
        if (btnFilter) btnFilter.classList.add('active');
        fermerTousLesDropdowns();
        renderBibliotheque();
    }
}

function setSort(context, sortValue) {
    if (context === 'biblio') {
        currentSortBiblio = sortValue;
        document.querySelectorAll('#dd-biblio .dropdown-content button').forEach(b => b.classList.remove('active'));
        const btnSort = document.getElementById(`sort-biblio-${sortValue}`);
        if (btnSort) btnSort.classList.add('active');
        fermerTousLesDropdowns();
        renderBibliotheque();
    }
}

let itemModalSelectedSousCats = new Set();

function gererSousCategoriesForm(preserveSelection = false) {
    const typeSelect = document.getElementById('input-vocab-type');
    const sousCatContainer = document.getElementById('container-vocab-sous-cat');
    const sousCatSelect = document.getElementById('input-vocab-sous-type');
    const sousCatLabel = document.getElementById('label-vocab-sous-type');
    const chipsBox = document.getElementById('chips-vocab-sous-categories');

    if (!typeSelect || !sousCatContainer || !sousCatSelect) return;

    const categorie = typeSelect.value;
    const isMorceaux = typeof estCategorieMorceaux === 'function' ? estCategorieMorceaux(categorie) : (categorie === 'Morceaux');
    if (sousCatLabel) {
        sousCatLabel.textContent = isMorceaux ? t('library.setlists_subcat_label') : t('library.subcategory_label');
    }

    if (!preserveSelection) {
        itemModalSelectedSousCats.clear();
    }

    const listeSousCategories = getSousCategoriesPour(categorie);
    const unionList = Array.from(new Set([...(listeSousCategories || []), ...Array.from(itemModalSelectedSousCats)]));

    if (unionList.length > 0) {
        const noneLabel = t('library.none_subcat');
        sousCatSelect.innerHTML = `<option value="">— ${noneLabel} —</option>`;
        unionList.forEach(sc => {
            const safeVal = sc.replace(/"/g, '&quot;');
            sousCatSelect.innerHTML += `<option value="${safeVal}">${sc}</option>`;
        });
        sousCatSelect.value = Array.from(itemModalSelectedSousCats)[0] || '';
        sousCatContainer.style.display = 'block';

        if (chipsBox) {
            chipsBox.innerHTML = '';
            unionList.forEach(sc => {
                const isAct = itemModalSelectedSousCats.has(sc);
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = `chip btn-action ${isAct ? 'btn-ghost-blue active' : 'btn-ghost-neutral'}`;
                btn.style.fontSize = '12px';
                btn.style.height = '28px';
                btn.style.padding = '0 10px';
                btn.textContent = sc;
                btn.onclick = () => toggleItemModalSousCatChip(sc);
                chipsBox.appendChild(btn);
            });
        }
    } else {
        sousCatSelect.innerHTML = '';
        sousCatContainer.style.display = 'none';
        if (chipsBox) {
            chipsBox.innerHTML = '';
        }
    }
}

function toggleItemModalSousCatChip(sc) {
    if (!sc) return;
    if (itemModalSelectedSousCats.has(sc)) {
        itemModalSelectedSousCats.delete(sc);
    } else {
        itemModalSelectedSousCats.add(sc);
    }
    const sousCatSelect = document.getElementById('input-vocab-sous-type');
    if (sousCatSelect) {
        sousCatSelect.value = Array.from(itemModalSelectedSousCats)[0] || '';
    }
    gererSousCategoriesForm(true);
}

function estItemFavori(item) {
    if (!item) return false;
    if (item.favori === true || item.favori === "true" || item.favori === 1) return true;
    if (Array.isArray(item.sous_categories) && item.sous_categories.some(sc => typeof estLabelFavoris === 'function' ? estLabelFavoris(sc) : sc === 'Favoris')) return true;
    if (typeof estLabelFavoris === 'function' ? estLabelFavoris(item.sous_categorie) : item.sous_categorie === 'Favoris') return true;
    return false;
}

function renderSousCategoriesChips(categorie) {
    const container = document.getElementById('container-sous-categorie');
    const chipGroup = document.getElementById('chips-sous-categorie');

    if (!container || !chipGroup) return;

    const sousCats = (getSousCategoriesPour(categorie) || []).filter(sc => !(typeof estLabelFavoris === 'function' ? estLabelFavoris(sc) : sc === 'Favoris'));
    const listePuces = categorie ? ['Favoris', ...sousCats] : sousCats;

    if (listePuces && listePuces.length > 0) {
        container.style.display = 'block';
        chipGroup.innerHTML = '';
        listePuces.forEach(sc => {
            const safeVal = sc.replace(/'/g, "\\'");
            const displayLabel = (typeof estLabelFavoris === 'function' && estLabelFavoris(sc)) ? t('common.favorites') : sc;
            chipGroup.innerHTML += `<button type="button" class="chip btn-action btn-ghost-neutral" data-value="${sc.replace(/"/g, '&quot;')}" onclick="selectChip('sous-categorie', '${safeVal}')">${displayLabel}</button>`;
        });
    } else {
        container.style.display = 'none';
        chipGroup.innerHTML = '';
    }
}

function initBibliothequeUI() {
    const typesRessources = Object.keys(SOUS_CATEGORIES);
    const selectType = document.getElementById('input-vocab-type');
    if (selectType) {
        selectType.innerHTML = ''; typesRessources.forEach(type => { selectType.innerHTML += `<option value="${type}">${type}</option>`; });
        if (typesRessources.length > 0) gererSousCategoriesForm();
    }
    const filterContent = document.getElementById('content-filter-biblio');
    if (filterContent) {
        const allCatsLabel = t('library.all_categories');
        const safeAllCats = allCatsLabel.replace(/'/g, "\\'");
        let htmlFiltres = `<button onclick="setFilter('biblio', 'Toutes', '${safeAllCats}')" id="filter-biblio-Toutes" class="${currentFilterBiblio === 'Toutes' ? 'active' : ''}">${allCatsLabel}</button>`;
        typesRessources.forEach(type => {
            const safeType = type.replace(/[^a-zA-Z0-9]/g, '_');
            const isAct = currentFilterBiblio === type ? 'active' : '';
            htmlFiltres += `<button onclick="setFilter('biblio', '${type}', '${type}')" id="filter-biblio-${safeType}" class="${isAct}">${type}</button>`;
        });
        filterContent.innerHTML = htmlFiltres;
    }
}

function getSousCategoriesPour(categorie) {
    let liste = [];
    if (typeof estCategorieMorceaux === 'function' ? estCategorieMorceaux(categorie) : categorie === 'Morceaux') {
        const setlistsFromItems = (typeof window !== 'undefined' && window.LibraryDomain && typeof window.LibraryDomain.getSetlists === 'function')
            ? window.LibraryDomain.getSetlists(vocabulaireCache)
            : [];
        const setlists = new Set(setlistsFromItems);
        const catMorceaux = typeof getNomCategorieMorceaux === 'function' ? getNomCategorieMorceaux(SOUS_CATEGORIES) : 'Morceaux';
        if (Array.isArray(SOUS_CATEGORIES[catMorceaux])) {
            SOUS_CATEGORIES[catMorceaux].forEach(sc => {
                if (sc && !estStyleIrealAFiltrer(sc)) setlists.add(sc);
            });
        }
        liste = Array.from(setlists).sort();
    } else if (SOUS_CATEGORIES[categorie]) { liste = SOUS_CATEGORIES[categorie]; }
    return liste;
}

let vocabulaireSupprimerScoreFlag = false;
let vocabulaireSupprimerAudioFlag = false;

function ouvrirModalItem(id = null) {
    annulerEdition(false);
    const modal = document.getElementById('modal-item');
    const titleEl = document.getElementById('titre-modal-item');

    if (id !== null && id !== undefined) {
        const item = (typeof vocabulaireCache !== 'undefined' && Array.isArray(vocabulaireCache))
            ? vocabulaireCache.find(i => Number(i.id) === Number(id))
            : null;
        if (item) {
            remplirFormulaireEditionItem(item);
            if (titleEl) titleEl.textContent = t('library.modal_edit_title');
        }
    } else {
        if (titleEl) titleEl.textContent = t('library.modal_add_title');
        const selectType = document.getElementById('input-vocab-type');
        if (selectType) {
            const defCat = typeof getCategorieParDefaut === 'function' ? getCategorieParDefaut() : selectType.options[0]?.value;
            if (defCat && Array.from(selectType.options).some(o => o.value === defCat)) {
                selectType.value = defCat;
            }
        }
        itemModalSelectedSousCats.clear();
        gererSousCategoriesForm(false);
    }

    if (modal) modal.style.display = 'flex';
}

function fermerModalItem() {
    const modal = document.getElementById('modal-item');
    if (modal) modal.style.display = 'none';
    annulerEdition(false);
}

async function ajouterVocabulaire(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-submit-vocab');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = t('common.processing');

    const formData = new FormData();
    formData.append('nom', document.getElementById('input-vocab-nom').value);
    formData.append('type_item', document.getElementById('input-vocab-type').value);

    // Sous-catégories / Setlists : puces cochées
    const selectedSc = new Set(itemModalSelectedSousCats);
    const scArray = Array.from(selectedSc).filter(Boolean);
    formData.append('sous_categories_json', JSON.stringify(scArray));
    if (scArray[0]) formData.append('sous_categorie', scArray[0]);

    // Les 4 Attributs d'item : compositeur, style, tonalite, tempo
    const compInput = document.getElementById('input-vocab-compositeur');
    const styleInput = document.getElementById('input-vocab-style');
    const tonaInput = document.getElementById('input-vocab-tonalite');
    const tempoInput = document.getElementById('input-vocab-tempo');
    formData.append('compositeur', compInput ? compInput.value.trim() : '');
    formData.append('style', styleInput ? styleInput.value.trim() : '');
    formData.append('tonalite', tonaInput ? tonaInput.value.trim() : '');
    formData.append('tempo', tempoInput ? tempoInput.value.trim() : '');

    // Fichiers de partition ou médias
    const fileInput = document.getElementById('input-vocab-image');
    if (fileInput && fileInput.files.length > 0) {
        for (let i = 0; i < fileInput.files.length; i++) {
            const f = fileInput.files[i];
            const ext = f.name.split('.').pop().toLowerCase();
            if (['mp3', 'wav', 'm4a', 'ogg', 'webm', 'flac', 'aac'].includes(ext) || f.type.startsWith('audio/')) {
                formData.append('fichier_audio', f);
            } else {
                formData.append('fichiers', f);
            }
        }
    }

    // Fichier audio explicite
    const audioInput = document.getElementById('input-vocab-audio');
    if (audioInput && audioInput.files.length > 0) {
        formData.append('fichier_audio', audioInput.files[0]);
    }

    if (vocabulaireSupprimerAudioFlag) {
        formData.append('supprimer_audio', 'true');
    }
    if (vocabulaireSupprimerScoreFlag) {
        formData.append('supprimer_partition', 'true');
    }

    try {
        const scrollBefore = window.scrollY;
        const method = editVocabId ? 'PUT' : 'POST';
        const url = editVocabId ? `/vocabulaire/${editVocabId}` : `/vocabulaire`;
        await apiFetch(url, { method: method, body: formData });
        btn.innerHTML = `${svgSaveCheck} ${t('common.saved')}`;
        btn.className = 'btn-action done';
        await chargerVocabulaireApi(true);
        window.scrollTo({ top: scrollBefore, behavior: 'instant' });
        setTimeout(() => {
            fermerModalItem();
        }, 450);
    } catch (err) {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function trierVocabulaire(items, tri) {
    return items.sort((a, b) => {
        const titreA = a.titre || a.nom || ""; const titreB = b.titre || b.nom || "";
        const pratA = a.stats ? a.stats.nb_pratiques : (a.nb_pratiques || 0); const pratB = b.stats ? b.stats.nb_pratiques : (b.nb_pratiques || 0);
        if (tri === "nom_asc") return titreA.localeCompare(titreB); if (tri === "nom_desc") return titreB.localeCompare(titreA);
        if (tri === "prat_desc") return pratB - pratA; if (tri === "prat_asc") return pratA - pratB;
        return 0;
    });
}

async function loadLazyImages(containerId) {
    const container = document.getElementById(containerId); if (!container) return;
    const images = container.querySelectorAll('.lazy-image');
    for (const img of images) {
        const nomFichier = img.getAttribute('data-src'); if (!nomFichier) continue;
        try {
            const urlFichier = await getFichierUrl(nomFichier);
            if (urlFichier) {
                const isPdf = nomFichier.toLowerCase().endsWith('.pdf');
                if (isPdf) { img.outerHTML = `<div class="vocab-image-thumb" style="display:flex; align-items:center; justify-content:center; color: var(--accent-amber); background: rgba(var(--accent-amber-rgb), 0.10); border: 1px solid rgba(var(--accent-amber-rgb), 0.25);" onclick="ouvrirPdfLocal('${nomFichier}')" title="${t('library.open_pdf')}"><svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg></div>`; }
                else { img.src = urlFichier; }
            }
        } catch (e) { }
    }
}

function genererMediaHtml(item) {
    let fichiers = item.fichier_image;
    if (!fichiers || (Array.isArray(fichiers) && fichiers.length === 0)) {
        return `<div class="vocab-image-thumb" style="display:flex; align-items:center; justify-content:center; color: var(--text-muted);"><svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg></div>`;
    }

    // RÉTROCOMPATIBILITÉ
    if (!Array.isArray(fichiers)) fichiers = [fichiers];

    const safeTitre = (item.titre || item.nom || t('library.score_default')).replace(/'/g, "\\'");
    const isPdf = fichiers[0].toLowerCase().endsWith('.pdf');
    if (isPdf) {
        return `<div class="vocab-image-thumb" style="display:flex; align-items:center; justify-content:center; color: var(--accent-amber); background: rgba(var(--accent-amber-rgb), 0.10); border: 1px solid rgba(var(--accent-amber-rgb), 0.25); cursor:pointer;" onclick="ouvrirPdfLocal('${fichiers[0]}', '${safeTitre}', ${item.id})" title="${t('library.open_pdf_score')}"><svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg></div>`;
    } else {
        const srcsString = fichiers.join('|');
        const indicator = fichiers.length > 1 ? `<div style="position:absolute; bottom:2px; right:2px; background:rgba(0,0,0,0.8); color:white; font-size:9px; font-weight:bold; padding:2px 4px; border-radius:4px; line-height:1; pointer-events:none;">1/${fichiers.length}</div>` : '';

        return `<div style="position:relative; width:60px; height:60px; margin-right:16px; flex-shrink:0;">
                   <img data-srcs="${srcsString}" data-src="${fichiers[0]}" src="" class="vocab-image-thumb lazy-image" style="margin:0; width:100%; height:100%; cursor:pointer;" onclick="ouvrirModalImage(this.getAttribute('data-srcs'), '${safeTitre}', ${item.id})" title="${t('library.click_enlarge')}">
                   ${indicator}
                </div>`;
    }
}

async function chargerVocabulaireApi(preserveScroll = false) {
    try {
        const prevRendered = currentBiblioRendered;
        let vocab = await apiFetch(`/vocabulaire`);
        if (!Array.isArray(vocab)) vocab = [];
        vocabulaireCache = vocab;
        renderBibliotheque(preserveScroll ? Math.max(BIBLIO_CHUNK_SIZE, prevRendered) : BIBLIO_CHUNK_SIZE);
    } catch (e) { }
}

let currentBiblioItems = []; let currentBiblioRendered = 0; const BIBLIO_CHUNK_SIZE = 30; let biblioObserver = null;

function normaliserTexteRecherche(str) {
    return (str || "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function itemCorrespondRecherche(item, query) {
    if (!query) return true;
    const q = normaliserTexteRecherche(query).trim();
    if (!q) return true;
    if (normaliserTexteRecherche(item.titre).includes(q)) return true;
    if (item.attributs) {
        if (item.attributs.compositeur && normaliserTexteRecherche(item.attributs.compositeur).includes(q)) return true;
        if (item.attributs.style && normaliserTexteRecherche(item.attributs.style).includes(q)) return true;
        if (item.attributs.tonalite && normaliserTexteRecherche(item.attributs.tonalite).includes(q)) return true;
    }
    const scVisibles = Array.isArray(item.sous_categories)
        ? item.sous_categories.filter(sc => !estStyleIrealAFiltrer(sc))
        : (item.sous_categorie && !estStyleIrealAFiltrer(item.sous_categorie) ? [item.sous_categorie] : []);
    if (scVisibles.some(sc => normaliserTexteRecherche(sc).includes(q))) return true;
    return false;
}

function renderBibliotheque(initialChunkSize = BIBLIO_CHUNK_SIZE) {
    let items = currentFilterBiblio === "Toutes" ? [...vocabulaireCache] : vocabulaireCache.filter(i => i.type_item === currentFilterBiblio);
    if (showFavBiblio) items = items.filter(i => i.favori);
    if (searchQueryBiblio) items = items.filter(i => itemCorrespondRecherche(i, searchQueryBiblio));
    items = trierVocabulaire(items, currentSortBiblio);

    const container = document.getElementById('liste-vocabulaire'); container.innerHTML = "";
    if (items.length === 0) { container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">${t('library.empty')}</div>`; return; }

    currentBiblioItems = items; currentBiblioRendered = 0;
    if (biblioObserver) biblioObserver.disconnect();

    const sentinel = document.createElement('div'); sentinel.id = 'biblio-sentinel'; sentinel.style.height = '20px'; sentinel.style.width = '100%';
    renderBiblioChunk(initialChunkSize); container.appendChild(sentinel);

    biblioObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && currentBiblioRendered < currentBiblioItems.length) { renderBiblioChunk(); }
    }, { rootMargin: '300px' });
    biblioObserver.observe(sentinel);
}

function formaterAttributsItemUI(item) {
    if (typeof window !== 'undefined' && window.LibraryDomain && typeof window.LibraryDomain.formatItemAttributes === 'function') {
        return window.LibraryDomain.formatItemAttributes(item, {
            formatTonalite: typeof formatTonalite === 'function' ? formatTonalite : null,
            includeTempo: false
        });
    }
    return '';
}

function renderBiblioChunk(chunkSize = BIBLIO_CHUNK_SIZE) {
    const container = document.getElementById('liste-vocabulaire'); const sentinel = document.getElementById('biblio-sentinel');
    const fragment = document.createDocumentFragment();
    const itemsToRender = currentBiblioItems.slice(currentBiblioRendered, currentBiblioRendered + chunkSize);

    const svgDotsVertical = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><circle cx="12" cy="5" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="19" r="1.5" fill="currentColor"/></svg>`;

    itemsToRender.forEach(item => {
        const imageHtml = genererMediaHtml(item);
        const titreItem = item.titre || t('common.untitled');
        const attrsText = formaterAttributsItemUI(item);
        const nbPratiques = item.stats ? item.stats.nb_pratiques : (item.nb_pratiques || 0);
        let fullSubtitle = attrsText;
        if (nbPratiques > 0) {
            const pratiqueText = t('library.practiced_count', { count: nbPratiques });
            fullSubtitle = fullSubtitle ? `${fullSubtitle} · ${pratiqueText}` : pratiqueText;
        }
        const attrsHtml = fullSubtitle ? `<div class="vocab-attributs">${fullSubtitle}</div>` : '';

        let badgesHtml = "";
        const scNettoyees = (item.sous_categories && Array.isArray(item.sous_categories))
            ? item.sous_categories.filter(sc => !estStyleIrealAFiltrer(sc))
            : (item.sous_categorie && !estStyleIrealAFiltrer(item.sous_categorie) ? [item.sous_categorie] : []);
        if (scNettoyees.length > 0) {
            badgesHtml = scNettoyees.map(sc => `<span class="vocab-meta badge">${sc}</span>`).join(' ');
        }
        const favBtnClass = item.favori ? "btn-action btn-ghost-amber btn-square" : "btn-action btn-ghost-neutral btn-square";
        const favIcon = item.favori ? svgStarFilled : svgStarOutline;

        const isAudioPlayingItem = (typeof transcribeState !== 'undefined' && Number(transcribeState.currentItemId) === Number(item.id) && transcribeState.isPlaying);
        const audioBtnHtml = item.fichier_audio ? `<button class="btn-action ${isAudioPlayingItem ? 'btn-ghost-blue active' : 'btn-ghost-neutral'} btn-square btn-card-audio" data-item-id="${item.id}" onclick="ouvrirLecteurAudioItem(${item.id}, event)" title="${t('library.listen_audio_title')}">${isAudioPlayingItem ? svgPause : svgAudioPlay}</button>` : '';

        const card = document.createElement('div'); card.className = 'vocab-card';
        card.innerHTML = `
            ${imageHtml}
            <div class="vocab-details">
                <span class="vocab-title">${titreItem}</span>
                ${attrsHtml}
                <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 4px;">
                    <span class="vocab-meta badge" style="border-color: var(--accent-blue); color: var(--accent-blue);">${item.type_item}</span>${badgesHtml}
                </div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                ${audioBtnHtml}
                <button class="${favBtnClass}" onclick="toggleFavori(${item.id}, event)" title="${t('common.favorite')}">${favIcon}</button>
                <div class="dropdown" id="dd-item-menu-${item.id}">
                    <button type="button" class="btn-action btn-square btn-item-menu" onclick="toggleDropdown('dd-item-menu-${item.id}', event)" title="${t('common.options')}">${svgDotsVertical}</button>
                    <div class="dropdown-content item-menu-dropdown">
                        <button type="button" onclick="fermerTousLesDropdowns(); ouvrirModalItem(${item.id})">${svgPencil}<span>${t('common.edit')}</span></button>
                        <button type="button" class="item-menu-delete" onclick="fermerTousLesDropdowns(); supprimerVocabulaire(${item.id})">${svgTrash}<span>${t('common.delete')}</span></button>
                    </div>
                </div>
            </div>`;
        fragment.appendChild(card);
    });

    if (sentinel) { container.insertBefore(fragment, sentinel); } else { container.appendChild(fragment); }
    currentBiblioRendered += itemsToRender.length;
    setTimeout(() => loadLazyImages('liste-vocabulaire'), 50);
}

function remplirFormulaireEditionItem(item) {
    editVocabId = item.id;
    vocabulaireSupprimerAudioFlag = false;
    vocabulaireSupprimerScoreFlag = false;

    const nomInput = document.getElementById('input-vocab-nom');
    if (nomInput) nomInput.value = item.titre || '';

    const selectType = document.getElementById('input-vocab-type');
    const type = item.type_item || 'Morceaux';
    if (type && selectType && !Array.from(selectType.options).some(o => o.value === type)) {
        const opt = document.createElement('option');
        opt.value = type;
        opt.textContent = `${type} ${t('library.current_cat_suffix')}`;
        selectType.appendChild(opt);
    }
    if (selectType) selectType.value = type;

    const scList = Array.isArray(item.sous_categories)
        ? item.sous_categories.filter(sc => !estStyleIrealAFiltrer(sc))
        : (item.sous_categorie && !estStyleIrealAFiltrer(item.sous_categorie) ? [item.sous_categorie] : []);
    itemModalSelectedSousCats = new Set(scList);
    gererSousCategoriesForm(true);

    // Remplissage des 4 Attributs d'item
    const attr = item.attributs || {};
    const compInput = document.getElementById('input-vocab-compositeur');
    const styleInput = document.getElementById('input-vocab-style');
    const tonaInput = document.getElementById('input-vocab-tonalite');
    const tempoInput = document.getElementById('input-vocab-tempo');
    if (compInput) compInput.value = attr.compositeur || '';
    if (styleInput) styleInput.value = attr.style || '';
    if (tonaInput) tonaInput.value = attr.tonalite || '';
    if (tempoInput) tempoInput.value = (attr.tempo !== null && attr.tempo !== undefined) ? attr.tempo : '';

    // Affichage des informations sur les médias actuels
    const infoScore = document.getElementById('info-current-score');
    const infoAudio = document.getElementById('info-current-audio');

    if (infoScore) {
        if (item.fichier_image && (Array.isArray(item.fichier_image) ? item.fichier_image.length > 0 : true)) {
            const count = Array.isArray(item.fichier_image) ? item.fichier_image.length : 1;
            const rawName = Array.isArray(item.fichier_image) ? item.fichier_image[0] : item.fichier_image;
            const cleanName = typeof rawName === 'string' ? rawName.replace(/^(score_\d+_|pdf_\d+_)/, '') : t('common.file');
            const pageTxt = count > 1 ? t('library.score_pages_info', { count: count, name: cleanName }) : t('library.score_linked_info', { name: cleanName });
            infoScore.style.display = 'flex';
            infoScore.innerHTML = `
                <span id="label-current-score" style="font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${pageTxt}">
                    <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${pageTxt}</span>
                </span>
                <button type="button" class="btn-action btn-ghost-red btn-square" style="width: 26px; height: 26px; flex-shrink: 0;" onclick="marquerSuppressionScoreEdite()" title="${t('library.delete_score_title')}">
                    ${svgTrash}
                </button>`;
        } else {
            infoScore.style.display = 'none';
            infoScore.innerHTML = '';
        }
    }

    if (infoAudio) {
        if (item.fichier_audio) {
            const rawName = item.fichier_audio;
            const cleanName = typeof rawName === 'string' ? rawName.replace(/^audio_\d+_/, '') : t('common.file');
            const audioTxt = t('library.audio_linked_info', { name: cleanName });
            infoAudio.style.display = 'flex';
            infoAudio.innerHTML = `
                <span id="label-current-audio" style="font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${audioTxt}">
                    <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                    <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${audioTxt}</span>
                </span>
                <button type="button" class="btn-action btn-ghost-red btn-square" style="width: 26px; height: 26px; flex-shrink: 0;" onclick="marquerSuppressionAudioEdite()" title="${t('library.delete_audio_title')}">
                    ${svgTrash}
                </button>`;
        } else {
            infoAudio.style.display = 'none';
            infoAudio.innerHTML = '';
        }
    }

    const btn = document.getElementById('btn-submit-vocab');
    if (btn) {
        btn.innerHTML = `${svgSave} ${t('common.save')}`;
        btn.className = 'btn-action btn-ghost-green';
    }
}

function marquerSuppressionScoreEdite() {
    vocabulaireSupprimerScoreFlag = true;
    const infoScore = document.getElementById('info-current-score');
    if (infoScore) {
        infoScore.innerHTML = `<span style="color: var(--accent-red); font-size: 11px;">${t('library.deleted_on_save_score')}</span> <button type="button" class="btn-action btn-ghost-neutral" style="font-size: 10px; height: 22px; padding: 2px 6px;" onclick="annulerSuppressionScoreEdite()">${t('common.cancel')}</button>`;
    }
}

function annulerSuppressionScoreEdite() {
    vocabulaireSupprimerScoreFlag = false;
    const item = (typeof vocabulaireCache !== 'undefined' && Array.isArray(vocabulaireCache)) ? vocabulaireCache.find(i => Number(i.id) === Number(editVocabId)) : null;
    const infoScore = document.getElementById('info-current-score');
    if (infoScore && item && item.fichier_image) {
        const count = Array.isArray(item.fichier_image) ? item.fichier_image.length : 1;
        const rawName = Array.isArray(item.fichier_image) ? item.fichier_image[0] : item.fichier_image;
        const cleanName = typeof rawName === 'string' ? rawName.replace(/^(score_\d+_|pdf_\d+_)/, '') : t('common.file');
        const pageTxt = count > 1 ? t('library.score_pages_info', { count: count, name: cleanName }) : t('library.score_linked_info', { name: cleanName });
        infoScore.innerHTML = `
            <span id="label-current-score" style="font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${pageTxt}">
                <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${pageTxt}</span>
            </span>
            <button type="button" class="btn-action btn-ghost-red btn-square" style="width: 26px; height: 26px; flex-shrink: 0;" onclick="marquerSuppressionScoreEdite()" title="${t('library.delete_score_title')}">
                ${svgTrash}
            </button>`;
    }
}

function marquerSuppressionAudioEdite() {
    vocabulaireSupprimerAudioFlag = true;
    const infoAudio = document.getElementById('info-current-audio');
    if (infoAudio) {
        infoAudio.innerHTML = `<span style="color: var(--accent-red); font-size: 11px;">${t('library.deleted_on_save_audio')}</span> <button type="button" class="btn-action btn-ghost-neutral" style="font-size: 10px; height: 22px; padding: 2px 6px;" onclick="annulerSuppressionAudioEdite()">${t('common.cancel')}</button>`;
    }
}

function annulerSuppressionAudioEdite() {
    vocabulaireSupprimerAudioFlag = false;
    const item = (typeof vocabulaireCache !== 'undefined' && Array.isArray(vocabulaireCache)) ? vocabulaireCache.find(i => Number(i.id) === Number(editVocabId)) : null;
    const infoAudio = document.getElementById('info-current-audio');
    if (infoAudio && item && item.fichier_audio) {
        const rawName = item.fichier_audio;
        const cleanName = typeof rawName === 'string' ? rawName.replace(/^audio_\d+_/, '') : t('common.file');
        const audioTxt = t('library.audio_linked_info', { name: cleanName });
        infoAudio.innerHTML = `
            <span id="label-current-audio" style="font-size: 12px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${audioTxt}">
                <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; flex-shrink: 0; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${audioTxt}</span>
            </span>
            <button type="button" class="btn-action btn-ghost-red btn-square" style="width: 26px; height: 26px; flex-shrink: 0;" onclick="marquerSuppressionAudioEdite()" title="${t('library.delete_audio_title')}">
                ${svgTrash}
            </button>`;
    }
}

function annulerEdition(closeModal = false) {
    editVocabId = null;
    vocabulaireSupprimerScoreFlag = false;
    vocabulaireSupprimerAudioFlag = false;
    itemModalSelectedSousCats.clear();
    const formEl = document.getElementById('form-vocabulaire');
    if (formEl) formEl.reset();
    const lblScore = document.getElementById('label-input-vocab-image'); if (lblScore) lblScore.textContent = t('library.no_file_chosen');
    const lblAudio = document.getElementById('label-input-vocab-audio'); if (lblAudio) lblAudio.textContent = t('library.no_file_chosen');
    const infoScore = document.getElementById('info-current-score');
    if (infoScore) { infoScore.style.display = 'none'; infoScore.innerHTML = ''; }
    const infoAudio = document.getElementById('info-current-audio');
    if (infoAudio) { infoAudio.style.display = 'none'; infoAudio.innerHTML = ''; }
    gererSousCategoriesForm(false);
    const btn = document.getElementById('btn-submit-vocab');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; margin-right: 8px;"><path d="M5 12h14"/><path d="M12 5v14"/></svg> ${t('common.add')}`;
        btn.className = 'btn-action btn-ghost-green';
    }
    if (closeModal) {
        const modal = document.getElementById('modal-item');
        if (modal) modal.style.display = 'none';
    }
}

async function supprimerVocabulaire(id) {
    if (!confirm(t('library.confirm_delete_item'))) return;
    try {
        const scrollBefore = window.scrollY;
        await apiFetch(`/vocabulaire/${id}`, { method: 'DELETE' });
        await chargerVocabulaireApi(true);
        window.scrollTo({ top: scrollBefore, behavior: 'instant' });
    } catch (e) { }
}


// ==========================================
// --- GESTION DES ROUTINES               ---
// ==========================================
function ouvrirModalRoutines() { document.getElementById('modal-routines').style.display = 'flex'; chargerRoutinesApi(); }
function fermerModalRoutines() { document.getElementById('modal-routines').style.display = 'none'; }
function ouvrirModalSaveRoutine() {
    if (itemsBrouillon.length === 0) return; document.getElementById('input-routine-nom').value = '';
    document.getElementById('titre-modal-save-routine').textContent = t('routines.create_title'); document.getElementById('modal-save-routine').style.display = 'flex';
    setTimeout(() => { document.getElementById('input-routine-nom').focus(); }, 100);
}
function fermerModalSaveRoutine() { document.getElementById('modal-save-routine').style.display = 'none'; }

async function chargerRoutinesApi() {
    try { let routines = await apiFetch(`/routines`); if (!Array.isArray(routines)) routines = []; routinesCache = routines; renderRoutines(); } catch (e) { }
}

function renderRoutines() {
    const container = document.getElementById('liste-routines-container'); container.innerHTML = "";
    if (routinesCache.length === 0) { container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">${t('routines.empty')}</div>`; return; }

    routinesCache.forEach(routine => {
        let tempsTotal = 0; let categories = new Set();
        routine.items.forEach(item => { tempsTotal += Number(item.temps_prevu); categories.add(item.categorie); });
        const h = Math.floor(tempsTotal / 60); const m = (tempsTotal % 60).toString().padStart(2, '0'); const tempsFormate = `${h}h${m}`;
        let badgesHtml = Array.from(categories).map(cat => `<span class="badge badge-blue" style="margin-right: 4px; margin-bottom: 4px; display: inline-block;">${cat}</span>`).join('');

        container.innerHTML += `
            <div class="routine-item" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; cursor: pointer;" onclick="chargerRoutineDansBrouillon(${routine.id})">
                <div style="flex: 1; min-width: 200px;">
                    <span style="font-weight: 600; color: var(--text-primary); font-size: 15px; display: block; margin-bottom: 4px;">${routine.nom}</span>
                    <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
                        <span class="badge-temps" style="background: transparent; border: 1px solid var(--border-color); color: var(--text-muted); padding: 2px 8px; font-size: 12px; min-width: 54px; margin:0;">${tempsFormate}</span>
                        <div>${badgesHtml}</div>
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-action btn-ghost-red btn-square" onclick="event.stopPropagation(); supprimerRoutine(${routine.id})" title="${t('common.delete')}">${svgTrash}</button>
                </div>
            </div>`;
    });
}

function chargerRoutineDansBrouillon(id) {
    const routine = routinesCache.find(r => r.id === id); if (!routine) return;
    routine.items.forEach(item => { itemsBrouillon.push({ ...item, fait: false, ordre: itemsBrouillon.length }); });
    afficherBrouillon(); fermerModalRoutines();
}

async function sauvegarderRoutineEnBase() {
    const nomInput = document.getElementById('input-routine-nom').value.trim(); if (!nomInput || itemsBrouillon.length === 0) return;
    const btn = document.getElementById('btn-valider-routine'); const originalText = btn.innerHTML; btn.innerHTML = t('common.saving'); btn.disabled = true;
    try {
        await apiFetch(`/routines`, { method: 'POST', body: JSON.stringify({ nom: nomInput, items: itemsBrouillon }) });
        btn.innerHTML = `${svgSaveCheck} ${t('common.saved')}`; btn.className = 'btn-action done';
        setTimeout(() => { fermerModalSaveRoutine(); btn.innerHTML = originalText; btn.className = 'btn-action btn-ghost-green'; btn.disabled = false; }, 1000);
    } catch (e) { btn.innerHTML = originalText; btn.disabled = false; }
}

async function supprimerRoutine(id) { if (!confirm(t('routines.confirm_delete'))) return; try { await apiFetch(`/routines/${id}`, { method: 'DELETE' }); chargerRoutinesApi(); } catch (e) { } }


// ==========================================
// --- MOTEUR IREAL PRO & SHARE TARGET    ---
function initShareTarget() {
    let dernierPartageRecu = { content: "", time: 0 };
    window.receptionnerPartageIReal = async function (data) {
        if (!data) return;
        const htmlContent = data.content || "";
        if (!htmlContent.includes('irealb://') && !htmlContent.includes('<html') && !htmlContent.includes('irealbook://')) return;

        // Évite les doublons si l'intent est reçu deux fois successivement (à froid et via evaluateJavascript)
        const now = Date.now();
        if (dernierPartageRecu.content === htmlContent && (now - dernierPartageRecu.time < 3000)) {
            return;
        }
        dernierPartageRecu = { content: htmlContent, time: now };

        let defaultName = (data.subject || t('ireal.default_setlist_name')).trim();
        defaultName = defaultName.replace(/\.(html|htm|txt)$/i, '').trim();

        // Tenter d'extraire le titre de la playlist depuis le HTML (balises <title>, <h2>, etc.)
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            const titleEl = doc.querySelector('title, h1, h2');
            if (titleEl && titleEl.innerText.trim()) {
                const titleTxt = titleEl.innerText.trim().replace(/^iReal Pro\s*[-:]\s*/i, '').trim();
                if (titleTxt && titleTxt.toLowerCase() !== 'ireal pro') defaultName = titleTxt;
            }
        } catch (_) { }

        // Basculer automatiquement sur la vue Bibliothèque pour que l'utilisateur voie l'import
        if (typeof afficherVue === 'function') {
            try { afficherVue('bibliotheque'); } catch (_) { }
        }

        // Exécuter l'import iReal Pro
        await executerImportIRealPro(htmlContent, defaultName);
    };

    // 2. Vérification immédiate du partage en attente (cas de lancement à froid depuis iReal Pro)
    if (typeof window !== 'undefined' && window.NativeShareBridge && typeof window.NativeShareBridge.getPendingShare === 'function') {
        try {
            const raw = window.NativeShareBridge.getPendingShare();
            if (raw && raw.trim().length > 0) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed.content) {
                    setTimeout(() => {
                        window.receptionnerPartageIReal(parsed);
                    }, 600); // Laisse l'UI et la DB s'initialiser au démarrage
                }
            }
        } catch (e) {
            console.error("Erreur lecture NativeShareBridge :", e);
        }
    }
}

async function importerBackupIRealPro(event) {
    const file = event.target.files[0]; if (!file) return;
    let defaultName = file.name.replace(/\.[^/.]+$/, "");
    const reader = new FileReader();
    reader.onload = async (e) => { await executerImportIRealPro(e.target.result, defaultName); document.getElementById('input-ireal-file').value = ""; };
    reader.readAsText(file);
}

async function executerImportIRealPro(htmlContent, defaultName) {
    const decoded = LibraryDomain.parseIRealLink(htmlContent);
    if (decoded.tunes.length === 0 && !/ireal(?:b|book|pro)?:\/\//i.test(htmlContent)) { alert(t('ireal.no_tunes_found')); return; }

    const nomPlaylistDetecte = decoded.playlistName || defaultName || t('ireal.default_setlist_name');

    const irealQueue = decoded.tunes.map(tune => ({
        isIReal: true,
        baseName: tune.titre,
        titre: tune.titre,
        compositeur: tune.compositeur || '',
        style: tune.style || '',
        key: tune.tonalite || '',
        singleUrl: tune.grille,
        ext: 'ireal',
        entries: []
    }));

    if (irealQueue.length === 0) {
        alert(t('ireal.no_valid_tunes'));
        return;
    }

    if (typeof afficherVue === 'function') afficherVue('bibliotheque');
    ouvrirPreparationTrieur(irealQueue, {
        isIReal: true,
        defaultPlaylistName: nomPlaylistDetecte
    });
}

async function reinitialiserBibliotheque() {
    if (confirm(t('library.confirm_reset_all'))) {
        try { await apiFetch(`/vocabulaire/reset`, { method: 'DELETE' }); vocabulaireCache = []; renderBibliotheque(); } catch (e) { }
    }
}

// ==========================================
// --- GESTIONNAIRE DE PLAYLISTS          ---
// ==========================================
let playlistSelectedIds = new Set(); let playlistEnEdition = null;

function ouvrirGestionnairePlaylists() {
    document.getElementById('modal-playlist').style.display = 'flex';
    document.getElementById('vue-playlist-liste').style.display = 'block'; document.getElementById('vue-playlist-editeur').style.display = 'none';
    document.getElementById('titre-modal-playlist').textContent = t('setlists.title');

    const container = document.getElementById('liste-des-playlists-existantes'); container.innerHTML = "";
    const playlists = getSousCategoriesPour('Morceaux');
    if (playlists.length === 0) { container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 13px; padding: 12px;">${t('setlists.empty')}</div>`; }
    else {
        let html = "";
        playlists.forEach(pl => {
            const safePl = pl.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            html += `<div style="display: flex; justify-content: space-between; align-items: center; background: var(--input-bg); border: 1px solid var(--border-color); padding: 12px; border-radius: 6px; margin-bottom: 8px;">
                    <span style="font-weight: 500; color: var(--text-primary);">${pl}</span>
                    <div style="display: flex; gap: 8px; align-items: center;">
                        <button class="btn-action btn-ghost-neutral" onclick="fermerModalPlaylist(); lancerModeConcertDirect('${safePl}')" title="${t('setlists.launch_live_title')}" style="font-size: 12px; height: 32px; padding: 0 10px; display: inline-flex; align-items: center; gap: 5px;">
                            <svg viewBox="0 0 24 24" style="width: 13px; height: 13px; fill: currentColor;"><polygon points="5 3 19 12 5 21 5 3"/></svg> ${t('setlists.live_btn')}
                        </button>
                        <button class="btn-action btn-ghost-neutral btn-square" onclick="ouvrirEditeurPlaylist('${safePl}')" title="${t('common.edit')}">${svgPencil}</button>
                        <button class="btn-action btn-ghost-red btn-square" onclick="supprimerPlaylist('${safePl}')" title="${t('common.delete')}">${svgTrash}</button>
                    </div>
                </div>`;
        });
        container.innerHTML = html;
    }
}

function fermerModalPlaylist() { document.getElementById('modal-playlist').style.display = 'none'; }
function retourListePlaylists() { document.getElementById('vue-playlist-liste').style.display = 'block'; document.getElementById('vue-playlist-editeur').style.display = 'none'; document.getElementById('titre-modal-playlist').textContent = t('setlists.title'); }

function ouvrirEditeurPlaylist(nomPlaylist) {
    playlistEnEdition = nomPlaylist; document.getElementById('vue-playlist-liste').style.display = 'none'; document.getElementById('vue-playlist-editeur').style.display = 'flex';
    const inputNom = document.getElementById('input-playlist-nom'); const inputRecherche = document.getElementById('search-playlist-items'); inputRecherche.value = '';

    if (nomPlaylist) {
        document.getElementById('titre-modal-playlist').textContent = t('setlists.edit_prefix', { name: nomPlaylist }); inputNom.value = nomPlaylist;
        playlistSelectedIds = new Set(vocabulaireCache.filter(i => (typeof estCategorieMorceaux === 'function' ? estCategorieMorceaux(i.type_item) : i.type_item === 'Morceaux') && Array.isArray(i.sous_categories) && i.sous_categories.includes(nomPlaylist)).map(i => i.id));
    } else { document.getElementById('titre-modal-playlist').textContent = t('setlists.new_title'); inputNom.value = ''; playlistSelectedIds.clear(); }
    renderPlaylistItems('');
}

window.togglePlaylistItem = function (id, isChecked) {
    if (isChecked) playlistSelectedIds.add(id); else playlistSelectedIds.delete(id);
    if (document.getElementById('search-playlist-items').value.trim() === '') renderPlaylistItems('');
};

function filtrerPlaylistItems(val) { renderPlaylistItems(val.trim()); }

function renderPlaylistItems(query) {
    const container = document.getElementById('liste-playlist-items'); let morceauxAafficher = [];
    const isMorceau = (i) => (typeof estCategorieMorceaux === 'function' ? estCategorieMorceaux(i.type_item) : i.type_item === 'Morceaux');
    if (query === '') { morceauxAafficher = vocabulaireCache.filter(i => isMorceau(i) && playlistSelectedIds.has(i.id)); }
    else { const q = query.toLowerCase(); morceauxAafficher = vocabulaireCache.filter(i => isMorceau(i) && (i.titre || "").toLowerCase().includes(q)).slice(0, 50); }
    morceauxAafficher.sort((a, b) => (a.titre || "").localeCompare(b.titre || ""));

    if (morceauxAafficher.length === 0) {
        container.innerHTML = query === '' ? `<div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 13px;">${t('setlists.search_prompt_empty')}</div>` : `<div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 13px;">${t('setlists.no_tune_found')}</div>`;
        return;
    }
    let html = "";
    morceauxAafficher.forEach(m => {
        const safeTitre = (m.titre || t('common.untitled')).replace(/"/g, '&quot;'); const isChecked = playlistSelectedIds.has(m.id);
        html += `<label class="playlist-checkbox-item"><input type="checkbox" value="${m.id}" class="playlist-checkbox" onchange="togglePlaylistItem(${m.id}, this.checked)" ${isChecked ? 'checked' : ''}><span class="playlist-checkbox-label">${safeTitre}</span></label>`;
    });
    container.innerHTML = html;
}

async function sauvegarderPlaylist() {
    const nouveauNom = document.getElementById('input-playlist-nom').value.trim();
    if (!nouveauNom) return alert(t('setlists.alert_enter_name'));
    if (playlistSelectedIds.size === 0) return alert(t('setlists.alert_select_tune'));
    const btn = document.getElementById('btn-save-playlist'); const originalText = btn.innerHTML; btn.innerHTML = t('common.saving'); btn.disabled = true;

    try {
        let promises = [];
        const isMorceau = (i) => (typeof estCategorieMorceaux === 'function' ? estCategorieMorceaux(i.type_item) : i.type_item === 'Morceaux');
        for (const item of vocabulaireCache.filter(i => isMorceau(i))) {
            let needsUpdate = false; let sc = Array.isArray(item.sous_categories) ? [...item.sous_categories] : (item.sous_categorie ? [item.sous_categorie] : []);
            if (playlistEnEdition && sc.includes(playlistEnEdition)) { sc = sc.filter(s => s !== playlistEnEdition); needsUpdate = true; }
            if (playlistSelectedIds.has(item.id)) { if (!sc.includes(nouveauNom)) { sc.push(nouveauNom); needsUpdate = true; } }
            if (needsUpdate) { item.sous_categories = sc; promises.push(apiFetch(`/vocabulaire/${item.id}`, { method: 'PUT', body: JSON.stringify(item) })); }
        }
        await Promise.all(promises); await chargerVocabulaireApi(); gererSousCategoriesForm();
        btn.innerHTML = `${svgSaveCheck} ${t('setlists.saved_done')}`; btn.className = 'btn-action done';
        setTimeout(() => { btn.innerHTML = originalText; btn.className = 'btn-action btn-ghost-green'; btn.disabled = false; retourListePlaylists(); ouvrirGestionnairePlaylists(); }, 1000);
    } catch (e) { btn.innerHTML = originalText; btn.disabled = false; }
}

async function supprimerPlaylist(nomPlaylist) {
    if (!confirm(t('setlists.confirm_delete', { name: nomPlaylist }))) return;
    try {
        let promises = [];
        const isMorceau = (i) => (typeof estCategorieMorceaux === 'function' ? estCategorieMorceaux(i.type_item) : i.type_item === 'Morceaux');
        for (const item of vocabulaireCache.filter(i => isMorceau(i) && Array.isArray(i.sous_categories) && i.sous_categories.includes(nomPlaylist))) {
            item.sous_categories = item.sous_categories.filter(s => s !== nomPlaylist);
            promises.push(apiFetch(`/vocabulaire/${item.id}`, { method: 'PUT', body: JSON.stringify(item) }));
        }
        await Promise.all(promises); await chargerVocabulaireApi(); gererSousCategoriesForm(); ouvrirGestionnairePlaylists();
    } catch (e) { }
}


// ==========================================
// --- MOTEUR SMART SHUFFLE ET IMMERSIF   ---
// ==========================================
let currentShuffleQueue = []; let currentShuffleIndex = 0; let isPupitreActive = false; let pupitreMode = 'liste';
let currentImmersiveCat = null; let currentImmersiveScArray = []; let immersiveSearchQuery = "";

async function setPupitreMode(mode) {
    pupitreMode = mode;
    if (mode === 'shuffle') { currentShuffleQueue = await genererSmartShuffle(currentImmersiveCat, currentImmersiveScArray, 10); }
    else { currentShuffleQueue = await genererSmartShuffle(currentImmersiveCat, currentImmersiveScArray, 9999); }
    currentShuffleIndex = 0; renderShuffleCard();
}

async function lancerImmersif(item) {
    currentImmersiveCat = item.categorie; currentImmersiveScArray = Array.isArray(item.sous_categories) ? item.sous_categories : (item.sous_categorie ? [item.sous_categorie] : []);
    currentShuffleQueue = await genererSmartShuffle(currentImmersiveCat, currentImmersiveScArray);
    currentShuffleIndex = 0; toggleModePupitre(true);
}

async function genererSmartShuffle(categorie, sousCategoriesArray) {
    const toutVocab = await lireLocal('vocabulaire');
    if (typeof window !== 'undefined' && window.LibraryDomain && typeof window.LibraryDomain.drawImmersiveQueue === 'function') {
        return window.LibraryDomain.drawImmersiveQueue(toutVocab, {
            categorie: categorie,
            sousCategories: sousCategoriesArray
        });
    }
    return [];
}

let immersiveClockInterval = null;

function toggleModePupitre(actif) {
    isPupitreActive = actif;
    const container = document.getElementById('shuffle-container');

    if (actif) {
        document.body.classList.add('mode-pupitre');
        immersiveSearchQuery = '';
        activerWakeLock();

        if (immersiveClockInterval) clearInterval(immersiveClockInterval);
        immersiveClockInterval = setInterval(rafraichirHorlogeImmersive, 1000);

        if (container) {
            container.style.display = 'block';
            container.innerHTML = `
                <div style="position: relative; display: flex; justify-content: flex-end; align-items: center; margin-bottom: 24px; min-height: 36px;">
                    <div style="position: absolute; left: 0; right: 0; display: flex; justify-content: center; pointer-events: none;">
                        <span id="immersive-discreet-clock" class="immersive-discreet-clock" aria-label="Heure courante">--:--</span>
                    </div>
                    <div style="display: flex; gap: 8px; align-items: center; z-index: 2;">
                        <button id="btn-pupitre-dictaphone" class="btn-action btn-ghost-neutral btn-square" onclick="ouvrirDictaphoneDepuisImmersif()" title="${t('dictaphone.rec_idle_btn')}" style="border: 1px solid var(--border-color);">
                            <svg viewBox="0 0 24 24" style="width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>
                        </button>
                        <button id="btn-pupitre-audio" class="btn-action btn-ghost-neutral btn-square" onclick="ouvrirAudioMorceauActuelImmersif()" title="${t('audio.title')}" style="border: 1px solid var(--border-color); display: none;">
                            <svg viewBox="0 0 24 24" style="width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                        </button>
                        <button id="btn-pupitre-metronome" class="btn-action btn-ghost-neutral btn-square ${metronome.isPlaying ? 'playing' : ''}" onclick="ouvrirModalMetronome()" title="${metronome.isPlaying ? t('metronome.active_title', { bpm: metronome.tempo }) : t('metronome.title')}" style="border: 1px solid var(--border-color);">
                            <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;">
                                <path d="M12 11.4V9.1"/>
                                <path d="m12 17 6.59-6.59"/>
                                <path d="m15.05 5.7-.218-.691a3 3 0 0 0-5.663 0L4.418 19.695A1 1 0 0 0 5.37 21h13.253a1 1 0 0 0 .951-1.31L18.45 16.2"/>
                                <circle cx="20" cy="9" r="2"/>
                            </svg>
                        </button>
                        <button class="btn-action btn-ghost-neutral btn-square" onclick="toggleModePupitre(false)" title="${t('immersive.exit_title')}" style="border: 1px solid var(--border-color);">
                            <svg viewBox="0 0 24 24" style="width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7"/></svg>
                        </button>
                    </div>
                </div>
                <div id="immersif-infos" style="text-align: center; margin-bottom: 32px;"></div>
                <div id="immersif-timer"></div>
                
                <div style="position: relative; margin-bottom: 24px; display: block; width: 100%;">
                    <svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: var(--text-muted); stroke-width: 2; position: absolute; left: 14px; top: 50%; transform: translateY(-50%); pointer-events: none;">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input type="text" id="search-immersif" placeholder="${t('immersive.search_placeholder')}" 
                        oninput="filtrerImmersif(this.value)" 
                        style="padding-left: 42px; height: 44px; width: 100%; box-sizing: border-box; border-radius: 22px; font-size: 16px; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-color); color: var(--text-primary); outline: none;">
                </div>
                
                <div id="immersif-list" style="text-align: left;"></div>
            `;
            renderShuffleCard();
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
        document.body.classList.remove('mode-pupitre');
        if (immersiveClockInterval) {
            clearInterval(immersiveClockInterval);
            immersiveClockInterval = null;
        }
        if (typeof fermerModalMetronome === 'function') fermerModalMetronome();
        if (typeof arreterMetronome === 'function' && metronome.isPlaying) arreterMetronome();
        if (container) { container.innerHTML = ""; container.style.display = 'none'; }
        if (activeTimer.index !== null) { majAffichageChrono(activeTimer.index, activeTimer.remainingSecsAtPause); }
        if (activeTimer.index === null || activeTimer.isPaused) { desactiverWakeLock(); }
    }
}

function filtrerImmersif(val) { immersiveSearchQuery = val.trim().toLowerCase(); renderShuffleCard(); }

function calculerETA(secondesRestantes) {
    if (typeof window !== 'undefined' && window.SessionTimer && typeof window.SessionTimer.calculateETA === 'function') {
        return window.SessionTimer.calculateETA(secondesRestantes);
    }
    const targetDate = new Date();
    targetDate.setSeconds(targetDate.getSeconds() + Math.max(0, Math.round(secondesRestantes || 0)));
    const hours = targetDate.getHours().toString().padStart(2, '0');
    const minutes = targetDate.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

async function terminerExerciceActuel() {
    if (activeTimer.index === null) return;
    resetDerniereInteraction();
    annulerNotificationTimer();
    desactiverWakeLock();

    const currentExo = seanceEnCours.items[activeTimer.index];
    currentExo.fait = true;
    currentExo.isOvertime = activeTimer.isOvertime;
    currentExo.temps_restant = activeTimer.remainingSecsAtPause;
    const prevuSecs = Number(currentExo.temps_prevu || 0) * 60;
    currentExo.duree_reelle_secondes = activeTimer.isOvertime
        ? (prevuSecs + activeTimer.remainingSecsAtPause)
        : Math.max(0, prevuSecs - activeTimer.remainingSecsAtPause);

    toggleModePupitre(false);

    const cardEl = document.getElementById(`card-${activeTimer.index}`);
    if (cardEl) cardEl.classList.add('done');
    const checkEl = document.getElementById(`check-exo-${activeTimer.index}`);
    if (checkEl) checkEl.classList.add('checked');
    const timerDisplay = document.getElementById(`timer-display-${activeTimer.index}`);
    if (timerDisplay) { timerDisplay.className = 'badge-temps'; timerDisplay.innerHTML = t('immersive.done_badge'); }

    try { await apiFetch(`/seances/${seanceEnCours.id}`, { method: 'PUT', body: JSON.stringify(seanceEnCours) }); } catch (e) { }
    verifierFinSeance();

    if (activeTimer.interval) clearInterval(activeTimer.interval);
    activeTimer.isPaused = true;
    const btnPause = document.getElementById('btn-pause-global');
    if (btnPause) { btnPause.innerHTML = svgPlaySquare; btnPause.className = 'btn-action btn-ghost-neutral btn-square'; btnPause.disabled = true; }
    pauseGlobalTimer();
    sauvegarderEtatSeance();
    majAffichageDureeLive();

    const toutFini = seanceEnCours.items.every(item => item.fait);
    if (toutFini) {
        demanderFinSeance();
        const finContainer = document.getElementById('fin-seance-container');
        if (finContainer) {
            finContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
}

async function validerShuffleItem(id, index, event, btnElement) {
    if (event) event.stopPropagation();
    const btn = btnElement || (event ? (event.currentTarget || event.target) : null);
    try {
        const isPracticed = licksPratiquesSession.has(id);
        const nextDelta = isPracticed ? -1 : 1;

        if (isPracticed) {
            licksPratiquesSession.delete(id);
            await apiFetch(`/vocabulaire/${id}/depratiquer`, { method: 'PUT' });
        } else {
            licksPratiquesSession.add(id);
            await apiFetch(`/vocabulaire/${id}/pratiquer`, { method: 'PUT' });
        }

        // 1. Mettre à jour dans vocabulaireCache
        const indexCache = vocabulaireCache.findIndex(i => i.id === id);
        if (indexCache !== -1) {
            vocabulaireCache[indexCache].stats = vocabulaireCache[indexCache].stats || { nb_pratiques: 0 };
            vocabulaireCache[indexCache].stats.nb_pratiques = Math.max(0, (vocabulaireCache[indexCache].stats.nb_pratiques || 0) + nextDelta);
            vocabulaireCache[indexCache].nb_pratiques = vocabulaireCache[indexCache].stats.nb_pratiques;
        }

        // 2. Mettre à jour dans currentShuffleQueue
        let newCount = 0;
        currentShuffleQueue.forEach(item => {
            if (item.id === id) {
                item.stats = item.stats || { nb_pratiques: 0 };
                item.stats.nb_pratiques = Math.max(0, (item.stats.nb_pratiques || 0) + nextDelta);
                item.nb_pratiques = item.stats.nb_pratiques;
                newCount = item.stats.nb_pratiques;
            }
        });

        // 3. Mettre à jour dans seanceEnCours.items s'il y est
        if (seanceEnCours && Array.isArray(seanceEnCours.items)) {
            seanceEnCours.items.forEach(exo => {
                if (exo.id === id) {
                    exo.stats = exo.stats || { nb_pratiques: 0 };
                    exo.stats.nb_pratiques = Math.max(0, (exo.stats.nb_pratiques || 0) + nextDelta);
                    exo.nb_pratiques = exo.stats.nb_pratiques;
                }
            });
        }

        // 4. Mise à jour immédiate du texte dans le DOM
        const span = document.getElementById(`count-vocab-${id}`);
        if (span) {
            span.textContent = t('library.practiced_count', { count: newCount });
        }

        // 5. Mise à jour visuelle du bouton et de la carte
        const cardEl = document.getElementById(`vocab-card-${id}`);
        if (cardEl) {
            if (isPracticed) {
                cardEl.classList.remove('practiced');
            } else {
                cardEl.classList.add('practiced');
            }
        }
        if (btn) {
            if (isPracticed) {
                btn.className = "btn-action btn-ghost-green btn-square";
                btn.title = t('immersive.mark_practiced');
            } else {
                btn.className = "btn-action btn-practiced btn-square";
                btn.title = t('immersive.already_practiced');
            }
        }

        // 6. Si on vient de cocher et qu'on était sur cette carte, avancer vers la carte suivante
        if (!isPracticed && currentShuffleIndex === index && currentShuffleIndex < currentShuffleQueue.length - 1) {
            currentShuffleIndex++;
            renderShuffleCard();
        }
    } catch (e) {
        console.warn("Erreur validation item immersif :", e);
    }
}

async function toggleFavoriImmersif(id, event) {
    if (event) event.stopPropagation();
    await toggleFavori(id);
}

function rafraichirHorlogeImmersive() {
    const clockEl = document.getElementById('immersive-discreet-clock');
    if (clockEl) {
        const timeStr = (typeof window !== 'undefined' && window.SessionTimer && typeof window.SessionTimer.formatClock24h === 'function')
            ? window.SessionTimer.formatClock24h()
            : (new Date().getHours().toString().padStart(2, '0') + ':' + new Date().getMinutes().toString().padStart(2, '0'));
        clockEl.innerHTML = (typeof window !== 'undefined' && window.SessionTimer && typeof window.SessionTimer.formatClockHtml === 'function')
            ? window.SessionTimer.formatClockHtml(timeStr)
            : timeStr;
    }
}

function majAffichageChrono(index, secondesAffichees) {
    const display = document.getElementById(`timer-display-${index}`); const tFormate = formaterTemps(secondesAffichees);
    if (display) {
        if (activeTimer.isOvertime) { display.className = 'badge-temps overtime'; display.innerHTML = activeTimer.isPaused ? t('immersive.paused_overtime', { time: tFormate }) : `+ ${tFormate}`; }
        else if (activeTimer.isPaused) { display.className = 'badge-temps paused'; display.innerHTML = t('immersive.paused_time', { time: tFormate }); }
        else { display.className = 'badge-temps running'; display.innerHTML = `${tFormate}`; }
    }
    if (isPupitreActive && activeTimer.index === index) {
        const timeText = document.getElementById('android-timer-time'); const circle = document.getElementById('android-timer-circle');
        const etaText = document.getElementById('android-timer-eta-text'); const btnPause = document.getElementById('btn-immersif-pause');
        rafraichirHorlogeImmersive();
        if (timeText) {
            const timeRaw = activeTimer.isOvertime ? `+ ${tFormate}` : tFormate;
            timeText.innerHTML = (typeof window !== 'undefined' && window.SessionTimer && typeof window.SessionTimer.formatTimeHtml === 'function')
                ? window.SessionTimer.formatTimeHtml(timeRaw)
                : timeRaw;
        }
        if (etaText) etaText.textContent = activeTimer.isOvertime ? "--:--" : calculerETA(secondesAffichees);
        if (circle) {
            circle.className = 'android-timer-circle';
            if (activeTimer.isOvertime) circle.classList.add('overtime'); else if (activeTimer.isPaused) circle.classList.add('paused'); else circle.classList.add('running');
        }
        if (btnPause) {
            if (activeTimer.isPaused) {
                btnPause.className = 'btn-action btn-immersif-ctrl btn-immersif-resume';
                btnPause.innerHTML = `${svgPlay}<span>${t('immersive.resume')}</span>`;
            } else {
                btnPause.className = 'btn-action btn-immersif-ctrl btn-immersif-pause';
                btnPause.innerHTML = `${svgPause}<span>${t('immersive.pause')}</span>`;
            }
        }
    }
}

function renderShuffleCard() {
    const listContainer = document.getElementById('immersif-list'); const infosContainer = document.getElementById('immersif-infos'); const timerContainer = document.getElementById('immersif-timer');
    if (!listContainer || !infosContainer || !timerContainer) return;

    let currentExo = activeTimer.index !== null ? seanceEnCours.items[activeTimer.index] : null;
    let badgesHtml = ""; let texteAffiche = "";

    if (currentExo) {
        const sc = (Array.isArray(currentExo.sous_categories) ? currentExo.sous_categories : (currentExo.sous_categorie ? [currentExo.sous_categorie] : [])).filter(s => !estStyleIrealAFiltrer(s));
        badgesHtml = sc.map(s => {
            const labelS = (typeof estLabelFavoris === 'function' && estLabelFavoris(s)) ? t('common.favorites') : s;
            return `<span class="badge badge-neutral">${labelS}</span>`;
        }).join(' ');
        badgesHtml = `<span class="badge badge-blue">${currentExo.categorie}</span> ` + badgesHtml;
        let scString = sc.join(', '); texteAffiche = currentExo.contenu || "";
        if (texteAffiche === scString) texteAffiche = ""; else if (scString && texteAffiche.startsWith(scString + " - ")) texteAffiche = texteAffiche.replace(scString + " - ", "");
    }

    infosContainer.innerHTML = `<div style="display: flex; gap: 6px; align-items: center; justify-content: center; flex-wrap: wrap;">${badgesHtml}</div>${texteAffiche ? `<div style="font-size: 16px; color: var(--text-primary); margin-top: 16px; font-weight: 500;">${texteAffiche}</div>` : ''}`;

    rafraichirHorlogeImmersive();

    let isCurrentlyPaused = activeTimer.index !== null && activeTimer.isPaused;
    let timerClass = '';
    let pauseClass = isCurrentlyPaused ? 'btn-immersif-resume' : 'btn-immersif-pause';
    let pauseIcon = isCurrentlyPaused ? svgPlay : svgPause;
    let pauseText = isCurrentlyPaused ? t('immersive.resume') : t('immersive.pause');
    let timeStr = "00:00"; let etaStr = "--:--";
    let originalMins = currentExo ? currentExo.temps_prevu : 0;

    if (activeTimer.index !== null) {
        timeStr = formaterTemps(activeTimer.remainingSecsAtPause); etaStr = activeTimer.isOvertime ? "--:--" : calculerETA(activeTimer.remainingSecsAtPause);
        if (activeTimer.isOvertime) { timerClass = 'overtime'; } else if (activeTimer.isPaused) { timerClass = 'paused'; } else { timerClass = 'running'; }
    }

    const timeRaw = (activeTimer.index !== null && activeTimer.isOvertime) ? `+ ${timeStr}` : timeStr;
    const timeDisplayHtml = (typeof window !== 'undefined' && window.SessionTimer && typeof window.SessionTimer.formatTimeHtml === 'function')
        ? window.SessionTimer.formatTimeHtml(timeRaw)
        : timeRaw;

    timerContainer.innerHTML = `
        <div id="android-timer-circle" class="android-timer-circle ${timerClass}">
            <div class="android-timer-total">${originalMins} min</div>
            <div id="android-timer-time" class="android-timer-time">${timeDisplayHtml}</div>
            <div class="android-timer-eta">
                <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: currentColor; margin-right: 4px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                <span id="android-timer-eta-text">${etaStr}</span>
            </div>
        </div>
        <div style="display: flex; justify-content: center; gap: 16px; margin-bottom: 40px;">
            <button id="btn-immersif-pause" class="btn-action btn-immersif-ctrl ${pauseClass}" onclick="togglePause()">${pauseIcon}<span>${pauseText}</span></button>
            <button id="btn-immersif-finish" class="btn-action btn-immersif-ctrl btn-immersif-finish" onclick="terminerExerciceActuel()">${svgTickNoMargin}<span>${t('immersive.finish')}</span></button>
        </div>`;

    let itemsFiltres = currentShuffleQueue;
    if (immersiveSearchQuery) { itemsFiltres = itemsFiltres.filter(i => itemCorrespondRecherche(i, immersiveSearchQuery)); }

    if (itemsFiltres.length === 0) {
        if (currentShuffleQueue.length === 0) { listContainer.innerHTML = `<div class="shuffle-card" style="border-color: transparent; background: transparent; box-shadow: none;"><div style="font-size: 22px; color: var(--text-primary); font-weight: 500;">${t('immersive.free_exercise')}</div></div>`; }
        else { listContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">${t('immersive.no_matching_item')}</div>`; }
        return;
    }

    let listHtml = "";
    itemsFiltres.forEach((item) => {
        const idx = currentShuffleQueue.findIndex(i => i.id === item.id);
        const imageHtml = genererMediaHtml(item); const isPracticed = licksPratiquesSession.has(item.id);
        const isSelected = (idx === currentShuffleIndex);
        const cardClasses = `vocab-card ${isSelected ? 'selected' : ''} ${isPracticed ? 'practiced' : ''}`;
        const btnClass = isPracticed ? "btn-action btn-practiced btn-square" : "btn-action btn-ghost-green btn-square";
        const btnTitle = isPracticed ? t('immersive.already_practiced') : t('immersive.mark_practiced');
        const onClickAttr = `onclick="validerShuffleItem(${item.id}, ${idx}, event, this)"`;
        const favBtnClass = item.favori ? "btn-action btn-ghost-amber btn-square" : "btn-action btn-ghost-neutral btn-square";
        const favIcon = item.favori ? svgStarFilled : svgStarOutline;
        const nbPratiques = item.stats ? (item.stats.nb_pratiques || 0) : (item.nb_pratiques || 0);

        let itemBadges = ""; const sc = (Array.isArray(item.sous_categories) ? item.sous_categories : (item.sous_categorie ? [item.sous_categorie] : [])).filter(s => !estStyleIrealAFiltrer(s));
        if (sc.length > 0) { itemBadges = sc.map(s => `<span class="vocab-meta badge">${s}</span>`).join(' '); }
        const attrsText = formaterAttributsItemUI(item);
        const attrsHtml = attrsText ? `<div class="vocab-attributs">${attrsText}</div>` : '';

        listHtml += `
            <div id="vocab-card-${item.id}" class="${cardClasses}" style="cursor: pointer; transition: all 0.2s;" onclick="if(!event.target.closest('button')) { currentShuffleIndex = ${idx}; renderShuffleCard(); }">
                ${imageHtml}
                <div class="vocab-details">
                    <span class="vocab-title">${item.titre || t('common.untitled')}</span>
                    ${attrsHtml}
                    <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 4px;">
                        <span class="vocab-meta badge" style="border-color: var(--accent-blue); color: var(--accent-blue);">${item.type_item}</span>${itemBadges}
                    </div>
                    <div class="vocab-meta" style="margin-top: 6px;" id="count-vocab-${item.id}">${t('library.practiced_count', { count: nbPratiques })}</div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <button class="${favBtnClass}" onclick="toggleFavoriImmersif(${item.id}, event)" title="${t('common.favorite')}">${favIcon}</button>
                    <button class="${btnClass}" ${onClickAttr} title="${btnTitle}" style="border-radius: 50%; width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center;">${svgTickNoMargin}</button>
                </div>
            </div>`;
    });

    listContainer.innerHTML = listHtml;
    majBoutonPupitreAudio();
    setTimeout(() => loadLazyImages('immersif-list'), 50);
}

// ==========================================
// --- LECTEUR DE PARTITIONS HAUTE FIDÉLITÉ (PDF & IMAGES) ---
// ==========================================
if (typeof window !== 'undefined' && window.pdfjsLib) {
    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js';
    } catch (e) { }
}

let partitionState = {
    type: 'none',       // 'pdf' | 'image'
    pdfDoc: null,
    totalCount: 0,
    currentIndex: 0,
    images: [],
    titre: '',
    sourceNom: '',
    hudVisible: true,
    renderTask: null,
    prevRenderTask: null,
    nextRenderTask: null,
    renderedPageIndex: null,
    prevRenderedPageIndex: null,
    nextRenderedPageIndex: null
};

const scoreNavMachine = (typeof ScoreNavigation !== 'undefined' && typeof ScoreNavigation.createNavigationMachine === 'function')
    ? ScoreNavigation.createNavigationMachine()
    : null;

function syncScoreNavMachine() {
    if (!scoreNavMachine) return null;
    return scoreNavMachine.loadDocument({
        type: partitionState.type,
        sourceNom: partitionState.sourceNom,
        titre: partitionState.titre,
        itemId: partitionState.itemId || null,
        totalCount: partitionState.totalCount,
        currentIndex: partitionState.currentIndex,
        isLiveMode: !!(typeof concertState !== 'undefined' && concertState.isActive),
        setlistSongs: (typeof concertState !== 'undefined' && Array.isArray(concertState.morceaux)) ? concertState.morceaux : [],
        currentSongIndex: (typeof concertState !== 'undefined') ? (concertState.currentIndex || 0) : 0,
        isAnnotationActive: !!(typeof annotationState !== 'undefined' && annotationState.isEditing),
        activeTool: (typeof annotationState !== 'undefined' && annotationState.activeTool) ? annotationState.activeTool : 'pen'
    });
}

// --- MOTEUR D'ANNOTATIONS AU STYLET (STYLE MOBILESHEETS) ---
let annotationState = {
    isEditing: false,
    activeTool: 'pen',         // 'pen' | 'line' | 'text' | 'highlighter' | 'eraser'
    color: '#111111',
    size: (function () {
        try {
            const saved = parseFloat(localStorage.getItem('piano_workout_pen_size'));
            return (!isNaN(saved) && saved >= 1.0 && saved <= 10.0) ? saved : 2.5;
        } catch (_) {
            return 2.5;
        }
    })(),
    highlighterSize: 18,
    penOnly: false,            // Mode Doigt + Stylet par défaut (le plus commun)
    currentStrokes: [],
    isDrawing: false,
    currentStroke: null
};

// ==========================================
// --- MODE CONCERT & SETLISTS LIVE (JALON 8)
// ==========================================
let concertState = {
    isActive: false,
    playlistNom: '',
    morceaux: [],            // [{ id, titre, fichier_image, tonalite, ireal_data, ... }]
    currentIndex: 0,
    sessionItemIndex: null,  // Index dans seanceEnCours.items si lancé depuis une séance
    visualMetronomeActive: false,
    visualMetronomeBpm: 120,
    visualMetronomeInterval: null,
    sortableInstance: null
};

let concertToastTimer = null;
function afficherToastConcert(message) {
    const toast = document.getElementById('concert-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(concertToastTimer);
    concertToastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

function getMorceauxSetlistOrdonnes(nomPlaylist) {
    let morceaux = [];
    const isMorceau = (i) => (typeof estCategorieMorceaux === 'function' ? estCategorieMorceaux(i.type_item) : i.type_item === 'Morceaux');
    if (!nomPlaylist) {
        morceaux = vocabulaireCache.filter(i => isMorceau(i));
    } else {
        morceaux = vocabulaireCache.filter(i => {
            if (!isMorceau(i)) return false;
            const sc = Array.isArray(i.sous_categories) ? i.sous_categories : (i.sous_categorie ? [i.sous_categorie] : []);
            return sc.includes(nomPlaylist);
        });
    }

    try {
        const storedOrder = localStorage.getItem('piano_workout_setlist_' + (nomPlaylist || 'tous'));
        if (storedOrder) {
            const idsOrdre = JSON.parse(storedOrder);
            if (Array.isArray(idsOrdre) && idsOrdre.length > 0) {
                const mapMorceaux = new Map(morceaux.map(m => [m.id, m]));
                const ordonnes = [];
                idsOrdre.forEach(id => {
                    if (mapMorceaux.has(id)) {
                        ordonnes.push(mapMorceaux.get(id));
                        mapMorceaux.delete(id);
                    }
                });
                mapMorceaux.forEach(m => ordonnes.push(m));
                return ordonnes;
            }
        }
    } catch (e) {
        console.warn("Erreur lecture ordre setlist :", e);
    }

    return morceaux.sort((a, b) => (a.titre || "").localeCompare(b.titre || ""));
}

function sauvegarderOrdreSetlist(nomPlaylist, morceauxIds) {
    try {
        localStorage.setItem('piano_workout_setlist_' + (nomPlaylist || 'tous'), JSON.stringify(morceauxIds));
    } catch (e) { }
}

async function lancerModeConcert(item, sessionIndex = null) {
    let nomPlaylist = '';
    if (typeof item === 'string') {
        nomPlaylist = item;
    } else if (item) {
        const sc = Array.isArray(item.sous_categories) ? item.sous_categories : (item.sous_categorie ? [item.sous_categorie] : []);
        nomPlaylist = sc[0] || item.contenu || '';
    }

    const morceaux = getMorceauxSetlistOrdonnes(nomPlaylist);
    if (!morceaux || morceaux.length === 0) {
        alert(nomPlaylist
            ? t('concert.empty_setlist_alert', { name: nomPlaylist })
            : t('concert.empty_library_alert'));
        return;
    }

    concertState.isActive = true;
    concertState.playlistNom = nomPlaylist;
    concertState.morceaux = morceaux;
    concertState.currentIndex = 0;
    concertState.sessionItemIndex = sessionIndex;

    activerWakeLock();

    // On tombe d'abord sur la liste ordonnée des morceaux de la setlist
    ouvrirSetlistDrawer();
}

function lancerModeConcertDirect(nomPlaylist) {
    return lancerModeConcert(nomPlaylist, null);
}

async function demarrerConcertPremierMorceau() {
    await chargerMorceauConcert(0, 0);
    fermerSetlistDrawer();
    afficherToastConcert(t('concert.gig_started', { title: concertState.morceaux[0]?.titre || t('library.untitled') }));
}

function retournerSetlistDepuisPartition() {
    ouvrirSetlistDrawer();
}

async function chargerMorceauConcert(songIdx, targetPage = 0) {
    if (songIdx < 0 || songIdx >= concertState.morceaux.length) return;
    concertState.currentIndex = songIdx;
    const song = concertState.morceaux[songIdx];

    if (song.tempo && !isNaN(Number(song.tempo))) {
        concertState.visualMetronomeBpm = Number(song.tempo);
        const bpmEl = document.getElementById('concert-visual-bpm-text');
        if (bpmEl) bpmEl.textContent = concertState.visualMetronomeBpm;
        if (concertState.visualMetronomeActive) {
            demarrerPulseMetronomeVisuel();
        }
    }

    const modal = document.getElementById('modal-image-fullscreen');
    if (modal) modal.style.display = 'flex';

    majHUDConcert();

    const emptyCard = document.getElementById('concert-lead-sheet');
    const canvas = document.getElementById('pdf-render-canvas');
    const img = document.getElementById('image-fullscreen-src');

    let fichiers = [];
    if (Array.isArray(song.fichier_image)) {
        fichiers = song.fichier_image.filter(s => s && typeof s === 'string' && s.trim());
    } else if (typeof song.fichier_image === 'string' && song.fichier_image.trim()) {
        fichiers = song.fichier_image.split('|').filter(s => s.trim());
    }

    const hasFichier = fichiers.length > 0;

    if (hasFichier) {
        if (emptyCard) emptyCard.style.display = 'none';

        partitionState.itemId = song.id || null;
        partitionState.titre = song.titre || t('score.default_title');
        const primaryFile = fichiers[0];
        partitionState.sourceNom = primaryFile;
        const isPdf = typeof primaryFile === 'string' && (primaryFile.toLowerCase().endsWith('.pdf') || primaryFile.startsWith('data:application/pdf'));

        if (isPdf) {
            await chargerEtAfficherPdf(primaryFile, targetPage);
        } else {
            await chargerEtAfficherImage(fichiers, targetPage);
        }
    } else {
        if (canvas) canvas.style.display = 'none';
        const prevCanvas = document.getElementById('pdf-prerender-prev-canvas');
        if (prevCanvas) prevCanvas.style.display = 'none';
        const nextCanvas = document.getElementById('pdf-prerender-next-canvas');
        if (nextCanvas) nextCanvas.style.display = 'none';
        if (img) img.style.display = 'none';
        const annoCanvas = document.getElementById('annotation-canvas');
        if (annoCanvas) {
            const ctx = annoCanvas.getContext('2d');
            ctx.clearRect(0, 0, annoCanvas.width, annoCanvas.height);
        }

        partitionState.itemId = song.id || null;
        partitionState.type = 'none';
        partitionState.totalCount = 1;
        partitionState.currentIndex = 0;
        partitionState.titre = song.titre || t('score.default_title');
        syncScoreNavMachine();

        afficherCarteConcertSansPartition(song);
    }

    majHUDConcert();
}

function majHUDConcert() {
    const titleGroup = document.getElementById('partition-title-group');
    const concertCenter = document.getElementById('concert-hud-center');
    const counterNormal = document.getElementById('image-fullscreen-counter');
    const counterConcert = document.getElementById('concert-page-counter');
    const btnMetro = document.getElementById('btn-concert-visual-metronome');
    const btnSetlist = document.getElementById('btn-concert-setlist');
    const btnClose = document.getElementById('btn-partition-close');

    if (titleGroup) titleGroup.style.display = 'none';
    if (concertCenter) concertCenter.style.display = 'flex';
    if (counterNormal) counterNormal.style.display = 'none';
    if (counterConcert) counterConcert.style.display = 'block';
    if (btnMetro) btnMetro.style.display = 'none';
    if (btnSetlist) btnSetlist.style.display = 'none';
    if (btnClose) {
        btnClose.style.display = 'inline-flex';
        btnClose.title = t('concert.back_to_setlist');
    }

    if (concertState.morceaux.length > 0 && concertState.currentIndex < concertState.morceaux.length) {
        const song = concertState.morceaux[concertState.currentIndex];
        const titleEl = document.getElementById('concert-song-title');
        const idxBadge = document.getElementById('concert-song-idx-badge');
        const nextPreview = document.getElementById('concert-next-preview');

        if (titleEl) titleEl.textContent = song.titre || t('library.untitled');
        if (idxBadge) idxBadge.textContent = `${concertState.currentIndex + 1} / ${concertState.morceaux.length}`;

        if (nextPreview) {
            if (concertState.currentIndex < concertState.morceaux.length - 1) {
                const nextSong = concertState.morceaux[concertState.currentIndex + 1];
                nextPreview.textContent = t('concert.up_next', { title: nextSong.titre || t('library.untitled') });
                nextPreview.style.display = 'block';
            } else {
                nextPreview.textContent = t('concert.last_tune');
                nextPreview.style.display = 'block';
            }
        }

        if (counterConcert) {
            counterConcert.textContent = `Page ${partitionState.currentIndex + 1} / ${partitionState.totalCount || 1}`;
        }

        const bpmText = document.getElementById('concert-visual-bpm-text');
        if (bpmText) bpmText.textContent = concertState.visualMetronomeBpm;
    }
}

function toggleConcertVisualMetronome() {
    concertState.visualMetronomeActive = !concertState.visualMetronomeActive;
    const btn = document.getElementById('btn-concert-visual-metronome');
    if (btn) btn.classList.toggle('active', concertState.visualMetronomeActive);

    if (concertState.visualMetronomeActive) {
        demarrerPulseMetronomeVisuel();
    } else {
        arreterPulseMetronomeVisuel();
    }
}

function demarrerPulseMetronomeVisuel() {
    arreterPulseMetronomeVisuel();
    const bpm = Math.max(30, Math.min(300, concertState.visualMetronomeBpm || 120));
    const intervalMs = (60 / bpm) * 1000;
    const dot = document.getElementById('concert-visual-pulse-dot');

    const triggerFlash = () => {
        if (!dot) return;
        dot.classList.add('flash');
        setTimeout(() => {
            if (dot) dot.classList.remove('flash');
        }, 85);
    };

    triggerFlash();
    concertState.visualMetronomeInterval = setInterval(triggerFlash, intervalMs);
}

function arreterPulseMetronomeVisuel() {
    if (concertState.visualMetronomeInterval) {
        clearInterval(concertState.visualMetronomeInterval);
        concertState.visualMetronomeInterval = null;
    }
    const dot = document.getElementById('concert-visual-pulse-dot');
    if (dot) dot.classList.remove('flash');
}

function ouvrirSetlistDrawer() {
    const modal = document.getElementById('modal-concert-setlist');
    if (!modal) return;
    modal.style.display = 'flex';
    const titleEl = document.getElementById('concert-setlist-modal-title');
    if (titleEl) {
        titleEl.textContent = concertState.playlistNom ? t('concert.setlist_prefix', { name: concertState.playlistNom }) : t('concert.live_setlist');
    }

    renderSetlistDrawerItems();
}

function fermerSetlistDrawer() {
    const modal = document.getElementById('modal-concert-setlist');
    if (modal) modal.style.display = 'none';

    const fsModal = document.getElementById('modal-image-fullscreen');
    const isFullscreenOpen = fsModal && fsModal.style.display === 'flex';

    if (!isFullscreenOpen && concertState.isActive) {
        concertState.isActive = false;
        desactiverWakeLock();
    }
}

function renderSetlistDrawerItems() {
    const container = document.getElementById('concert-setlist-items');
    if (!container) return;

    let html = '';
    concertState.morceaux.forEach((m, idx) => {
        const isCurrent = idx === concertState.currentIndex;
        const safeTitre = (m.titre || t('library.untitled')).replace(/"/g, '&quot;');
        let tona = (m.attributs && m.attributs.tonalite) || m.tonalite || (m.ireal_data ? m.ireal_data.tona_origine : '') || '';
        if (!estTonaliteValide(tona)) {
            tona = '';
        }

        html += `
            <div class="concert-setlist-item ${isCurrent ? 'active-song' : ''}" data-id="${m.id}" onclick="choisirMorceauConcertDepuisSetlist(${idx})">
                <span class="drag-handle" onclick="event.stopPropagation()" title="${t('concert.drag_reorder')}">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin: round"><circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                </span>
                <span class="setlist-idx">${idx + 1}</span>
                <div class="setlist-details">
                    <span class="setlist-titre">${safeTitre}</span>
                    ${tona ? `<div class="setlist-meta"><span class="badge badge-neutral" style="font-size: 10px; padding: 1px 5px;">${formatTonalite(tona)}</span></div>` : ''}
                </div>
                ${isCurrent ? `<span class="badge badge-blue" style="font-size: 10px; padding: 2px 6px;">${t('concert.now_playing')}</span>` : ''}
            </div>
        `;
    });
    container.innerHTML = html;

    if (typeof Sortable !== 'undefined') {
        if (concertState.sortableInstance) {
            try { concertState.sortableInstance.destroy(); } catch (e) { }
        }
        concertState.sortableInstance = new Sortable(container, {
            handle: '.drag-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            onEnd: function(evt) {
                if (evt.oldIndex === evt.newIndex) return;

                const moved = concertState.morceaux.splice(evt.oldIndex, 1)[0];
                concertState.morceaux.splice(evt.newIndex, 0, moved);

                if (concertState.currentIndex === evt.oldIndex) {
                    concertState.currentIndex = evt.newIndex;
                } else if (evt.oldIndex < concertState.currentIndex && evt.newIndex >= concertState.currentIndex) {
                    concertState.currentIndex--;
                } else if (evt.oldIndex > concertState.currentIndex && evt.newIndex <= concertState.currentIndex) {
                    concertState.currentIndex++;
                }

                const ids = concertState.morceaux.map(m => m.id);
                sauvegarderOrdreSetlist(concertState.playlistNom, ids);

                renderSetlistDrawerItems();
                majHUDConcert();
                afficherToastConcert(t('concert.order_updated'));
            }
        });
    }
}

async function choisirMorceauConcertDepuisSetlist(idx) {
    await chargerMorceauConcert(idx, 0);
    fermerSetlistDrawer();
}

function afficherCarteConcertSansPartition(song) {
    const card = document.getElementById('concert-lead-sheet');
    if (!card) return;
    card.style.display = 'flex';

    const tonaEl = document.getElementById('concert-empty-tonalite');
    const titreEl = document.getElementById('concert-empty-titre');
    const metaEl = document.getElementById('concert-empty-meta');
    const chordsEl = document.getElementById('concert-empty-chords');

    let tona = (song.attributs && song.attributs.tonalite) || song.tonalite || (song.ireal_data ? song.ireal_data.tona_origine : '') || '';
    if (!estTonaliteValide(tona)) {
        tona = '';
    }
    if (tonaEl) {
        if (tona) {
            tonaEl.textContent = typeof formatTonalite === 'function' ? formatTonalite(tona) : tona;
            tonaEl.style.display = 'inline-block';
        } else {
            tonaEl.style.display = 'none';
        }
    }

    if (titreEl) titreEl.textContent = song.titre || t('library.untitled');

    const metaText = formaterAttributsItemUI({
        attributs: {
            compositeur: (song.attributs && song.attributs.compositeur) || song.compositeur || null,
            style: (song.attributs && song.attributs.style) || song.style || null,
            tonalite: null,
            tempo: (song.attributs && song.attributs.tempo) || song.tempo || null
        }
    });

    if (metaEl) {
        metaEl.textContent = metaText;
        metaEl.style.display = metaText ? 'block' : 'none';
    }

    if (chordsEl) {
        if (song.ireal_data && song.ireal_data.grille) {
            chordsEl.textContent = t('concert.ireal_available');
            chordsEl.style.display = 'block';
        } else {
            chordsEl.style.display = 'none';
        }
    }
}

function assignerPartitionMorceauConcert() {
    const fileInput = document.getElementById('concert-file-input');
    if (fileInput) {
        fileInput.value = '';
        fileInput.click();
    }
}

async function importerFichierPartitionConcert(event) {
    const file = event.target && event.target.files && event.target.files[0];
    if (!file) return;
    if (!concertState.morceaux || concertState.morceaux.length === 0) return;
    const song = concertState.morceaux[concertState.currentIndex];
    if (!song) return;

    try {
        afficherToastConcert(t('concert.attaching_score'));
        const base64 = await new Promise((res, rej) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => res(reader.result);
            reader.onerror = e => rej(e);
        });

        const extension = (file.name.split('.').pop() || 'pdf').toLowerCase();
        const cleanName = file.name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
        const fileNameToSave = `file_${Date.now()}_${cleanName}.${extension}`;

        await sauvegarderFichierLocal(fileNameToSave, base64);

        song.fichier_image = fileNameToSave;

        await apiFetch(`/vocabulaire/${song.id}`, {
            method: 'PUT',
            body: JSON.stringify(song)
        });

        if (typeof vocabulaireCache !== 'undefined' && Array.isArray(vocabulaireCache)) {
            const cachedItem = vocabulaireCache.find(i => i.id === song.id);
            if (cachedItem) cachedItem.fichier_image = fileNameToSave;
        }

        afficherToastConcert(t('concert.score_attached'));
        await chargerMorceauConcert(concertState.currentIndex, 0);
    } catch (err) {
        console.error("Erreur lors de l'association de partition en mode concert:", err);
        afficherToastConcert(t('concert.error_attaching'));
    } finally {
        if (event.target) event.target.value = '';
    }
}

function quitterModeConcert() {
    arreterPulseMetronomeVisuel();
    const modalSetlist = document.getElementById('modal-concert-setlist');
    if (modalSetlist) modalSetlist.style.display = 'none';

    if (concertState.sessionItemIndex !== null && seanceEnCours && Array.isArray(seanceEnCours.items)) {
        const item = seanceEnCours.items[concertState.sessionItemIndex];
        if (item) {
            item.fait = true;
            try { apiFetch(`/seances/${seanceEnCours.id}`, { method: 'PUT', body: JSON.stringify(seanceEnCours) }); } catch (e) { }
            verifierFinSeance();
            const card = document.getElementById(`card-${concertState.sessionItemIndex}`);
            if (card) card.classList.add('done');
            const timerDisplay = document.getElementById(`timer-display-${concertState.sessionItemIndex}`);
            if (timerDisplay) { timerDisplay.className = 'badge-temps'; timerDisplay.innerHTML = t('practice.done'); }
        }
    }

    concertState.isActive = false;
    fermerModalImage(true);
    desactiverWakeLock();
    afficherToastConcert(t('concert.ended_toast'));
}

async function ouvrirLecteurPartition(source, titreMorceau = '', itemId = null) {
    if (!source) return;

    let fichiers = [];
    if (Array.isArray(source)) {
        fichiers = source.filter(s => s && typeof s === 'string' && s.trim());
    } else if (typeof source === 'string' && source.trim()) {
        fichiers = source.split('|').filter(s => s.trim());
    }
    if (fichiers.length === 0) return;
    const primaryFile = fichiers[0];

    activerWakeLock();

    partitionState.itemId = itemId || null;

    if (!titreMorceau && typeof vocabulaireCache !== 'undefined' && Array.isArray(vocabulaireCache)) {
        const item = vocabulaireCache.find(i => {
            if (itemId && Number(i.id) === Number(itemId)) return true;
            const f = i.fichier_image;
            if (Array.isArray(f)) return f.includes(primaryFile) || (typeof source === 'string' && source.includes(f[0]));
            return f === primaryFile || f === source;
        });
        if (item) {
            titreMorceau = item.titre || item.nom || '';
            if (!partitionState.itemId) partitionState.itemId = item.id;
        }
    }
    partitionState.titre = titreMorceau || t('score.default_title');
    partitionState.sourceNom = primaryFile;

    const isPdf = typeof primaryFile === 'string' && (primaryFile.toLowerCase().endsWith('.pdf') || primaryFile.startsWith('data:application/pdf'));

    const modal = document.getElementById('modal-image-fullscreen');
    if (!modal) return;
    modal.style.display = 'flex';

    const titreEl = document.getElementById('partition-titre');
    if (titreEl) titreEl.innerText = partitionState.titre;

    const badgeEl = document.getElementById('partition-type-badge');
    if (badgeEl) badgeEl.innerText = isPdf ? 'PDF' : 'IMAGE';

    partitionState.hudVisible = true;
    majHUDPartition();

    if (isPdf) {
        await chargerEtAfficherPdf(primaryFile);
    } else {
        await chargerEtAfficherImage(fichiers);
    }
}

async function chargerEtAfficherPdf(source, initialPage = 0) {
    partitionState.type = 'pdf';
    partitionState.currentIndex = 0;
    fullscreenIndex = 0;
    partitionState.sourceNom = typeof source === 'string' ? source : 'partition.pdf';
    partitionState.renderedPageIndex = null;
    partitionState.prevRenderedPageIndex = null;
    partitionState.nextRenderedPageIndex = null;

    const canvas = document.getElementById('pdf-render-canvas');
    const prevCanvas = document.getElementById('pdf-prerender-prev-canvas');
    const nextCanvas = document.getElementById('pdf-prerender-next-canvas');
    const img = document.getElementById('image-fullscreen-src');
    const loader = document.getElementById('partition-loading');

    if (img) img.style.display = 'none';
    if (canvas) canvas.style.display = 'none';
    if (prevCanvas) prevCanvas.style.display = 'none';
    if (nextCanvas) nextCanvas.style.display = 'none';
    if (loader) loader.style.display = 'flex';

    try {
        let urlFichier = source;
        if (!source.startsWith('data:')) {
            urlFichier = await getFichierUrl(source);
        }
        if (!urlFichier) throw new Error('Fichier introuvable');

        let loadingTask;
        if (urlFichier.startsWith('data:')) {
            const base64Clean = urlFichier.split(',')[1];
            const binaryStr = atob(base64Clean);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
            loadingTask = pdfjsLib.getDocument({ data: bytes });
        } else {
            loadingTask = pdfjsLib.getDocument(urlFichier);
        }

        partitionState.pdfDoc = await loadingTask.promise;
        partitionState.totalCount = partitionState.pdfDoc.numPages;

        const targetIdx = (initialPage === 'last' && partitionState.totalCount > 1)
            ? partitionState.totalCount - 1
            : (typeof initialPage === 'number' ? Math.max(0, Math.min(partitionState.totalCount - 1, initialPage)) : 0);
        partitionState.currentIndex = targetIdx;
        fullscreenIndex = targetIdx;
        syncScoreNavMachine();

        await afficherPagePdf(targetIdx, { forceRender: true });
    } catch (err) {
        console.error('Erreur chargement PDF:', err);
        if (loader) loader.style.display = 'none';
        alert(t('score.pdf_load_error'));
        fermerModalImage();
    }
}

function annulerRendusVoisinsPdf() {
    if (partitionState.prevRenderTask) {
        try { partitionState.prevRenderTask.cancel(); } catch (e) { }
        partitionState.prevRenderTask = null;
    }
    if (partitionState.nextRenderTask) {
        try { partitionState.nextRenderTask.cancel(); } catch (e) { }
        partitionState.nextRenderTask = null;
    }
}

async function rendrePagePdfSurCanvas(pageIdx, targetCanvas, taskKey) {
    if (!partitionState.pdfDoc || !targetCanvas) return false;
    if (pageIdx === null || pageIdx === undefined || pageIdx < 0 || pageIdx >= partitionState.totalCount) return false;

    if (taskKey && partitionState[taskKey]) {
        try { partitionState[taskKey].cancel(); } catch (e) { }
        partitionState[taskKey] = null;
    }

    const pageNum = pageIdx + 1;
    const page = await partitionState.pdfDoc.getPage(pageNum);

    const container = document.getElementById('fullscreen-swipe-container');
    const availW = (container ? container.clientWidth : window.innerWidth) || window.innerWidth;
    const availH = (container ? container.clientHeight : window.innerHeight) || window.innerHeight;

    const unscaledViewport = page.getViewport({ scale: 1 });
    const dpr = window.devicePixelRatio || 1;

    const maxW = Math.max(200, availW - 24);
    const maxH = Math.max(200, availH - 24);
    const scaleX = maxW / unscaledViewport.width;
    const scaleY = maxH / unscaledViewport.height;
    const baseScale = Math.min(scaleX, scaleY);

    const scaledViewport = page.getViewport({ scale: baseScale * dpr });
    const targetW = Math.floor(scaledViewport.width);
    const targetH = Math.floor(scaledViewport.height);
    const cssW = `${Math.floor(scaledViewport.width / dpr)}px`;
    const cssH = `${Math.floor(scaledViewport.height / dpr)}px`;

    // Rendre d'abord dans un buffer hors-écran pour éviter tout flash ou clearRect sur un canvas visible
    const offscreen = document.createElement('canvas');
    offscreen.width = targetW;
    offscreen.height = targetH;
    const offCtx = offscreen.getContext('2d');

    const renderTask = page.render({
        canvasContext: offCtx,
        viewport: scaledViewport
    });
    if (taskKey) partitionState[taskKey] = renderTask;

    await renderTask.promise;
    if (taskKey && partitionState[taskKey] === renderTask) {
        partitionState[taskKey] = null;
    }

    targetCanvas.width = targetW;
    targetCanvas.height = targetH;
    targetCanvas.style.width = cssW;
    targetCanvas.style.height = cssH;
    const ctx = targetCanvas.getContext('2d');
    ctx.drawImage(offscreen, 0, 0);
    return true;
}

function copierBufferCanvasPdf(srcCanvas, destCanvas) {
    if (!srcCanvas || !destCanvas || srcCanvas.width === 0 || srcCanvas.height === 0) return false;
    destCanvas.width = srcCanvas.width;
    destCanvas.height = srcCanvas.height;
    destCanvas.style.width = srcCanvas.style.width;
    destCanvas.style.height = srcCanvas.style.height;
    const ctx = destCanvas.getContext('2d');
    ctx.drawImage(srcCanvas, 0, 0);
    return true;
}

function positionnerCanvasVoisinsPdf() {
    const container = document.getElementById('fullscreen-swipe-container');
    const vw = (container ? container.clientWidth : window.innerWidth) || window.innerWidth;
    const prevCanvas = document.getElementById('pdf-prerender-prev-canvas');
    const nextCanvas = document.getElementById('pdf-prerender-next-canvas');
    const isTransitioning = !!_partitionPageTurnTimer;

    if (prevCanvas) {
        if (!isTransitioning && partitionState.type === 'pdf' && partitionState.prevRenderedPageIndex !== null && prevCanvas.width > 0) {
            prevCanvas.style.transform = `translate3d(${-vw}px, 0, 0)`;
            prevCanvas.style.display = 'block';
        } else {
            prevCanvas.style.display = 'none';
        }
    }
    if (nextCanvas) {
        if (!isTransitioning && partitionState.type === 'pdf' && partitionState.nextRenderedPageIndex !== null && nextCanvas.width > 0) {
            nextCanvas.style.transform = `translate3d(${vw}px, 0, 0)`;
            nextCanvas.style.display = 'block';
        } else {
            nextCanvas.style.display = 'none';
        }
    }
}

async function prerendrePagesAdjacentesPdf(currentPageIdx) {
    if (!partitionState.pdfDoc || partitionState.type !== 'pdf') return;
    annulerRendusVoisinsPdf();

    const targets = ScoreNavigation.getPrerenderTargets(currentPageIdx, partitionState.totalCount, 'pdf');
    const prevCanvas = document.getElementById('pdf-prerender-prev-canvas');
    const nextCanvas = document.getElementById('pdf-prerender-next-canvas');

    if (targets.prev === null) {
        partitionState.prevRenderedPageIndex = null;
        if (prevCanvas) prevCanvas.style.display = 'none';
    }
    if (targets.next === null) {
        partitionState.nextRenderedPageIndex = null;
        if (nextCanvas) nextCanvas.style.display = 'none';
    }
    positionnerCanvasVoisinsPdf();

    // Pré-rendu silencieux de N+1 en priorité, puis N-1
    if (targets.next !== null && nextCanvas && partitionState.nextRenderedPageIndex !== targets.next) {
        try {
            const ok = await rendrePagePdfSurCanvas(targets.next, nextCanvas, 'nextRenderTask');
            if (ok && partitionState.currentIndex === currentPageIdx) {
                partitionState.nextRenderedPageIndex = targets.next;
                positionnerCanvasVoisinsPdf();
            }
        } catch (err) {
            if (err && err.name !== 'RenderingCancelledException') {
                console.warn('Erreur pré-rendu page PDF N+1:', err);
            }
        }
    }

    if (targets.prev !== null && prevCanvas && partitionState.prevRenderedPageIndex !== targets.prev) {
        try {
            const ok = await rendrePagePdfSurCanvas(targets.prev, prevCanvas, 'prevRenderTask');
            if (ok && partitionState.currentIndex === currentPageIdx) {
                partitionState.prevRenderedPageIndex = targets.prev;
                positionnerCanvasVoisinsPdf();
            }
        } catch (err) {
            if (err && err.name !== 'RenderingCancelledException') {
                console.warn('Erreur pré-rendu page PDF N-1:', err);
            }
        }
    }
}

function essayerBasculeBufferCachePdf(pageIdx, canvas, prevCanvas, nextCanvas) {
    const isForward = (pageIdx === partitionState.nextRenderedPageIndex && nextCanvas && nextCanvas.width > 0);
    const isBackward = (!isForward && pageIdx === partitionState.prevRenderedPageIndex && prevCanvas && prevCanvas.width > 0);
    if (!isForward && !isBackward) return false;

    const hitCanvas = isForward ? nextCanvas : prevCanvas;
    const oppositeCanvas = isForward ? prevCanvas : nextCanvas;
    const expectedOldIdx = isForward ? (pageIdx - 1) : (pageIdx + 1);
    const oldCurrentIdx = partitionState.renderedPageIndex;

    const tempOff = document.createElement('canvas');
    if (oldCurrentIdx !== null && canvas.width > 0) {
        copierBufferCanvasPdf(canvas, tempOff);
    }
    copierBufferCanvasPdf(hitCanvas, canvas);
    partitionState.renderedPageIndex = pageIdx;

    if (oldCurrentIdx === expectedOldIdx && oppositeCanvas && tempOff.width > 0) {
        copierBufferCanvasPdf(tempOff, oppositeCanvas);
        if (isForward) partitionState.prevRenderedPageIndex = oldCurrentIdx;
        else partitionState.nextRenderedPageIndex = oldCurrentIdx;
    } else {
        if (isForward) partitionState.prevRenderedPageIndex = null;
        else partitionState.nextRenderedPageIndex = null;
    }

    if (isForward) partitionState.nextRenderedPageIndex = null;
    else partitionState.prevRenderedPageIndex = null;
    return true;
}

async function afficherPagePdf(pageIdx, options = {}) {
    if (!partitionState.pdfDoc) return;
    const canvas = document.getElementById('pdf-render-canvas');
    const prevCanvas = document.getElementById('pdf-prerender-prev-canvas');
    const nextCanvas = document.getElementById('pdf-prerender-next-canvas');
    const img = document.getElementById('image-fullscreen-src');
    const loader = document.getElementById('partition-loading');
    if (!canvas) return;

    if (img) img.style.display = 'none';
    canvas.style.display = 'block';

    const forceRender = !!options.forceRender;
    let swappedFromCache = false;

    if (!forceRender) {
        swappedFromCache = essayerBasculeBufferCachePdf(pageIdx, canvas, prevCanvas, nextCanvas);
    } else {
        partitionState.prevRenderedPageIndex = null;
        partitionState.nextRenderedPageIndex = null;
    }

    if (!swappedFromCache) {
        if (loader && partitionState.renderedPageIndex === null) {
            loader.style.display = 'flex';
        }
        try {
            const ok = await rendrePagePdfSurCanvas(pageIdx, canvas, 'renderTask');
            if (ok) {
                partitionState.renderedPageIndex = pageIdx;
            }
        } catch (err) {
            if (err && err.name !== 'RenderingCancelledException') {
                console.error('Erreur rendu page PDF:', err);
            }
        } finally {
            if (loader) loader.style.display = 'none';
        }
    } else if (loader) {
        loader.style.display = 'none';
    }

    syncScoreNavMachine();
    majUIPartition();
    alignerAnnotationCanvas();
    await chargerAnnotationsPageCourante();
    prerendrePagesAdjacentesPdf(pageIdx);
}

async function chargerEtAfficherImage(source, initialPage = 0) {
    partitionState.type = 'image';
    let liste = [];
    if (Array.isArray(source)) liste = source;
    else if (typeof source === 'string') liste = source.split('|').filter(s => s);

    partitionState.images = liste;
    fullscreenImages = liste;
    partitionState.totalCount = liste.length;
    const targetIdx = (initialPage === 'last' && liste.length > 1)
        ? liste.length - 1
        : (typeof initialPage === 'number' ? Math.max(0, Math.min(liste.length - 1, initialPage)) : 0);
    partitionState.currentIndex = targetIdx;
    fullscreenIndex = targetIdx;
    partitionState.sourceNom = liste[0] || 'image';

    await afficherPageImage(targetIdx);
}

async function afficherPageImage(pageIdx) {
    const canvas = document.getElementById('pdf-render-canvas');
    const prevCanvas = document.getElementById('pdf-prerender-prev-canvas');
    const nextCanvas = document.getElementById('pdf-prerender-next-canvas');
    const img = document.getElementById('image-fullscreen-src');
    const loader = document.getElementById('partition-loading');

    if (canvas) canvas.style.display = 'none';
    if (prevCanvas) prevCanvas.style.display = 'none';
    if (nextCanvas) nextCanvas.style.display = 'none';
    if (loader) loader.style.display = 'none';
    if (!img) return;

    img.style.display = 'block';
    const nomFichier = partitionState.images[pageIdx];
    const urlFichier = nomFichier.startsWith('data:') ? nomFichier : await getFichierUrl(nomFichier);

    syncScoreNavMachine();
    majUIPartition();
    await new Promise(resolve => {
        let settled = false;
        const done = async () => {
            if (settled) return;
            settled = true;
            alignerAnnotationCanvas();
            await chargerAnnotationsPageCourante();
            resolve();
        };
        img.onload = done;
        img.onerror = () => resolve();
        img.src = urlFichier;
        if (img.complete && img.naturalWidth) {
            done();
        }
    });
}

function majUIPartition() {
    if (concertState.isActive) {
        majHUDConcert();
        return;
    }

    const counter = document.getElementById('image-fullscreen-counter');
    if (counter) {
        counter.style.display = 'block';
        counter.innerText = `Page ${partitionState.currentIndex + 1} / ${partitionState.totalCount || 1}`;
    }
}

function peutChangerPartitionPage(delta) {
    syncScoreNavMachine();
    return scoreNavMachine.canTurnPage(delta);
}

function capturerSnapshotPageCourante(startDragOffsetPx = 0) {
    const snap = document.getElementById('partition-page-snapshot');
    const wrapper = document.getElementById('partition-canvas-wrapper');
    const container = document.getElementById('fullscreen-swipe-container');
    if (!snap || !wrapper || !container) return false;

    const pdfCanvas = document.getElementById('pdf-render-canvas');
    const imgEl = document.getElementById('image-fullscreen-src');
    const annoCanvas = document.getElementById('annotation-canvas');

    let sourceEl = null;
    if (partitionState.type === 'pdf' && pdfCanvas && pdfCanvas.style.display !== 'none' && pdfCanvas.width > 0) {
        sourceEl = pdfCanvas;
    } else if (partitionState.type === 'image' && imgEl && imgEl.style.display !== 'none' && imgEl.naturalWidth > 0) {
        sourceEl = imgEl;
    }
    if (!sourceEl) {
        snap.style.display = 'none';
        return false;
    }

    // Neutraliser temporairement la translation du wrapper pour lire la position de base exacte
    const prevTransform = wrapper.style.transform;
    wrapper.style.transition = 'none';
    wrapper.style.transform = 'none';

    const rect = sourceEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));

    snap.width = w;
    snap.height = h;
    snap.style.width = `${rect.width}px`;
    snap.style.height = `${rect.height}px`;
    snap.style.left = `${rect.left - containerRect.left}px`;
    snap.style.top = `${rect.top - containerRect.top}px`;

    wrapper.style.transform = prevTransform;

    const ctx = snap.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    try {
        ctx.drawImage(sourceEl, 0, 0, w, h);
        if (annoCanvas && annoCanvas.width > 0 && annoCanvas.height > 0) {
            ctx.drawImage(annoCanvas, 0, 0, w, h);
        }
    } catch (e) {
        snap.style.display = 'none';
        return false;
    }

    snap.style.transition = 'none';
    snap.style.transform = `translate3d(${startDragOffsetPx}px, 0, 0)`;
    snap.style.opacity = '1';
    snap.style.display = 'block';
    return true;
}

let _partitionPageTurnTimer = null;

async function changerPartitionPage(delta, event, startDragOffsetPx = 0) {
    if (event) {
        event.stopPropagation();
        if (event.cancelable) event.preventDefault();
    }

    const wrapper = document.getElementById('partition-canvas-wrapper');
    const snap = document.getElementById('partition-page-snapshot');
    const container = document.getElementById('fullscreen-swipe-container');
    const vw = (container ? container.clientWidth : window.innerWidth) || window.innerWidth;

    const transition = scoreNavMachine ? (syncScoreNavMachine(), scoreNavMachine.turnPage(delta)) : null;

    if (transition ? transition.action === 'noop' : !peutChangerPartitionPage(delta)) {
        if (concertState.isActive) {
            if (delta > 0) afficherToastConcert(t('concert.end_of_setlist'));
            else if (delta < 0) afficherToastConcert(t('concert.start_of_setlist'));
        }
        if (wrapper) {
            wrapper.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
            wrapper.style.transform = 'translate3d(0px, 0px, 0)';
        }
        return Promise.resolve();
    }

    if (_partitionPageTurnTimer) {
        clearTimeout(_partitionPageTurnTimer);
        _partitionPageTurnTimer = null;
    }

    const hasSnap = capturerSnapshotPageCourante(startDragOffsetPx);

    const animerSlideHorizontal = () => {
        if (!wrapper) return;
        const prevCanvas = document.getElementById('pdf-prerender-prev-canvas');
        const nextCanvas = document.getElementById('pdf-prerender-next-canvas');
        if (prevCanvas) prevCanvas.style.display = 'none';
        if (nextCanvas) nextCanvas.style.display = 'none';

        const enterStartX = (delta > 0 ? vw : -vw) + startDragOffsetPx;
        const exitEndX = delta > 0 ? -vw : vw;

        wrapper.style.transition = 'none';
        wrapper.style.transform = `translate3d(${enterStartX}px, 0, 0)`;
        void wrapper.offsetWidth; // Force reflow

        const durationMs = 260;
        const easing = 'cubic-bezier(0.22, 1, 0.36, 1)';

        if (hasSnap && snap) {
            snap.style.transition = `transform ${durationMs}ms ${easing}, opacity ${durationMs}ms ease`;
            snap.style.transform = `translate3d(${exitEndX}px, 0, 0)`;
            snap.style.opacity = '0.92';
        }

        wrapper.style.transition = `transform ${durationMs}ms ${easing}`;
        wrapper.style.transform = 'translate3d(0px, 0px, 0)';

        _partitionPageTurnTimer = setTimeout(() => {
            _partitionPageTurnTimer = null;
            if (snap) {
                snap.style.display = 'none';
                snap.style.transition = 'none';
                snap.style.transform = 'none';
            }
            if (wrapper) {
                wrapper.style.transition = 'none';
                wrapper.style.transform = 'none';
            }
            positionnerCanvasVoisinsPdf();
        }, durationMs + 25);
    };

    if (transition && transition.action === 'song') {
        await chargerMorceauConcert(transition.songIndex, transition.targetPage);
        animerSlideHorizontal();
        const activeSong = concertState.morceaux[concertState.currentIndex];
        if (activeSong) {
            afficherToastConcert(t('concert.tune_Step', { current: concertState.currentIndex + 1, total: concertState.morceaux.length, title: activeSong.titre }));
        }
        return;
    }

    if (partitionState.totalCount <= 1) return Promise.resolve();

    let newIndex = transition && transition.action === 'page'
        ? transition.pageIndex
        : (partitionState.currentIndex + delta);
    if (newIndex < 0) newIndex = 0;
    if (newIndex >= partitionState.totalCount) newIndex = partitionState.totalCount - 1;

    partitionState.currentIndex = newIndex;
    fullscreenIndex = newIndex;
    majUIPartition();

    if (partitionState.type === 'pdf') {
        await afficherPagePdf(newIndex);
    } else {
        await afficherPageImage(newIndex);
    }
    animerSlideHorizontal();
}

function togglePartitionHUD(event) {
    if (event) event.stopPropagation();
    partitionState.hudVisible = !partitionState.hudVisible;
    majHUDPartition();
}

function majHUDPartition() {
    if (concertState.isActive) {
        majHUDConcert();
    } else {
        const titleGroup = document.getElementById('partition-title-group');
        const concertCenter = document.getElementById('concert-hud-center');
        const counterNormal = document.getElementById('image-fullscreen-counter');
        const counterConcert = document.getElementById('concert-page-counter');
        const btnMetro = document.getElementById('btn-concert-visual-metronome');
        const btnSetlist = document.getElementById('btn-concert-setlist');
        const btnClose = document.getElementById('btn-partition-close');

        if (titleGroup) titleGroup.style.display = 'flex';
        if (concertCenter) concertCenter.style.display = 'none';
        if (counterNormal) counterNormal.style.display = 'block';
        if (counterConcert) counterConcert.style.display = 'none';
        if (btnMetro) btnMetro.style.display = 'none';
        if (btnSetlist) btnSetlist.style.display = 'none';
        if (btnClose) btnClose.style.display = 'inline-flex';
    }

    const btnPartitionAudio = document.getElementById('btn-partition-audio');
    if (btnPartitionAudio) {
        let song = null;
        if (concertState.isActive && concertState.morceaux && concertState.currentIndex < concertState.morceaux.length) {
            song = concertState.morceaux[concertState.currentIndex];
        } else if (partitionState.itemId && typeof vocabulaireCache !== 'undefined') {
            song = vocabulaireCache.find(i => Number(i.id) === Number(partitionState.itemId));
        } else if (typeof vocabulaireCache !== 'undefined' && Array.isArray(vocabulaireCache)) {
            song = vocabulaireCache.find(i => (i.titre === partitionState.titre || (Array.isArray(i.fichier_image) && i.fichier_image.includes(partitionState.sourceNom)) || i.fichier_image === partitionState.sourceNom));
        }

        const hasAudio = !!(song && song.fichier_audio);
        if (hasAudio) {
            btnPartitionAudio.style.display = 'inline-flex';
            const isPlayingThis = (typeof transcribeState !== 'undefined' && transcribeState.isPlaying && transcribeState.currentItemId !== null && Number(transcribeState.currentItemId) === Number(song.id));
            if (isPlayingThis) {
                btnPartitionAudio.classList.add('active', 'btn-ghost-blue');
                btnPartitionAudio.classList.remove('btn-ghost-neutral');
                btnPartitionAudio.title = t('score.audio_active_title', { title: song.titre || '' });
            } else {
                btnPartitionAudio.classList.remove('active', 'btn-ghost-blue');
                btnPartitionAudio.classList.add('btn-ghost-neutral');
                btnPartitionAudio.title = t('score.play_attached_audio');
            }
        } else {
            btnPartitionAudio.style.display = 'none';
        }
    }

    const topBar = document.getElementById('partition-top-bar');
    const annoToolbar = document.getElementById('annotation-toolbar');

    const isCahier = (partitionState.type === 'cahier');
    const btnCahierAdd = document.getElementById('btn-cahier-add-system');
    const btnCahierMeasures = document.getElementById('btn-cahier-toggle-measures');
    const btnCahierTerminer = document.getElementById('btn-cahier-terminer');
    const badgeEl = document.getElementById('partition-type-badge');

    if (btnCahierAdd) btnCahierAdd.style.display = isCahier ? 'inline-flex' : 'none';
    if (btnCahierMeasures) btnCahierMeasures.style.display = isCahier ? 'inline-flex' : 'none';
    if (btnCahierTerminer) btnCahierTerminer.style.display = isCahier ? 'inline-flex' : 'none';

    if (isCahier) {
        const counterNormal = document.getElementById('image-fullscreen-counter');
        if (counterNormal) counterNormal.style.display = 'none';
        if (btnPartitionAudio) btnPartitionAudio.style.display = 'none';
        if (badgeEl) badgeEl.innerText = t('cahier.badge');
    }

    if (topBar) {
        if (partitionState.hudVisible) topBar.classList.remove('hud-hidden');
        else topBar.classList.add('hud-hidden');
    }
    if (annoToolbar) {
        if (partitionState.hudVisible && annotationState.isEditing) {
            annoToolbar.classList.remove('hud-hidden');
        } else {
            annoToolbar.classList.add('hud-hidden');
        }
    }
}

function fermerModalImage(forcerQuitter = false) {
    if (typeof textOverlayState !== 'undefined' && textOverlayState.active && !forcerQuitter) {
        validerTexteAnnotationActif();
    }
    if (partitionState.type === 'cahier' && !forcerQuitter && annotationState.currentStrokes && annotationState.currentStrokes.length > 0) {
        ouvrirModalCahierSave();
        return;
    }

    if (concertState.isActive && !forcerQuitter) {
        ouvrirSetlistDrawer();
        return;
    }

    if (concertState.isActive) {
        arreterPulseMetronomeVisuel();
        fermerSetlistDrawer();
        concertState.isActive = false;
    }

    const emptyCard = document.getElementById('concert-lead-sheet');
    if (emptyCard) emptyCard.style.display = 'none';

    if (annotationState.isEditing) {
        toggleModeAnnotation(false);
    }

    const modal = document.getElementById('modal-image-fullscreen');
    if (modal) modal.style.display = 'none';

    const annoToolbar = document.getElementById('annotation-toolbar');
    if (annoToolbar) {
        annoToolbar.style.left = '';
        annoToolbar.style.top = '';
        annoToolbar.style.bottom = '';
        annoToolbar.style.transform = '';
    }

    if (partitionState.renderTask) {
        try { partitionState.renderTask.cancel(); } catch (e) { }
        partitionState.renderTask = null;
    }
    annulerRendusVoisinsPdf();
    if (partitionState.pdfDoc) {
        try { partitionState.pdfDoc.destroy(); } catch (e) { }
        partitionState.pdfDoc = null;
    }
    const canvas = document.getElementById('pdf-render-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
    }
    const prevCanvas = document.getElementById('pdf-prerender-prev-canvas');
    if (prevCanvas) {
        const pctx = prevCanvas.getContext('2d');
        if (pctx) pctx.clearRect(0, 0, prevCanvas.width, prevCanvas.height);
        prevCanvas.style.display = 'none';
        prevCanvas.style.transform = 'none';
    }
    const nextCanvas = document.getElementById('pdf-prerender-next-canvas');
    if (nextCanvas) {
        const nctx = nextCanvas.getContext('2d');
        if (nctx) nctx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
        nextCanvas.style.display = 'none';
        nextCanvas.style.transform = 'none';
    }
    const snap = document.getElementById('partition-page-snapshot');
    if (snap) {
        const snapCtx = snap.getContext('2d');
        if (snapCtx) snapCtx.clearRect(0, 0, snap.width, snap.height);
        snap.style.display = 'none';
        snap.style.transform = 'none';
    }
    const wrapper = document.getElementById('partition-canvas-wrapper');
    if (wrapper) {
        wrapper.style.transition = 'none';
        wrapper.style.transform = 'none';
    }
    const staffCanvas = document.getElementById('cahier-staff-canvas');
    if (staffCanvas) {
        const sctx = staffCanvas.getContext('2d');
        if (sctx) sctx.clearRect(0, 0, staffCanvas.width, staffCanvas.height);
        staffCanvas.style.display = 'none';
    }
    const annoCanvas = document.getElementById('annotation-canvas');
    if (annoCanvas) {
        const actx = annoCanvas.getContext('2d');
        actx.clearRect(0, 0, annoCanvas.width, annoCanvas.height);
    }
    const img = document.getElementById('image-fullscreen-src');
    if (img) {
        img.src = '';
        img.style.display = 'none';
    }
    partitionState.type = 'none';
    partitionState.totalCount = 0;
    partitionState.currentIndex = 0;
    partitionState.sourceNom = '';
    partitionState.renderedPageIndex = null;
    partitionState.prevRenderedPageIndex = null;
    partitionState.nextRenderedPageIndex = null;
    fullscreenIndex = 0;
    syncScoreNavMachine();

    const pupitreEnCours = (typeof isPupitreActive !== 'undefined') ? isPupitreActive : false;
    const timerActif = (typeof activeTimer !== 'undefined' && activeTimer && activeTimer.index !== null && !activeTimer.isPaused);
    if (!pupitreEnCours && !timerActif && typeof desactiverWakeLock === 'function') {
        desactiverWakeLock();
    }
}

// Aliases pour compatibilité existante
function ouvrirModalImage(srcsString, titreMorceau, itemId = null) { return ouvrirLecteurPartition(srcsString, titreMorceau, itemId); }
function ouvrirPdfLocal(nomFichier, titreMorceau, itemId = null) { return ouvrirLecteurPartition(nomFichier, titreMorceau, itemId); }
function changerImageFullscreen(delta, event) { return changerPartitionPage(delta, event); }
function afficherImageFullscreen() { return partitionState.type === 'pdf' ? afficherPagePdf(partitionState.currentIndex) : afficherPageImage(partitionState.currentIndex); }

// ==========================================
// --- MOTEUR D'ANNOTATION AU STYLET (LOGIQUE)
// ==========================================

function alignerAnnotationCanvas() {
    const target = partitionState.type === 'pdf' 
        ? document.getElementById('pdf-render-canvas') 
        : (partitionState.type === 'cahier' ? document.getElementById('cahier-staff-canvas') : document.getElementById('image-fullscreen-src'));
    const annoCanvas = document.getElementById('annotation-canvas');
    if (!target || !annoCanvas) return;

    const w = target.width || target.naturalWidth || target.clientWidth || 300;
    const h = target.height || target.naturalHeight || target.clientHeight || 400;

    annoCanvas.width = w;
    annoCanvas.height = h;
    annoCanvas.style.width = target.style.width || (target.clientWidth + 'px');
    annoCanvas.style.height = target.style.height || (target.clientHeight + 'px');
    annoCanvas.style.top = target.offsetTop + 'px';
    annoCanvas.style.left = target.offsetLeft + 'px';
}

function initDraggableAnnotationToolbar() {
    const toolbar = document.getElementById('annotation-toolbar');
    if (!toolbar) return;

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let hasMoved = false;

    const onStart = (clientX, clientY, pointerId, target) => {
        const isHandle = !!target.closest('#annotation-toolbar-drag-handle');
        const isButtonOrDot = !!target.closest('button, .color-dot, #pen-size-popover');
        // Ne pas déplacer si on a cliqué sur un bouton/couleur/popover (sauf si c'est la poignée de drag)
        if (!isHandle && isButtonOrDot) return false;

        isDragging = true;
        hasMoved = false;
        startX = clientX;
        startY = clientY;

        const rect = toolbar.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;

        if (pointerId !== undefined && toolbar.setPointerCapture) {
            try { toolbar.setPointerCapture(pointerId); } catch (_) { }
        }
        return true;
    };

    const onMove = (clientX, clientY) => {
        if (!isDragging) return;
        const dx = clientX - startX;
        const dy = clientY - startY;

        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
            hasMoved = true;
        }
        if (!hasMoved) return;

        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;

        const pad = 8;
        const maxLeft = window.innerWidth - toolbar.offsetWidth - pad;
        const maxTop = window.innerHeight - toolbar.offsetHeight - pad;
        newLeft = Math.max(pad, Math.min(newLeft, maxLeft));
        newTop = Math.max(pad, Math.min(newTop, maxTop));

        toolbar.style.left = `${newLeft}px`;
        toolbar.style.top = `${newTop}px`;
        toolbar.style.bottom = 'auto';
        toolbar.style.transform = 'none';
    };

    const onEnd = (pointerId) => {
        if (!isDragging) return;
        isDragging = false;
        if (pointerId !== undefined && toolbar.releasePointerCapture) {
            try { toolbar.releasePointerCapture(pointerId); } catch (_) { }
        }
    };

    toolbar.addEventListener('pointerdown', (e) => {
        if (onStart(e.clientX, e.clientY, e.pointerId, e.target)) {
            if (e.pointerType === 'touch' || e.pointerType === 'pen') {
                try { e.preventDefault(); } catch (_) { }
            }
        }
    });

    toolbar.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        onMove(e.clientX, e.clientY);
        if (hasMoved && e.cancelable) {
            try { e.preventDefault(); } catch (_) { }
        }
    });

    toolbar.addEventListener('pointerup', (e) => onEnd(e.pointerId));
    toolbar.addEventListener('pointercancel', (e) => onEnd(e.pointerId));

    // Support tactile dédié direct pour tablettes (Samsung Galaxy Tab / One UI)
    const handle = document.getElementById('annotation-toolbar-drag-handle');
    if (handle) {
        handle.addEventListener('touchstart', (e) => {
            if (!e.touches || e.touches.length === 0) return;
            const t = e.touches[0];
            onStart(t.clientX, t.clientY, undefined, handle);
            try { e.preventDefault(); } catch (_) { }
        }, { passive: false });

        handle.addEventListener('touchmove', (e) => {
            if (!isDragging || !e.touches || e.touches.length === 0) return;
            const t = e.touches[0];
            onMove(t.clientX, t.clientY);
            try { e.preventDefault(); } catch (_) { }
        }, { passive: false });

        handle.addEventListener('touchend', () => onEnd());
        handle.addEventListener('touchcancel', () => onEnd());
    }
}

// --- POPOVER D'ÉPAISSEUR DU STYLO (APPUI LONG OU RE-CLIC SUR STYLO) ---
const PEN_SIZE_MIN = 1.0;
const PEN_SIZE_MAX = 10.0;

function majPenSizePopoverUI() {
    const popover = document.getElementById('pen-size-popover');
    const fill = document.getElementById('pen-size-fill');
    const thumb = document.getElementById('pen-size-thumb');
    const dot = document.getElementById('pen-size-thumb-dot');
    if (!popover || !fill || !thumb || !dot) return;

    const size = Math.max(PEN_SIZE_MIN, Math.min(PEN_SIZE_MAX, annotationState.size || 2.5));
    const ratio = (size - PEN_SIZE_MIN) / (PEN_SIZE_MAX - PEN_SIZE_MIN);
    const pct = Math.round(ratio * 1000) / 10;

    // Thème graphique de l'application (accent bleu quand le stylo noir est actif, sinon la couleur active)
    const sliderColor = (!annotationState.color || annotationState.color === '#111111')
        ? 'var(--accent-amber)'
        : annotationState.color;
    popover.style.setProperty('--pen-slider-color', sliderColor);

    fill.style.height = `${pct}%`;
    thumb.style.bottom = `${pct}%`;

    const dotPx = Math.round(4 + ratio * 10);
    dot.style.width = `${dotPx}px`;
    dot.style.height = `${dotPx}px`;
}

function ouvrirPenSizePopover() {
    const popover = document.getElementById('pen-size-popover');
    if (!popover) return;
    majPenSizePopoverUI();
    popover.style.display = 'flex';
}

function fermerPenSizePopover() {
    const popover = document.getElementById('pen-size-popover');
    if (popover) popover.style.display = 'none';
}

function togglePenSizePopover() {
    const popover = document.getElementById('pen-size-popover');
    if (!popover) return;
    if (popover.style.display === 'none' || !popover.style.display) {
        ouvrirPenSizePopover();
    } else {
        fermerPenSizePopover();
    }
}

function appliquerPenSizeDepuisClientY(clientY) {
    const track = document.getElementById('pen-size-track');
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.height <= 0) return;
    // En bas (rect.bottom) = PEN_SIZE_MIN, en haut (rect.top) = PEN_SIZE_MAX
    const ratio = Math.max(0, Math.min(1, (rect.bottom - clientY) / rect.height));
    annotationState.size = Math.round((PEN_SIZE_MIN + ratio * (PEN_SIZE_MAX - PEN_SIZE_MIN)) * 10) / 10;
    try {
        localStorage.setItem('piano_workout_pen_size', String(annotationState.size));
    } catch (_) { }
    majPenSizePopoverUI();
}

function initPenSizePopoverEvents() {
    const btnPen = document.getElementById('tool-pen');
    const popover = document.getElementById('pen-size-popover');
    const track = document.getElementById('pen-size-track');
    if (!btnPen || !popover || !track) return;

    let longPressTimer = null;
    let longPressTriggered = false;
    let isSlidingFromHold = false;

    btnPen.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        longPressTriggered = false;
        isSlidingFromHold = false;
        clearTimeout(longPressTimer);

        longPressTimer = setTimeout(() => {
            longPressTriggered = true;
            isSlidingFromHold = true;
            if (annotationState.activeTool !== 'pen') {
                choisirOutilAnnotation('pen', true);
            }
            ouvrirPenSizePopover();
        }, 280);
    });

    window.addEventListener('pointermove', (e) => {
        if (!isSlidingFromHold) return;
        const trackRect = track.getBoundingClientRect();
        if (trackRect.height > 0 && e.clientY <= trackRect.bottom + 12 && e.clientY >= trackRect.top - 16) {
            appliquerPenSizeDepuisClientY(e.clientY);
        }
    });

    const endPenPress = (e) => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        if (isSlidingFromHold) {
            isSlidingFromHold = false;
            return;
        }
        if (!longPressTriggered && e && e.type === 'pointerup') {
            if (annotationState.activeTool === 'pen') {
                togglePenSizePopover();
            } else {
                choisirOutilAnnotation('pen');
            }
        }
    };

    btnPen.addEventListener('pointerup', endPenPress);
    btnPen.addEventListener('pointercancel', endPenPress);

    // Glissement direct sur la jauge verticale du popover
    let isDraggingTrack = false;
    popover.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        isDraggingTrack = true;
        appliquerPenSizeDepuisClientY(e.clientY);
        try { popover.setPointerCapture(e.pointerId); } catch (_) { }
    });
    popover.addEventListener('pointermove', (e) => {
        if (!isDraggingTrack) return;
        e.stopPropagation();
        appliquerPenSizeDepuisClientY(e.clientY);
    });
    const stopTrackDrag = (e) => {
        if (!isDraggingTrack) return;
        isDraggingTrack = false;
        try { popover.releasePointerCapture(e.pointerId); } catch (_) { }
    };
    popover.addEventListener('pointerup', stopTrackDrag);
    popover.addEventListener('pointercancel', stopTrackDrag);

    // Fermer le popover si on clique en dehors
    window.addEventListener('pointerdown', (e) => {
        if (popover.style.display === 'none' || !popover.style.display) return;
        if (e.target.closest('#tool-pen-wrapper')) return;
        fermerPenSizePopover();
    });
}

// --- OUTIL D'INSERTION ET ÉDITION DE TEXTE FLOTTANT (ERGONOMIE IMPLICITE TYPE PDF MODERNE) ---
const textOverlayState = {
    active: false,
    normX: 0.2,
    normY: 0.2,
    fontSizeNorm: 0.022,
    color: '#111111',
    isMoving: false,
    isPendingMove: false,
    autoValidateOnDrop: false,
    moveStartX: 0,
    moveStartY: 0,
    startNormX: 0,
    startNormY: 0
};

function ajusterTailleInputTexteAnnotation() {
    const overlay = document.getElementById('annotation-text-overlay');
    const input = document.getElementById('annotation-text-input');
    const annoCanvas = document.getElementById('annotation-canvas');
    if (!overlay || !input || !annoCanvas) return;

    const displayW = annoCanvas.clientWidth || parseFloat(annoCanvas.style.width) || 300;
    const displayH = annoCanvas.clientHeight || parseFloat(annoCanvas.style.height) || 400;
    const pxFont = Math.max(11, Math.round(textOverlayState.fontSizeNorm * displayH));

    input.style.fontSize = `${pxFont}px`;
    input.style.color = textOverlayState.color || annotationState.color || '#111111';

    const lines = (input.value || t('score.text_placeholder')).split('\n');
    input.rows = Math.max(1, lines.length);

    // Mesure précise de la largeur du texte
    const ctx = annoCanvas.getContext('2d');
    let maxLineW = 48;
    if (ctx) {
        ctx.save();
        ctx.font = `600 ${pxFont}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        for (const l of lines) {
            const m = ctx.measureText(l || ' ');
            if (m.width > maxLineW) maxLineW = m.width;
        }
        ctx.restore();
    }
    input.style.width = `${Math.ceil(maxLineW + 22)}px`;
    input.style.height = `${Math.ceil(lines.length * pxFont * 1.24 + 8)}px`;

    const baseLeft = annoCanvas.offsetLeft + textOverlayState.normX * displayW;
    const baseTop = annoCanvas.offsetTop + textOverlayState.normY * displayH;
    overlay.style.left = `${Math.round(baseLeft)}px`;
    overlay.style.top = `${Math.round(baseTop)}px`;
}

function trouverIdxTexteAnnotationAuPoint(normX, normY) {
    const canvas = document.getElementById('annotation-canvas');
    if (!canvas || !annotationState.currentStrokes) return -1;
    const ctx = canvas.getContext('2d');

    for (let idx = annotationState.currentStrokes.length - 1; idx >= 0; idx--) {
        const s = annotationState.currentStrokes[idx];
        if (s.tool !== 'text' || !s.text || !s.points || !s.points[0]) continue;
        const tx = s.points[0].x;
        const ty = s.points[0].y;
        const fNorm = s.fontSize || 0.022;
        const pxFont = Math.max(12, fNorm * canvas.height);
        const lines = String(s.text).split('\n');

        let maxW = pxFont * 2;
        if (ctx) {
            ctx.save();
            ctx.font = `600 ${pxFont}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
            for (const l of lines) {
                const w = ctx.measureText(l).width;
                if (w > maxW) maxW = w;
            }
            ctx.restore();
        }
        const normW = maxW / canvas.width;
        const normH = (lines.length * pxFont * 1.24) / canvas.height;
        const padX = 0.014;
        const padY = 0.010;

        if (normX >= tx - padX && normX <= tx + normW + padX && normY >= ty - padY && normY <= ty + normH + padY) {
            return idx;
        }
    }
    return -1;
}

function demarrerSuiviDeplacementTexte(clientX, clientY, immediateDrag = false, autoValidateOnDrop = false) {
    const overlay = document.getElementById('annotation-text-overlay');
    if (!overlay) return;
    textOverlayState.moveStartX = clientX;
    textOverlayState.moveStartY = clientY;
    textOverlayState.startNormX = textOverlayState.normX;
    textOverlayState.startNormY = textOverlayState.normY;
    textOverlayState.autoValidateOnDrop = !!autoValidateOnDrop;
    textOverlayState.isPendingMove = !immediateDrag;
    textOverlayState.isMoving = !!immediateDrag;
    overlay.classList.toggle('is-dragging', !!immediateDrag);
}

function ouvrirEditeurTexteAnnotation(normX, normY, strokeExistant = null, dragInitOptions = null) {
    validerTexteAnnotationActif();

    const overlay = document.getElementById('annotation-text-overlay');
    const input = document.getElementById('annotation-text-input');
    if (!overlay || !input) return;

    textOverlayState.active = true;
    textOverlayState.normX = Math.max(0.01, Math.min(0.92, normX));
    textOverlayState.normY = Math.max(0.01, Math.min(0.92, normY));
    textOverlayState.fontSizeNorm = (strokeExistant && strokeExistant.fontSize) ? strokeExistant.fontSize : (textOverlayState.fontSizeNorm || 0.022);
    textOverlayState.color = (strokeExistant && strokeExistant.color) ? strokeExistant.color : (annotationState.color || '#111111');

    input.value = strokeExistant && strokeExistant.text ? strokeExistant.text : '';
    overlay.classList.remove('is-dragging');
    overlay.style.display = 'block';
    ajusterTailleInputTexteAnnotation();

    if (dragInitOptions && typeof dragInitOptions.clientX === 'number') {
        demarrerSuiviDeplacementTexte(
            dragInitOptions.clientX,
            dragInitOptions.clientY,
            !!dragInitOptions.immediateDrag,
            !!dragInitOptions.autoValidateOnDrop
        );
    } else {
        setTimeout(() => {
            input.focus();
            if (strokeExistant && input.value) {
                input.setSelectionRange(input.value.length, input.value.length);
            }
        }, 20);
    }
}

async function validerTexteAnnotationActif() {
    if (!textOverlayState.active) return;
    const overlay = document.getElementById('annotation-text-overlay');
    const input = document.getElementById('annotation-text-input');
    textOverlayState.active = false;
    textOverlayState.isMoving = false;
    textOverlayState.isPendingMove = false;
    textOverlayState.autoValidateOnDrop = false;
    if (overlay) {
        overlay.classList.remove('is-dragging');
        overlay.style.display = 'none';
    }
    if (!input) return;

    const texte = input.value.replace(/\r/g, '').trimEnd();
    input.value = '';
    if (!texte.trim()) {
        redessinerAnnotations();
        await sauvegarderAnnotationsPageCourante();
        return;
    }

    annotationState.currentStrokes.push({
        tool: 'text',
        text: texte,
        color: textOverlayState.color || annotationState.color || '#111111',
        fontSize: textOverlayState.fontSizeNorm || 0.022,
        points: [{ x: textOverlayState.normX, y: textOverlayState.normY }]
    });

    redessinerAnnotations();
    await sauvegarderAnnotationsPageCourante();
}

function supprimerTexteAnnotationActif(event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    const overlay = document.getElementById('annotation-text-overlay');
    const input = document.getElementById('annotation-text-input');
    textOverlayState.active = false;
    textOverlayState.isMoving = false;
    textOverlayState.isPendingMove = false;
    if (input) input.value = '';
    if (overlay) {
        overlay.classList.remove('is-dragging');
        overlay.style.display = 'none';
    }
    redessinerAnnotations();
    sauvegarderAnnotationsPageCourante();
}

function initTextAnnotationOverlayEvents() {
    const overlay = document.getElementById('annotation-text-overlay');
    const input = document.getElementById('annotation-text-input');
    const resizeHandle = document.getElementById('annotation-text-resize-handle');
    if (!overlay || !input || !resizeHandle) return;

    input.addEventListener('input', () => {
        ajusterTailleInputTexteAnnotation();
    });

    input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
            e.preventDefault();
            validerTexteAnnotationActif();
        }
    });

    // Déplacement implicite : toucher la bordure du cadre déplace immédiatement ;
    // glisser depuis l'intérieur de la zone de texte (> 5px) déplace également avec transparence.
    overlay.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (e.target.closest('#annotation-text-resize-handle')) return;
        const isBorderGrab = (e.target === overlay);
        if (isBorderGrab) {
            e.preventDefault();
        }
        demarrerSuiviDeplacementTexte(e.clientX, e.clientY, isBorderGrab, false);
    });

    window.addEventListener('pointermove', (e) => {
        if (!textOverlayState.active) return;
        if (!textOverlayState.isMoving && !textOverlayState.isPendingMove) return;

        const dist = Math.hypot(e.clientX - textOverlayState.moveStartX, e.clientY - textOverlayState.moveStartY);
        if (textOverlayState.isPendingMove && dist > 5) {
            textOverlayState.isPendingMove = false;
            textOverlayState.isMoving = true;
            overlay.classList.add('is-dragging');
            input.blur();
        }

        if (textOverlayState.isMoving) {
            const annoCanvas = document.getElementById('annotation-canvas');
            if (!annoCanvas) return;
            const w = annoCanvas.clientWidth || 300;
            const h = annoCanvas.clientHeight || 400;
            const dx = (e.clientX - textOverlayState.moveStartX) / w;
            const dy = (e.clientY - textOverlayState.moveStartY) / h;
            textOverlayState.normX = Math.max(0.01, Math.min(0.94, textOverlayState.startNormX + dx));
            textOverlayState.normY = Math.max(0.01, Math.min(0.94, textOverlayState.startNormY + dy));
            ajusterTailleInputTexteAnnotation();
        }
    });

    const stopMoveText = () => {
        if (!textOverlayState.isMoving && !textOverlayState.isPendingMove) return;
        const wasMoving = textOverlayState.isMoving;
        const movedDistNorm = Math.hypot(
            textOverlayState.normX - textOverlayState.startNormX,
            textOverlayState.normY - textOverlayState.startNormY
        );
        const shouldAutoValidate = textOverlayState.autoValidateOnDrop && wasMoving && movedDistNorm > 0.004;

        textOverlayState.isMoving = false;
        textOverlayState.isPendingMove = false;
        textOverlayState.autoValidateOnDrop = false;
        overlay.classList.remove('is-dragging');

        if (shouldAutoValidate) {
            validerTexteAnnotationActif();
        } else if (!wasMoving && textOverlayState.active) {
            input.focus();
            if (input.value) {
                input.setSelectionRange(input.value.length, input.value.length);
            }
        }
    };
    window.addEventListener('pointerup', stopMoveText);
    window.addEventListener('pointercancel', stopMoveText);

    // Coin bas-droite discret : redimensionnement fluide de la taille de police avec transparence
    let isResizingText = false;
    let resizeStartX = 0, resizeStartY = 0;
    let startFontSizeNorm = 0.022;

    resizeHandle.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        isResizingText = true;
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        startFontSizeNorm = textOverlayState.fontSizeNorm || 0.022;
        overlay.classList.add('is-dragging');
        try { resizeHandle.setPointerCapture(e.pointerId); } catch (_) { }
    });

    resizeHandle.addEventListener('pointermove', (e) => {
        if (!isResizingText) return;
        e.stopPropagation();
        const annoCanvas = document.getElementById('annotation-canvas');
        const h = (annoCanvas && annoCanvas.clientHeight) ? annoCanvas.clientHeight : 500;
        const deltaPx = (e.clientY - resizeStartY) + (e.clientX - resizeStartX) * 0.45;
        const newNorm = startFontSizeNorm + (deltaPx / h) * 0.65;
        textOverlayState.fontSizeNorm = Math.max(0.010, Math.min(0.085, newNorm));
        ajusterTailleInputTexteAnnotation();
    });

    const stopResizeText = (e) => {
        if (!isResizingText) return;
        isResizingText = false;
        overlay.classList.remove('is-dragging');
        try { resizeHandle.releasePointerCapture(e.pointerId); } catch (_) { }
    };
    resizeHandle.addEventListener('pointerup', stopResizeText);
    resizeHandle.addEventListener('pointercancel', stopResizeText);
}

function toggleModeAnnotation(forceState) {
    if (forceState !== undefined) {
        annotationState.isEditing = forceState;
    } else {
        annotationState.isEditing = !annotationState.isEditing;
    }

    if (!annotationState.isEditing) {
        validerTexteAnnotationActif();
        fermerPenSizePopover();
    }

    const btnAnnotate = document.getElementById('btn-partition-annotate');
    const toolbar = document.getElementById('annotation-toolbar');
    const annoCanvas = document.getElementById('annotation-canvas');

    if (btnAnnotate) btnAnnotate.classList.toggle('active', annotationState.isEditing);
    if (toolbar) {
        toolbar.style.display = annotationState.isEditing ? 'flex' : 'none';
        if (annotationState.isEditing) toolbar.classList.remove('hud-hidden');
    }
    if (annoCanvas) {
        annoCanvas.style.pointerEvents = annotationState.isEditing ? 'auto' : 'none';
    }

    if (annotationState.isEditing) {
        alignerAnnotationCanvas();
        redessinerAnnotations();
    }
    syncScoreNavMachine();
}

function choisirOutilAnnotation(tool, garderPopoverOuvert = false) {
    if (textOverlayState.active && tool !== 'text') {
        validerTexteAnnotationActif();
    }
    if (!garderPopoverOuvert) {
        fermerPenSizePopover();
    }
    annotationState.activeTool = tool;
    ['tool-pen', 'tool-line', 'tool-text', 'tool-highlighter', 'tool-eraser'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('active');
    });
    const activeBtn = document.getElementById(`tool-${tool}`);
    if (activeBtn) activeBtn.classList.add('active');
    syncScoreNavMachine();
}

function choisirCouleurAnnotation(color, el) {
    annotationState.color = color;
    document.querySelectorAll('#annotation-colors .color-dot').forEach(d => d.classList.remove('active'));
    if (el && el.classList) el.classList.add('active');

    majPenSizePopoverUI();

    if (textOverlayState.active) {
        textOverlayState.color = color;
        ajusterTailleInputTexteAnnotation();
    }

    if (annotationState.activeTool === 'eraser' || annotationState.activeTool === 'highlighter') {
        choisirOutilAnnotation('pen');
    }
}

function togglePalmRejection() {
    annotationState.penOnly = !annotationState.penOnly;
    majAffichagePalmRejectionUI();
}

function majAffichagePalmRejectionUI() {
    const btn = document.getElementById('btn-palm-rejection');
    if (!btn) return;
    const isPenOnly = !!annotationState.penOnly;
    btn.classList.toggle('active', isPenOnly);

    if (isPenOnly) {
        btn.title = t('score.palm_pen_only');
        btn.innerHTML = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>`;
    } else {
        btn.title = t('score.palm_finger_pen');
        btn.innerHTML = `<svg viewBox="0 0 24 24" style="width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="M7.2 4.2a4.5 4.5 0 0 1 5.6 0"/><path d="M8 14V8a2 2 0 0 1 4 0v4h1.5a2 2 0 0 1 2 1.5 2 2 0 0 1 2.5 2v1.5a5 5 0 0 1-5 5H9.5a4.5 4.5 0 0 1-3.8-2.1L3.6 16.5a1.5 1.5 0 0 1 2.1-2.1L8 16V14z"/></svg>`;
    }
}

function getCleAnnotationCourante() {
    return ScoreNavigation.getAnnotationKey(partitionState.sourceNom, partitionState.titre, partitionState.currentIndex);
}

async function chargerAnnotationsPageCourante() {
    if (textOverlayState.active) {
        const overlay = document.getElementById('annotation-text-overlay');
        if (overlay) overlay.style.display = 'none';
        textOverlayState.active = false;
    }
    const cle = getCleAnnotationCourante();
    try {
        const record = await lireLocalId('annotations', cle);
        annotationState.currentStrokes = (record && Array.isArray(record.strokes)) ? record.strokes : [];
    } catch (e) {
        annotationState.currentStrokes = [];
    }
    redessinerAnnotations();
}

async function sauvegarderAnnotationsPageCourante() {
    const cle = getCleAnnotationCourante();
    try {
        await ecrireLocal('annotations', {
            id: cle,
            source: partitionState.sourceNom,
            page: partitionState.currentIndex,
            strokes: annotationState.currentStrokes,
            updatedAt: Date.now()
        });
    } catch (e) { }
}

function dessinerStrokeSurContext(ctx, stroke, width, height, scaleWidthRef) {
    if (!stroke || !stroke.points || stroke.points.length === 0) return;

    if (stroke.tool === 'text') {
        if (!stroke.text) return;
        const pt = stroke.points[0];
        const pxFont = Math.max(10, Math.round((stroke.fontSize || 0.022) * height));
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = stroke.color || '#111111';
        ctx.font = `600 ${pxFont}px Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.textBaseline = 'top';
        const lines = String(stroke.text).split('\n');
        const lineHeight = pxFont * 1.22;
        const startX = pt.x * width;
        const startY = pt.y * height;
        for (let i = 0; i < lines.length; i++) {
            ctx.fillText(lines[i], startX, startY + i * lineHeight);
        }
        ctx.restore();
        return;
    }

    ctx.save();
    ctx.beginPath();
    if (stroke.tool === 'highlighter') {
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.45)';
        ctx.lineWidth = (stroke.size || 18) * scaleWidthRef;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'multiply';
    } else {
        ctx.strokeStyle = stroke.color || '#111111';
        ctx.lineWidth = (stroke.size || 2.5) * scaleWidthRef;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'source-over';
    }

    for (let i = 0; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        const px = pt.x * width;
        const py = pt.y * height;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();
}

function redessinerAnnotations() {
    const canvas = document.getElementById('annotation-canvas');
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const dpr = window.devicePixelRatio || 1;

    for (const stroke of annotationState.currentStrokes) {
        dessinerStrokeSurContext(ctx, stroke, canvas.width, canvas.height, dpr);
    }
    ctx.globalCompositeOperation = 'source-over';

    if (textOverlayState.active) {
        ajusterTailleInputTexteAnnotation();
    }
}

async function annulerDerniereAnnotation() {
    if (textOverlayState.active) {
        await validerTexteAnnotationActif();
    }
    if (annotationState.currentStrokes.length > 0) {
        annotationState.currentStrokes.pop();
        redessinerAnnotations();
        await sauvegarderAnnotationsPageCourante();
    }
}

async function effacerToutesAnnotationsPage() {
    if (textOverlayState.active) {
        supprimerTexteAnnotationActif();
    }
    if (annotationState.currentStrokes.length === 0) return;
    annotationState.currentStrokes = [];
    redessinerAnnotations();
    await sauvegarderAnnotationsPageCourante();
}

function distancePointSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function effacerAuPoint(normX, normY) {
    const canvas = document.getElementById('annotation-canvas');
    if (!canvas) return;
    const threshold = 20 / Math.max(canvas.width, canvas.height);
    const initialLen = annotationState.currentStrokes.length;

    const textIdx = trouverIdxTexteAnnotationAuPoint(normX, normY);
    if (textIdx !== -1) {
        annotationState.currentStrokes.splice(textIdx, 1);
        redessinerAnnotations();
        return;
    }

    annotationState.currentStrokes = annotationState.currentStrokes.filter(stroke => {
        if (!stroke.points || stroke.points.length === 0) return false;
        if (stroke.tool === 'text') return true;
        if (stroke.points.length === 1) {
            return Math.hypot(stroke.points[0].x - normX, stroke.points[0].y - normY) >= threshold;
        }
        for (let i = 0; i < stroke.points.length - 1; i++) {
            const p1 = stroke.points[i];
            const p2 = stroke.points[i + 1];
            if (distancePointSegment(normX, normY, p1.x, p1.y, p2.x, p2.y) < threshold) {
                return false;
            }
        }
        return true;
    });
    if (annotationState.currentStrokes.length !== initialLen) {
        redessinerAnnotations();
    }
}

// Initialisation des événements du popover d'épaisseur et de la boîte de texte
initPenSizePopoverEvents();
initTextAnnotationOverlayEvents();

// ATTACHEMENT DES POINTER EVENTS AU CANVAS D'ANNOTATION (Stylet + Rejet paume + Déplacement implicite de texte)
const annoCanvas = document.getElementById('annotation-canvas');
if (annoCanvas) {
    let longPressTextTimer = null;
    let longPressDownX = 0;
    let longPressDownY = 0;
    let lastCanvasClientX = 0;
    let lastCanvasClientY = 0;

    const clearLongPressTextTimer = () => {
        if (longPressTextTimer) {
            clearTimeout(longPressTextTimer);
            longPressTextTimer = null;
        }
    };

    annoCanvas.addEventListener('pointerdown', async e => {
        if (!annotationState.isEditing) return;

        fermerPenSizePopover();
        clearLongPressTextTimer();

        // PALM REJECTION : Si activé, seul e.pointerType === 'pen' ou 'mouse' dessine
        if (annotationState.penOnly && e.pointerType === 'touch') return;

        const rect = annoCanvas.getBoundingClientRect();
        const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        longPressDownX = e.clientX;
        longPressDownY = e.clientY;
        lastCanvasClientX = e.clientX;
        lastCanvasClientY = e.clientY;

        // Si une zone de texte était ouverte et qu'on clique ailleurs sur la partition, on la désélectionne/valide
        if (textOverlayState.active) {
            await validerTexteAnnotationActif();
            if (annotationState.activeTool === 'text') {
                return;
            }
        }

        if (annotationState.activeTool === 'text') {
            const existingIdx = trouverIdxTexteAnnotationAuPoint(normX, normY);
            if (existingIdx !== -1) {
                const existingStroke = annotationState.currentStrokes.splice(existingIdx, 1)[0];
                redessinerAnnotations();
                // Si l'utilisateur glisse immédiatement, le texte se déplace avec transparence ; s'il relâche, il l'édite
                ouvrirEditeurTexteAnnotation(existingStroke.points[0].x, existingStroke.points[0].y, existingStroke, {
                    clientX: e.clientX,
                    clientY: e.clientY,
                    immediateDrag: false,
                    autoValidateOnDrop: false
                });
            } else {
                ouvrirEditeurTexteAnnotation(normX, normY, null);
            }
            return;
        }

        // Appui maintenu (~260ms) sur un texte déjà posé sur la partition (même depuis l'outil Stylo / Ligne) :
        // saisit le texte avec transparence pour permettre de le déplacer directement !
        if (annotationState.activeTool !== 'eraser') {
            const hitTextIdx = trouverIdxTexteAnnotationAuPoint(normX, normY);
            if (hitTextIdx !== -1) {
                const pointerId = e.pointerId;
                longPressTextTimer = setTimeout(() => {
                    longPressTextTimer = null;
                    if (!annotationState.isDrawing) return;
                    // Annuler le micro-point de stylo en cours
                    if (annotationState.currentStroke && annotationState.currentStrokes.includes(annotationState.currentStroke)) {
                        annotationState.currentStrokes.pop();
                    }
                    annotationState.isDrawing = false;
                    annotationState.currentStroke = null;
                    try { annoCanvas.releasePointerCapture(pointerId); } catch (_) { }

                    const currentIdx = trouverIdxTexteAnnotationAuPoint(normX, normY);
                    if (currentIdx !== -1) {
                        const pickedText = annotationState.currentStrokes.splice(currentIdx, 1)[0];
                        redessinerAnnotations();
                        ouvrirEditeurTexteAnnotation(pickedText.points[0].x, pickedText.points[0].y, pickedText, {
                            clientX: lastCanvasClientX,
                            clientY: lastCanvasClientY,
                            immediateDrag: true,
                            autoValidateOnDrop: true
                        });
                    }
                }, 260);
            }
        }

        annotationState.isDrawing = true;
        try { annoCanvas.setPointerCapture(e.pointerId); } catch (err) { }

        if (annotationState.activeTool === 'eraser') {
            effacerAuPoint(normX, normY);
        } else if (annotationState.activeTool === 'line') {
            const currentStroke = {
                tool: 'line',
                color: annotationState.color,
                size: annotationState.size,
                points: [
                    { x: normX, y: normY },
                    { x: normX, y: normY }
                ]
            };
            annotationState.currentStrokes.push(currentStroke);
            annotationState.currentStroke = currentStroke;
            redessinerAnnotations();
        } else {
            const currentStroke = {
                tool: annotationState.activeTool,
                color: annotationState.color,
                size: annotationState.activeTool === 'highlighter' ? annotationState.highlighterSize : annotationState.size,
                points: [{ x: normX, y: normY, pressure: e.pressure || 0.5 }]
            };
            annotationState.currentStrokes.push(currentStroke);
            annotationState.currentStroke = currentStroke;
            redessinerAnnotations();
        }
    });

    annoCanvas.addEventListener('pointermove', e => {
        lastCanvasClientX = e.clientX;
        lastCanvasClientY = e.clientY;
        if (longPressTextTimer && Math.hypot(e.clientX - longPressDownX, e.clientY - longPressDownY) > 7) {
            clearLongPressTextTimer();
        }
        if (!annotationState.isDrawing) return;
        if (annotationState.penOnly && e.pointerType === 'touch') return;

        const rect = annoCanvas.getBoundingClientRect();
        let normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        let normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

        if (annotationState.activeTool === 'eraser') {
            effacerAuPoint(normX, normY);
        } else if (annotationState.activeTool === 'line' && annotationState.currentStroke) {
            const p0 = annotationState.currentStroke.points[0];
            const dxPx = (normX - p0.x) * rect.width;
            const dyPx = (normY - p0.y) * rect.height;
            const distPx = Math.hypot(dxPx, dyPx);
            if (distPx > 14) {
                const angleDeg = Math.abs(Math.atan2(dyPx, dxPx) * (180 / Math.PI));
                // Magnétisme doux (2°) sur l'horizontale et la verticale pour tracer des barres/lignes parfaites
                if (angleDeg < 2.0 || angleDeg > 178.0) {
                    normY = p0.y;
                } else if (Math.abs(angleDeg - 90) < 2.0) {
                    normX = p0.x;
                }
            }
            annotationState.currentStroke.points[1] = { x: normX, y: normY };
            redessinerAnnotations();
        } else if (annotationState.currentStroke) {
            annotationState.currentStroke.points.push({ x: normX, y: normY, pressure: e.pressure || 0.5 });
            redessinerAnnotations();
        }
    });

    const finishDrawing = async e => {
        clearLongPressTextTimer();
        if (!annotationState.isDrawing) return;
        annotationState.isDrawing = false;
        annotationState.currentStroke = null;
        try { annoCanvas.releasePointerCapture(e.pointerId); } catch (err) { }
        await sauvegarderAnnotationsPageCourante();
    };

    annoCanvas.addEventListener('pointerup', finishDrawing);
    annoCanvas.addEventListener('pointercancel', finishDrawing);
}

// GESTION TACTILE & ERGONOMIE MOBILESHEETS (Tap zones, Swipe progressif, Pédalier Bluetooth)
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
let currentDragDx = 0;
let isSwipingPartition = false;
let lastTouchEndTime = 0;
const swipeContainer = document.getElementById('fullscreen-swipe-container');

if (swipeContainer) {
    swipeContainer.style.touchAction = 'none';

    const onDragStart = (clientX, clientY, target) => {
        const navState = syncScoreNavMachine();
        if ((navState && navState.isSwipeLocked) || annotationState.isEditing || partitionState.type === 'cahier') return false;
        if (target && (target.closest('button') || target.closest('.close-modal') || target.closest('#annotation-toolbar'))) return false;

        touchStartX = clientX;
        touchStartY = clientY;
        touchStartTime = performance.now();
        currentDragDx = 0;
        isSwipingPartition = false;

        if (partitionState.type === 'pdf') {
            positionnerCanvasVoisinsPdf();
        }

        const wrapper = document.getElementById('partition-canvas-wrapper');
        if (wrapper) {
            wrapper.style.transition = 'none';
        }
        return true;
    };

    const onDragMove = (clientX, clientY) => {
        const dx = clientX - touchStartX;
        const dy = clientY - touchStartY;
        const containerW = swipeContainer.clientWidth || window.innerWidth;

        syncScoreNavMachine();
        const evalRes = scoreNavMachine.evaluateSwipe({
            dx,
            dy,
            elapsedMs: Math.max(1, performance.now() - touchStartTime),
            containerWidth: containerW,
            alreadySwiping: isSwipingPartition
        });
        if (!evalRes.allowed || !evalRes.isHorizontalSwipe) return;
        isSwipingPartition = true;
        currentDragDx = evalRes.dragOffsetPx;

        const wrapper = document.getElementById('partition-canvas-wrapper');
        if (wrapper) {
            wrapper.style.transform = `translate3d(${currentDragDx}px, 0, 0)`;
        }
    };

    const onDragEnd = (clientX, clientY, target, event) => {
        const navState = syncScoreNavMachine();
        if (navState && navState.isSwipeLocked) return;

        const diffX = clientX - touchStartX;
        const diffY = clientY - touchStartY;
        const elapsed = Math.max(1, performance.now() - touchStartTime);
        const containerW = swipeContainer.clientWidth || window.innerWidth;

        if (isSwipingPartition) {
            isSwipingPartition = false;
            const evalRes = scoreNavMachine.evaluateSwipe({
                dx: diffX,
                dy: diffY,
                elapsedMs: elapsed,
                containerWidth: containerW,
                alreadySwiping: true
            });
            const delta = evalRes.delta || (diffX < 0 ? 1 : -1);

            if (evalRes.shouldTurn) {
                changerPartitionPage(delta, event, currentDragDx);
            } else {
                if (concertState.isActive && Math.abs(diffX) > 45 && !peutChangerPartitionPage(delta)) {
                    if (delta > 0) afficherToastConcert(t('concert.end_of_setlist'));
                    else afficherToastConcert(t('concert.start_of_setlist'));
                }
                const wrapper = document.getElementById('partition-canvas-wrapper');
                if (wrapper) {
                    wrapper.style.transition = 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)';
                    wrapper.style.transform = 'translate3d(0px, 0px, 0)';
                }
            }
            currentDragDx = 0;
            return;
        }

        // Tap simple (zones gauche 25% / centre 50% / droite 25%)
        if (Math.abs(diffX) < 15 && Math.abs(diffY) < 15) {
            if (target && (target.closest('button') || target.closest('.close-modal') || target.closest('#annotation-toolbar'))) return;

            const rect = swipeContainer.getBoundingClientRect();
            const xRatio = (clientX - rect.left) / rect.width;

            if (xRatio < 0.25) {
                changerPartitionPage(-1, event, 0);
            } else if (xRatio > 0.75) {
                changerPartitionPage(1, event, 0);
            } else {
                togglePartitionHUD(event);
            }
        }
    };

    swipeContainer.addEventListener('touchstart', e => {
        if (e.touches.length === 1) {
            onDragStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
        }
    }, { passive: true });

    swipeContainer.addEventListener('touchmove', e => {
        if (e.touches.length === 1) {
            onDragMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: true });

    swipeContainer.addEventListener('touchend', e => {
        if (e.changedTouches.length === 0) return;
        lastTouchEndTime = performance.now();
        const t = e.changedTouches[0];
        onDragEnd(t.clientX, t.clientY, e.target, e);
    }, { passive: true });

    swipeContainer.addEventListener('touchcancel', () => {
        isSwipingPartition = false;
        currentDragDx = 0;
        const wrapper = document.getElementById('partition-canvas-wrapper');
        if (wrapper) {
            wrapper.style.transition = 'transform 200ms ease';
            wrapper.style.transform = 'translate3d(0px, 0px, 0)';
        }
    }, { passive: true });

    // Support souris (PC / localhost) pour glisser ou cliquer sur les bords
    let isMouseDownOnSwipe = false;
    swipeContainer.addEventListener('mousedown', e => {
        if (performance.now() - lastTouchEndTime < 500) return;
        if (e.button !== 0) return;
        if (onDragStart(e.clientX, e.clientY, e.target)) {
            isMouseDownOnSwipe = true;
        }
    });

    window.addEventListener('mousemove', e => {
        if (!isMouseDownOnSwipe) return;
        onDragMove(e.clientX, e.clientY);
    });

    window.addEventListener('mouseup', e => {
        if (!isMouseDownOnSwipe) return;
        isMouseDownOnSwipe = false;
        onDragEnd(e.clientX, e.clientY, e.target, e);
    });
}

// Prise en charge des pédaliers Bluetooth et touches clavier (Page Turner)
window.addEventListener('keydown', e => {
    const modal = document.getElementById('modal-image-fullscreen');
    if (!modal || modal.style.display === 'none') return;

    if (e.key === 'PageDown' || e.key === 'ArrowRight' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        changerPartitionPage(1);
    } else if (e.key === 'PageUp' || e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        changerPartitionPage(-1);
    } else if (e.key === 'Escape') {
        e.preventDefault();
        fermerModalImage();
    }
});

// Redimensionnement fluide / Rotation de tablette (Portrait <-> Paysage)
window.addEventListener('resize', () => {
    const modal = document.getElementById('modal-image-fullscreen');
    if (modal && modal.style.display !== 'none') {
        clearTimeout(window._pdfResizeTimer);
        window._pdfResizeTimer = setTimeout(() => {
            if (partitionState.type === 'pdf') afficherPagePdf(partitionState.currentIndex, { forceRender: true });
            alignerAnnotationCanvas();
            redessinerAnnotations();
        }, 150);
    }
});

if (typeof window !== 'undefined') {
    window.partitionState = partitionState;
    window.annotationState = annotationState;
    window.ouvrirLecteurPartition = ouvrirLecteurPartition;
    window.changerPartitionPage = changerPartitionPage;
    window.togglePartitionHUD = togglePartitionHUD;
    window.fermerModalImage = fermerModalImage;
    window.ouvrirModalImage = ouvrirModalImage;
    window.ouvrirPdfLocal = ouvrirPdfLocal;
    window.toggleModeAnnotation = toggleModeAnnotation;
    window.choisirOutilAnnotation = choisirOutilAnnotation;
    window.choisirCouleurAnnotation = choisirCouleurAnnotation;
    window.togglePalmRejection = togglePalmRejection;
    window.majAffichagePalmRejectionUI = majAffichagePalmRejectionUI;
    window.annulerDerniereAnnotation = annulerDerniereAnnotation;
    window.effacerToutesAnnotationsPage = effacerToutesAnnotationsPage;
    window.sauvegarderAnnotationsPageCourante = sauvegarderAnnotationsPageCourante;
    window.chargerAnnotationsPageCourante = chargerAnnotationsPageCourante;
    window.getCleAnnotationCourante = getCleAnnotationCourante;
    window.redessinerAnnotations = redessinerAnnotations;
}

// ==========================================
// --- JALON 11 : CAHIER MANUSCRIT & PORTÉES ---
// ==========================================
const cahierState = {
    type: 'simple', // 'simple' | 'double'
    measuresPerSystem: 4,
    afficherBarresMesures: true,
    systemsCount: 1,
    maxSystems: 8,
    titre: '',
    dateCreation: null
};

function ouvrirNouveauCahierModal() {
    const modal = document.getElementById('modal-cahier-choix');
    if (modal) modal.style.display = 'flex';
}

function fermerModalCahierChoix() {
    const modal = document.getElementById('modal-cahier-choix');
    if (modal) modal.style.display = 'none';
}

function demarrerCahier(type = 'simple') {
    fermerModalCahierChoix();

    cahierState.type = type;
    cahierState.afficherBarresMesures = true;
    cahierState.systemsCount = 1;
    cahierState.maxSystems = (type === 'simple') ? 8 : 5;
    cahierState.dateCreation = new Date();
    cahierState.titre = '';

    const btnMeasures = document.getElementById('btn-cahier-toggle-measures');
    if (btnMeasures) {
        btnMeasures.classList.remove('active');
        btnMeasures.title = t('cahier.hide_barlines');
    }

    partitionState.type = 'cahier';
    partitionState.sourceNom = 'cahier_' + Date.now();
    partitionState.titre = type === 'double' ? t('cahier.header_piano') : t('cahier.header_single');
    partitionState.currentIndex = 0;
    partitionState.nbPages = 1;

    // Réinitialiser les traits d'annotations pour cette nouvelle page vierge
    annotationState.currentStrokes = [];
    annotationState.currentStroke = null;

    const modal = document.getElementById('modal-image-fullscreen');
    if (modal) modal.style.display = 'flex';

    // Cacher les autres conteneurs de rendu
    const imgEl = document.getElementById('image-fullscreen-src');
    if (imgEl) imgEl.style.display = 'none';
    const pdfEl = document.getElementById('pdf-render-canvas');
    if (pdfEl) pdfEl.style.display = 'none';
    const prevEl = document.getElementById('pdf-prerender-prev-canvas');
    if (prevEl) prevEl.style.display = 'none';
    const nextEl = document.getElementById('pdf-prerender-next-canvas');
    if (nextEl) nextEl.style.display = 'none';
    const leadSheetEl = document.getElementById('concert-lead-sheet');
    if (leadSheetEl) leadSheetEl.style.display = 'none';
    syncScoreNavMachine();

    // Afficher et dessiner le canvas de portées
    const staffCanvas = document.getElementById('cahier-staff-canvas');
    if (staffCanvas) staffCanvas.style.display = 'block';
    dessinerPorteesCahier();

    // Mettre à jour le HUD
    majHUDPartition();

    // Activer le mode annotation avec le stylo par défaut
    toggleModeAnnotation(true);
    choisirOutilAnnotation('pen');
    setTimeout(() => {
        alignerAnnotationCanvas();
        redessinerAnnotations();
    }, 40);
}

function ajouterSystemeCahier() {
    if (cahierState.systemsCount >= cahierState.maxSystems) {
        if (typeof afficherToastConcert === 'function') {
            afficherToastConcert(t('cahier.max_systems_toast', { max: cahierState.maxSystems }));
        }
        return;
    }
    cahierState.systemsCount++;
    dessinerPorteesCahier();
    redessinerAnnotations();
}

function toggleMesuresCahier() {
    cahierState.afficherBarresMesures = !cahierState.afficherBarresMesures;
    const btn = document.getElementById('btn-cahier-toggle-measures');
    if (btn) {
        if (!cahierState.afficherBarresMesures) {
            btn.classList.add('active');
            btn.title = t('cahier.restore_barlines');
        } else {
            btn.classList.remove('active');
            btn.title = t('cahier.hide_barlines');
        }
    }
    dessinerPorteesCahier();
    redessinerAnnotations();
}

function dessinerPorteesCahier() {
    const canvas = document.getElementById('cahier-staff-canvas');
    if (!canvas) return;
    canvas.width = 1200;
    canvas.height = 1700;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fond blanc pur
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const xLeft = 76;
    const xRight = 1124;
    const staffW = xRight - xLeft;
    const sp = 14;
    const staffH = 4 * sp;
    const inkColor = '#181818';

    ctx.strokeStyle = inkColor;
    ctx.fillStyle = inkColor;
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';

    const dessinerPortee5Lignes = (yStart) => {
        ctx.lineWidth = 1.15;
        ctx.strokeStyle = inkColor;
        for (let line = 0; line < 5; line++) {
            const y = Math.round(yStart + line * sp) + 0.5;
            ctx.beginPath();
            ctx.moveTo(xLeft, y);
            ctx.lineTo(xRight, y);
            ctx.stroke();
        }
    };

    const dessinerBarreVerticale = (xPos, yTop, yBottom, width = 1.35) => {
        const x = Math.round(xPos) + 0.5;
        ctx.lineWidth = width;
        ctx.strokeStyle = inkColor;
        ctx.beginPath();
        ctx.moveTo(x, Math.round(yTop));
        ctx.lineTo(x, Math.round(yBottom) + 1);
        ctx.stroke();
    };

    const dessinerDoubleBarreFinale = (yTop, yBottom) => {
        // Barre fine intérieure
        dessinerBarreVerticale(xRight - 7, yTop, yBottom, 1.35);
        // Barre épaisse extérieure parfaitement alignée avec les lignes de haut et de bas
        ctx.fillStyle = inkColor;
        ctx.fillRect(Math.round(xRight) - 3.5, Math.round(yTop), 4.2, Math.round(yBottom - yTop) + 1);
    };

    if (cahierState.type === 'simple') {
        const stepY = 175;
        const startY = 220;
        for (let i = 0; i < cahierState.systemsCount; i++) {
            const yStaff = startY + i * stepY;

            dessinerPortee5Lignes(yStaff);
            dessinerBarreVerticale(xLeft, yStaff, yStaff + staffH, 1.45);

            if (cahierState.afficherBarresMesures !== false) {
                for (let m = 1; m < 4; m++) {
                    const mx = xLeft + m * (staffW / 4);
                    dessinerBarreVerticale(mx, yStaff, yStaff + staffH, 1.35);
                }
            }

            const isLast = (i === cahierState.systemsCount - 1);
            if (isLast) {
                dessinerDoubleBarreFinale(yStaff, yStaff + staffH);
            } else {
                dessinerBarreVerticale(xRight, yStaff, yStaff + staffH, 1.45);
            }
        }
    } else {
        const stepY = 280;
        const startY = 230;
        const gap = 64;
        const totalDoubleH = staffH + gap + staffH;

        for (let i = 0; i < cahierState.systemsCount; i++) {
            const yTop = startY + i * stepY;
            const yTreble = yTop;
            const yBass = yTop + staffH + gap;

            dessinerPortee5Lignes(yTreble);
            dessinerPortee5Lignes(yBass);
            dessinerBarreVerticale(xLeft, yTop, yTop + totalDoubleH, 1.65);

            if (cahierState.afficherBarresMesures !== false) {
                for (let m = 1; m < 4; m++) {
                    const mx = xLeft + m * (staffW / 4);
                    dessinerBarreVerticale(mx, yTreble, yTreble + staffH, 1.35);
                    dessinerBarreVerticale(mx, yBass, yBass + staffH, 1.35);
                }
            }

            const isLast = (i === cahierState.systemsCount - 1);
            if (isLast) {
                dessinerDoubleBarreFinale(yTop, yTop + totalDoubleH);
            } else {
                dessinerBarreVerticale(xRight, yTop, yTop + totalDoubleH, 1.45);
            }
        }
    }
}

async function ouvrirModalCahierSave() {
    if (typeof validerTexteAnnotationActif === 'function' && textOverlayState && textOverlayState.active) {
        await validerTexteAnnotationActif();
    }
    const modal = document.getElementById('modal-cahier-save');
    if (!modal) return;

    const inputTitre = document.getElementById('cahier-input-titre');
    if (inputTitre) {
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
        const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        inputTitre.value = t('cahier.default_title', { date: dateStr, time: timeStr });
        inputTitre.removeAttribute('placeholder');
    }

    const selectCat = document.getElementById('cahier-select-categorie');
    if (selectCat) {
        selectCat.innerHTML = '';
        const cats = (typeof SOUS_CATEGORIES === 'object' && SOUS_CATEGORIES)
            ? Object.keys(SOUS_CATEGORIES)
            : [getCategorieParDefaut()];
        cats.forEach((c, idx) => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            if (idx === 0) opt.selected = true;
            selectCat.appendChild(opt);
        });
        majSousCategoriesCahier();
    }

    modal.style.display = 'flex';
}

function fermerModalCahierSave() {
    const modal = document.getElementById('modal-cahier-save');
    if (modal) modal.style.display = 'none';
}

function majSousCategoriesCahier() {
    const selectCat = document.getElementById('cahier-select-categorie');
    const selectSousCat = document.getElementById('cahier-select-sous-categorie');
    if (!selectCat || !selectSousCat) return;

    const cat = selectCat.value;
    const sousCats = (typeof SOUS_CATEGORIES === 'object' && SOUS_CATEGORIES && Array.isArray(SOUS_CATEGORIES[cat]))
        ? SOUS_CATEGORIES[cat]
        : [];

    selectSousCat.innerHTML = '';
    if (sousCats.length > 0) {
        selectSousCat.style.display = 'block';
        sousCats.forEach((sc, idx) => {
            const opt = document.createElement('option');
            opt.value = sc;
            opt.textContent = sc;
            if (idx === 0) opt.selected = true;
            selectSousCat.appendChild(opt);
        });
        selectSousCat.value = sousCats[0];
    } else {
        selectSousCat.style.display = 'none';
    }
}

function creerCanvasCompositeCahier() {
    const staffCanvas = document.getElementById('cahier-staff-canvas');
    if (!staffCanvas) return null;

    const comp = document.createElement('canvas');
    comp.width = staffCanvas.width;
    comp.height = staffCanvas.height;
    const ctx = comp.getContext('2d');
    if (!ctx) return null;

    // 1. Fond papier et portées
    ctx.drawImage(staffCanvas, 0, 0);

    // 2. Traits, lignes droites, surligneur et textes superposés
    if (annotationState.currentStrokes && annotationState.currentStrokes.length > 0) {
        const scaleRef = comp.width / 1000;
        annotationState.currentStrokes.forEach(stroke => {
            dessinerStrokeSurContext(ctx, stroke, comp.width, comp.height, scaleRef);
        });
    }

    return comp;
}

async function genererCahierPdfBlob(compositeCanvas, titre) {
    const jpegBlob = await new Promise(resolve => compositeCanvas.toBlob(resolve, 'image/jpeg', 0.95));
    const arrayBuffer = await jpegBlob.arrayBuffer();
    const jpegBytes = new Uint8Array(arrayBuffer);

    const ptWidth = 595.28;
    const ptHeight = 841.89;
    const contentStream = `q ${ptWidth.toFixed(2)} 0 0 ${ptHeight.toFixed(2)} 0 0 cm /Im1 Do Q`;

    const parts = [];
    const offsets = [];
    let pos = 0;

    function addText(str) {
        const enc = new TextEncoder().encode(str);
        parts.push(enc);
        pos += enc.length;
    }
    function addBytes(bytes) {
        parts.push(bytes);
        pos += bytes.length;
    }

    addText('%PDF-1.4\n');

    offsets.push(pos);
    addText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    offsets.push(pos);
    addText('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

    offsets.push(pos);
    addText(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptWidth.toFixed(2)} ${ptHeight.toFixed(2)}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);

    offsets.push(pos);
    addText(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${compositeCanvas.width} /Height ${compositeCanvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
    addBytes(jpegBytes);
    addText('\nendstream\nendobj\n');

    offsets.push(pos);
    addText(`5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`);

    const startXref = pos;
    addText('xref\n0 6\n0000000000 65535 f \n');
    for (let i = 0; i < offsets.length; i++) {
        addText(offsets[i].toString().padStart(10, '0') + ' 00000 n \n');
    }
    addText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`);

    return new Blob(parts, { type: 'application/pdf' });
}

async function sauvegarderCahierNouvelItem() {
    const inputTitre = document.getElementById('cahier-input-titre');
    const selectCat = document.getElementById('cahier-select-categorie');
    const selectSousCat = document.getElementById('cahier-select-sous-categorie');
    const btn = document.getElementById('cahier-btn-ajouter-item');

    const titre = (inputTitre && inputTitre.value.trim()) || t('cahier.title');
    const categorie = (selectCat && selectCat.value) || getCategorieParDefaut();
    const sousCat = (selectSousCat && selectSousCat.style.display !== 'none') ? selectSousCat.value : '';

    const comp = creerCanvasCompositeCahier();
    if (!comp) return;

    if (btn) {
        btn.disabled = true;
        btn.textContent = t('common.saving');
    }

    try {
        const pngBlob = await new Promise(resolve => comp.toBlob(resolve, 'image/png'));
        const safeTitre = titre.replace(/[^a-zA-Z0-9_\-]/g, '_');
        const fileName = `cahier_${Date.now()}_${safeTitre}.png`;
        const file = new File([pngBlob], fileName, { type: 'image/png' });

        const formData = new FormData();
        formData.append('nom', titre);
        formData.append('type_item', categorie);
        if (sousCat) formData.append('sous_categorie', sousCat);
        formData.append('fichiers', file);

        await apiFetch('/vocabulaire', {
            method: 'POST',
            body: formData
        });

        if (typeof ecrireLocal === 'function' && annotationState.currentStrokes) {
            try {
                const key = `annot_${fileName}_p0`;
                await ecrireLocal('annotations', {
                    id: key,
                    strokes: JSON.parse(JSON.stringify(annotationState.currentStrokes)),
                    updatedAt: Date.now()
                });
            } catch (e) {
                console.warn("Échec sauvegarde vectorielle IndexedDB des annotations du cahier :", e);
            }
        }

        fermerModalCahierSave();
        fermerModalImage(true);
        if (typeof chargerVocabulaireApi === 'function') await chargerVocabulaireApi();

        if (typeof afficherToastConcert === 'function') {
            afficherToastConcert(t('cahier.saved_toast', { title: titre }));
        }
    } catch (e) {
        console.error("Erreur sauvegarde du cahier :", e);
        alert(t('cahier.save_error', { error: e.message }));
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg viewBox="0 0 24 24" style="width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg><span>${t('common.add')}</span>`;
        }
    }
}

async function exporterCahierPdf() {
    const inputTitre = document.getElementById('cahier-input-titre');
    const titre = (inputTitre && inputTitre.value.trim()) || t('cahier.title');
    const comp = creerCanvasCompositeCahier();
    if (!comp) return;

    try {
        const safeTitre = titre.replace(/[^a-zA-Z0-9_\-]/g, '_');
        const nomFichier = `${safeTitre}.pdf`;
        const pdfBlob = await genererCahierPdfBlob(comp, titre);
        await telechargerBlob(pdfBlob, nomFichier);
        if (typeof afficherToastConcert === 'function') {
            afficherToastConcert(t('cahier.exported_toast', { file: nomFichier }));
        }
    } catch (e) {
        console.error("Erreur export PDF du cahier :", e);
        alert(t('cahier.export_error', { error: e.message }));
    }
}

function quitterCahierSansSauvegarder() {
    fermerModalCahierSave();
    fermerModalImage(true);
}

if (typeof window !== 'undefined') {
    window.cahierState = cahierState;
    window.ouvrirNouveauCahierModal = ouvrirNouveauCahierModal;
    window.fermerModalCahierChoix = fermerModalCahierChoix;
    window.demarrerCahier = demarrerCahier;
    window.ajouterSystemeCahier = ajouterSystemeCahier;
    window.dessinerPorteesCahier = dessinerPorteesCahier;
    window.ouvrirModalCahierSave = ouvrirModalCahierSave;
    window.fermerModalCahierSave = fermerModalCahierSave;
    window.majSousCategoriesCahier = majSousCategoriesCahier;
    window.creerCanvasCompositeCahier = creerCanvasCompositeCahier;
    window.genererCahierPdfBlob = genererCahierPdfBlob;
    window.sauvegarderCahierNouvelItem = sauvegarderCahierNouvelItem;
    window.exporterCahierPdf = exporterCahierPdf;
    window.quitterCahierSansSauvegarder = quitterCahierSansSauvegarder;
    window.supprimerTexteAnnotationActif = supprimerTexteAnnotationActif;
}



// ==========================================
// --- MOTEUR TRIEUR EXPRESS (INBOX & LOTS) ---
// ==========================================

let trieurQueue = [];
let trieurContext = { isIReal: false, defaultPlaylistName: '', totalInitial: 0, mode: 'rapide' };
let trieurStats = { created: 0, merged: 0, probableDuplicates: [] };
let currentInboxFile = null;
let currentInboxBase64Array = [];
let currentInboxMime = null;
let itemFusionCible = null;
let itemProbableCible = null;
let trieurCategorieGlobale = 'Morceaux';
let trieurSousCategoriesGlobales = [];
let trieurTraitesCount = 0;

async function traiterInboxZip(event) {
    const rawFiles = event.target.files; if (!rawFiles || rawFiles.length === 0) return;
    const btn = document.getElementById('btn-inbox-zip-trigger') || event.target.previousElementSibling;
    const originalHtml = btn ? btn.innerHTML : '';
    if (btn) { btn.innerHTML = t('common.loading'); btn.disabled = true; }

    try {
        const files = Array.from(rawFiles);
        const queue = [];
        const sources = new Map();
        const fileToEntry = (file) => ({
            name: file.name,
            async: () => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            })
        });

        for (const file of files) {
            const fileNameLower = (file.name || '').toLowerCase();
            const isZipMime = ['application/zip', 'application/x-zip-compressed', 'application/x-zip'].includes(file.type);
            if (fileNameLower.endsWith('.zip') || isZipMime) {
                const zip = await JSZip.loadAsync(file);
                zip.forEach((relativePath, zipEntry) => {
                    if (zipEntry.dir) return;
                    sources.set(zipEntry.name, zipEntry);
                });
            } else {
                sources.set(file.name, fileToEntry(file));
            }
        }

        for (const group of LibraryDomain.groupImportFiles(Array.from(sources.keys()))) {
            queue.push({
                baseName: group.baseName,
                titre: group.baseName,
                ext: group.ext,
                entries: group.names.map(n => {
                    const src = sources.get(n);
                    return src.name === n ? src : { name: n, async: (...a) => src.async(...a) };
                })
            });
        }

        if (queue.length === 0) return alert(t('sorter.no_valid_files'));
        if (typeof afficherVue === 'function') afficherVue('bibliotheque');
        ouvrirPreparationTrieur(queue, { isIReal: false });

    } catch (err) {
        console.error("Erreur import trieur :", err);
        alert(t('sorter.corrupted_error'));
    }
    finally {
        if (btn) { btn.innerHTML = originalHtml; btn.disabled = false; }
        event.target.value = "";
    }
}

function ouvrirPreparationTrieur(queue, options = {}) {
    trieurQueue = [...queue];
    trieurContext = {
        isIReal: !!options.isIReal,
        defaultPlaylistName: options.defaultPlaylistName || '',
        totalInitial: queue.length,
        mode: 'rapide'
    };
    trieurStats = { created: 0, merged: 0, probableDuplicates: [] };
    currentInboxFile = null;
    itemFusionCible = null;
    itemProbableCible = null;

    const modal = document.getElementById('modal-trieur');
    if (!modal) return;
    modal.style.display = 'flex';

    document.getElementById('trieur-vue-preparation').style.display = 'block';
    document.getElementById('trieur-vue-cours').style.display = 'none';
    document.getElementById('trieur-vue-bilan').style.display = 'none';

    document.getElementById('trieur-prep-subtitle').innerText = t('sorter.prep_subtitle', { count: queue.length });
    document.getElementById('btn-trieur-lancer').innerText = t('sorter.start_import_btn', { count: queue.length });

    initChipsPreparationTrieur();

    const blocIreal = document.getElementById('trieur-prep-bloc-ireal-setlist');
    if (blocIreal) {
        if (trieurContext.isIReal) {
            blocIreal.style.display = 'block';
            const check = document.getElementById('trieur-checkbox-creer-setlist');
            if (check) check.checked = true;
            const input = document.getElementById('trieur-input-nom-setlist');
            if (input) input.value = trieurContext.defaultPlaylistName;
        } else {
            blocIreal.style.display = 'none';
        }
    }

    choisirModeTrieur('rapide');
}

function initChipsPreparationTrieur() {
    const container = document.getElementById('trieur-prep-chips-categorie');
    if (!container) return;
    container.innerHTML = "";
    const defaultMorceaux = getNomCategorieMorceaux(SOUS_CATEGORIES);
    for (const cat in SOUS_CATEGORIES) {
        const isActive = (cat === defaultMorceaux);
        const cls = isActive ? 'btn-ghost-blue active' : 'btn-ghost-neutral';
        container.innerHTML += `<button type="button" class="chip btn-action ${cls}" onclick="selectChipPreparationTrieur('categorie', '${cat}')">${cat}</button>`;
    }
    renderSousCategoriesPreparationTrieur(defaultMorceaux);
}

function selectChipPreparationTrieur(groupType, value) {
    const group = document.getElementById(`trieur-prep-chips-${groupType}`);
    if (!group) return;
    const chips = group.querySelectorAll('.chip');
    if (groupType === 'sous-cat') {
        const clickedChip = Array.from(chips).find(c => c.innerText.trim() === value);
        if (clickedChip) {
            if (clickedChip.classList.contains('active')) {
                clickedChip.classList.remove('active', 'btn-ghost-blue');
                clickedChip.classList.add('btn-ghost-neutral');
            } else {
                clickedChip.classList.add('active', 'btn-ghost-blue');
                clickedChip.classList.remove('btn-ghost-neutral');
            }
        }
    } else {
        chips.forEach(c => { c.classList.remove('active', 'btn-ghost-blue'); c.classList.add('btn-ghost-neutral'); });
        const activeChip = Array.from(chips).find(c => c.innerText.trim() === value);
        if (activeChip) { activeChip.classList.add('active', 'btn-ghost-blue'); activeChip.classList.remove('btn-ghost-neutral'); }
        if (groupType === 'categorie') renderSousCategoriesPreparationTrieur(value);
    }
}

function renderSousCategoriesPreparationTrieur(categorie) {
    const bloc = document.getElementById('trieur-prep-bloc-sous-cat');
    const chipGroup = document.getElementById('trieur-prep-chips-sous-cat');
    if (!bloc || !chipGroup) return;
    const listePuces = getSousCategoriesPour(categorie);
    if (listePuces.length > 0) {
        bloc.style.display = 'block';
        chipGroup.innerHTML = '';
        listePuces.forEach((sc) => {
            const safeVal = sc.replace(/'/g, "\\'");
            chipGroup.innerHTML += `<button type="button" class="chip btn-action btn-ghost-neutral" onclick="selectChipPreparationTrieur('sous-cat', '${safeVal}')">${sc}</button>`;
        });
    } else {
        bloc.style.display = 'none';
        chipGroup.innerHTML = '';
    }
}

function choisirModeTrieur(mode) {
    trieurContext.mode = (mode === 'prudent') ? 'prudent' : 'rapide';
    const btnRapide = document.getElementById('trieur-opt-mode-rapide');
    const btnPrudent = document.getElementById('trieur-opt-mode-prudent');
    if (btnRapide && btnPrudent) {
        if (trieurContext.mode === 'rapide') {
            btnRapide.classList.add('active', 'btn-ghost-blue');
            btnRapide.classList.remove('btn-ghost-neutral');
            btnPrudent.classList.remove('active', 'btn-ghost-blue');
            btnPrudent.classList.add('btn-ghost-neutral');
        } else {
            btnPrudent.classList.add('active', 'btn-ghost-blue');
            btnPrudent.classList.remove('btn-ghost-neutral');
            btnRapide.classList.remove('active', 'btn-ghost-blue');
            btnRapide.classList.add('btn-ghost-neutral');
        }
    }
}

async function demarrerImportTrieur() {
    const catActive = document.querySelector('#trieur-prep-chips-categorie .chip.active');
    trieurCategorieGlobale = catActive ? catActive.innerText.trim() : getNomCategorieMorceaux(SOUS_CATEGORIES);
    trieurSousCategoriesGlobales = Array.from(document.querySelectorAll('#trieur-prep-chips-sous-cat .chip.active')).map(c => c.innerText.trim());

    if (trieurContext.isIReal) {
        const checkCreer = document.getElementById('trieur-checkbox-creer-setlist');
        const inputNom = document.getElementById('trieur-input-nom-setlist');
        if (checkCreer && checkCreer.checked) {
            const nomSetlist = inputNom ? inputNom.value.trim() : '';
            if (!nomSetlist) {
                alert(t('sorter.error_empty_setlist_name'));
                if (inputNom) inputNom.focus();
                return;
            }
            const catCible = trieurCategorieGlobale || getNomCategorieMorceaux(SOUS_CATEGORIES);
            const existantes = (SOUS_CATEGORIES[catCible] || []).map(s => s.toLowerCase().trim());
            if (existantes.includes(nomSetlist.toLowerCase())) {
                alert(t('sorter.error_setlist_exists', { name: nomSetlist }));
                if (inputNom) inputNom.focus();
                return;
            }
            if (!SOUS_CATEGORIES[catCible]) SOUS_CATEGORIES[catCible] = [];
            SOUS_CATEGORIES[catCible].push(nomSetlist);
            sauvegarderCategoriesConfig(SOUS_CATEGORIES);
            if (!trieurSousCategoriesGlobales.includes(nomSetlist)) {
                trieurSousCategoriesGlobales.push(nomSetlist);
            }
        }
    }

    document.getElementById('trieur-vue-preparation').style.display = 'none';
    document.getElementById('trieur-vue-cours').style.display = 'block';
    document.getElementById('trieur-vue-bilan').style.display = 'none';

    const cadreExistant = document.getElementById('trieur-cadre-existant');
    if (cadreExistant) cadreExistant.style.display = 'none';
    const choixPrudent = document.getElementById('trieur-choix-prudent');
    if (choixPrudent) choixPrudent.style.display = 'none';

    trieurTraitesCount = 0;
    majProgressionTrieur(0, trieurContext.totalInitial);
    await traiterSuiteTrieur();
}

function majProgressionTrieur(actuel, total) {
    const pct = total > 0 ? Math.min(100, Math.round((actuel / total) * 100)) : 100;
    const txt = document.getElementById('trieur-progression-texte');
    if (txt) txt.innerText = t('sorter.progress_file_n_of_total', { current: actuel, total: total });
    const bar = document.getElementById('trieur-progress-bar');
    if (bar) bar.style.width = pct + '%';
}

function mimeInboxPourExt(ext) {
    if (['mp3', 'wav', 'm4a', 'ogg', 'webm', 'flac', 'aac'].includes(ext)) return `audio/${ext === 'mp3' ? 'mpeg' : ext}`;
    return ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
}

async function lireEntreesInbox(fileInfo) {
    if (fileInfo.isIReal) return { b64Array: [], mime: 'application/x-ireal' };
    const b64Array = [];
    for (const entry of (fileInfo.entries || [])) b64Array.push(await entry.async("base64"));
    return { b64Array, mime: mimeInboxPourExt(fileInfo.ext) };
}

async function appliquerFichierInbox(fileInfo, b64Array, mime, titre, categorie, sousCategories, itemCible) {
    const ext = fileInfo.ext;
    const isAudio = ['mp3', 'wav', 'm4a', 'ogg', 'webm', 'flac', 'aac'].includes(ext);
    const savedFileNames = [];
    if (!fileInfo.isIReal) {
        const cleanName = titre.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20);
        for (let i = 0; i < b64Array.length; i++) {
            const suffix = b64Array.length > 1 ? `_${i + 1}` : '';
            const fileNameToSave = `file_${Date.now()}_${cleanName}${suffix}.${ext}`;
            await sauvegarderFichierLocal(fileNameToSave, `data:${mime};base64,${b64Array[i]}`);
            savedFileNames.push(fileNameToSave);
        }
    }

    const sousCats = Array.isArray(sousCategories) ? sousCategories.slice() : [];
    if (fileInfo.playlistName && !sousCats.includes(fileInfo.playlistName)) sousCats.push(fileInfo.playlistName);

    const importData = {
        titre, categorie,
        sous_categories: sousCats,
        compositeur: fileInfo.compositeur || null,
        style: fileInfo.style || null,
        tonalite: fileInfo.key || null,
        grille: fileInfo.singleUrl || null,
        fichier_image: isAudio ? [] : savedFileNames,
        fichier_audio: isAudio ? savedFileNames[0] : null
    };

    if (itemCible) {
        const merged = LibraryDomain.mergeImport(itemCible, importData);
        const saved = await apiFetch(`/vocabulaire/${itemCible.id}`, { method: 'PUT', body: JSON.stringify(merged) });
        const idx = vocabulaireCache.findIndex(v => v.id === itemCible.id);
        if (idx !== -1 && saved && saved.id === itemCible.id) vocabulaireCache[idx] = saved;
        return saved || merged;
    } else {
        const created = LibraryDomain.createItemFromImport(importData);
        const saved = await apiFetch(`/vocabulaire`, { method: 'POST', body: JSON.stringify(created) });
        vocabulaireCache.push(saved);
        return saved || created;
    }
}

async function traiterSuiteTrieur() {
    while (trieurQueue.length > 0) {
        if (trieurContext.mode === 'rapide') {
            const nextFile = trieurQueue.shift();
            trieurTraitesCount++;
            majProgressionTrieur(trieurTraitesCount, trieurContext.totalInitial);

            const fileNameDisp = nextFile.isIReal
                ? `iReal Pro : ${nextFile.titre}`
                : `${nextFile.baseName}.${nextFile.ext}`;
            const elCurrent = document.getElementById('trieur-nom-fichier-courant');
            if (elCurrent) elCurrent.innerText = fileNameDisp;

            const match = LibraryDomain.findMatch(vocabulaireCache, nextFile.titre, { categorie: trieurCategorieGlobale });
            const { b64Array, mime } = await lireEntreesInbox(nextFile);

            if (match.type === 'exact') {
                await appliquerFichierInbox(nextFile, b64Array, mime, nextFile.titre, trieurCategorieGlobale, trieurSousCategoriesGlobales, match.item);
                trieurStats.merged++;
            } else {
                const created = await appliquerFichierInbox(nextFile, b64Array, mime, nextFile.titre, trieurCategorieGlobale, trieurSousCategoriesGlobales, null);
                trieurStats.created++;
                if (match.type === 'probable') {
                    trieurStats.probableDuplicates.push({ item: created, match: match.item, candidateTitre: nextFile.titre });
                }
            }
            await new Promise(r => setTimeout(r, 12));
        } else {
            // Mode Prudent
            const nextFile = trieurQueue[0];
            const fileNameDisp = nextFile.isIReal
                ? `iReal Pro : ${nextFile.titre}`
                : `${nextFile.baseName}.${nextFile.ext}`;
            const elCurrent = document.getElementById('trieur-nom-fichier-courant');
            if (elCurrent) elCurrent.innerText = fileNameDisp;

            const match = LibraryDomain.findMatch(vocabulaireCache, nextFile.titre, { categorie: trieurCategorieGlobale });

            if (match.type === 'exact') {
                trieurQueue.shift();
                trieurTraitesCount++;
                majProgressionTrieur(trieurTraitesCount, trieurContext.totalInitial);
                const { b64Array, mime } = await lireEntreesInbox(nextFile);
                await appliquerFichierInbox(nextFile, b64Array, mime, nextFile.titre, trieurCategorieGlobale, trieurSousCategoriesGlobales, match.item);
                trieurStats.merged++;
                await new Promise(r => setTimeout(r, 12));
                continue;
            }

            if (match.type !== 'probable') {
                // Nouvel item (<80% de similarité) : créé automatiquement même en Mode Prudent
                trieurQueue.shift();
                trieurTraitesCount++;
                majProgressionTrieur(trieurTraitesCount, trieurContext.totalInitial);
                const { b64Array, mime } = await lireEntreesInbox(nextFile);
                await appliquerFichierInbox(nextFile, b64Array, mime, nextFile.titre, trieurCategorieGlobale, trieurSousCategoriesGlobales, null);
                trieurStats.created++;
                await new Promise(r => setTimeout(r, 12));
                continue;
            }

            // Arrêt UNIQUEMENT si doublon probable (match.type === 'probable')
            currentInboxFile = trieurQueue.shift();
            const loaded = await lireEntreesInbox(currentInboxFile);
            currentInboxBase64Array = loaded.b64Array;
            currentInboxMime = loaded.mime;
            majProgressionTrieur(trieurTraitesCount + 1, trieurContext.totalInitial);

            if (elCurrent) elCurrent.innerText = fileNameDisp;

            const elExistant = document.getElementById('trieur-titre-existant');
            if (elExistant) elExistant.innerText = match.item.titre;

            itemFusionCible = match.item;
            itemProbableCible = match.item;

            const cadreExistant = document.getElementById('trieur-cadre-existant');
            if (cadreExistant) cadreExistant.style.display = 'block';
            const choixPrudent = document.getElementById('trieur-choix-prudent');
            if (choixPrudent) choixPrudent.style.display = 'grid';
            return;
        }
    }

    afficherBilanTrieur();
}

async function validerCreationTrieur() {
    if (!currentInboxFile) return;
    const titreFinal = currentInboxFile.titre || "Sans_Titre";
    await appliquerFichierInbox(currentInboxFile, currentInboxBase64Array, currentInboxMime, titreFinal, trieurCategorieGlobale, trieurSousCategoriesGlobales, null);
    trieurStats.created++;
    trieurTraitesCount++;
    currentInboxFile = null;
    itemFusionCible = null;
    itemProbableCible = null;

    const cadreExistant = document.getElementById('trieur-cadre-existant');
    if (cadreExistant) cadreExistant.style.display = 'none';
    const choixPrudent = document.getElementById('trieur-choix-prudent');
    if (choixPrudent) choixPrudent.style.display = 'none';

    await traiterSuiteTrieur();
}

async function validerFusionTrieur() {
    if (!currentInboxFile || !itemFusionCible) return;
    // On conserve le titre existant dans la bibliothèque
    await appliquerFichierInbox(currentInboxFile, currentInboxBase64Array, currentInboxMime, itemFusionCible.titre, trieurCategorieGlobale, trieurSousCategoriesGlobales, itemFusionCible);
    trieurStats.merged++;
    trieurTraitesCount++;
    currentInboxFile = null;
    itemFusionCible = null;
    itemProbableCible = null;

    const cadreExistant = document.getElementById('trieur-cadre-existant');
    if (cadreExistant) cadreExistant.style.display = 'none';
    const choixPrudent = document.getElementById('trieur-choix-prudent');
    if (choixPrudent) choixPrudent.style.display = 'none';

    await traiterSuiteTrieur();
}

function afficherBilanTrieur() {
    document.getElementById('trieur-vue-preparation').style.display = 'none';
    document.getElementById('trieur-vue-cours').style.display = 'none';
    document.getElementById('trieur-vue-bilan').style.display = 'block';

    document.getElementById('trieur-bilan-crees').innerText = trieurStats.created;
    document.getElementById('trieur-bilan-enrichis').innerText = trieurStats.merged;
    document.getElementById('trieur-bilan-probables').innerText = trieurStats.probableDuplicates.length;

    const listContainer = document.getElementById('trieur-bilan-liste-probables-container');
    const listEl = document.getElementById('trieur-bilan-liste-probables');
    if (listContainer && listEl) {
        if (trieurStats.probableDuplicates.length > 0) {
            listContainer.style.display = 'block';
            let html = '';
            trieurStats.probableDuplicates.forEach(dup => {
                const safeTitre = (dup.candidateTitre || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const safeMatch = (dup.match ? dup.match.titre : '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                html += `<div style="padding: 4px 0; border-bottom: 1px solid var(--border-color);">
                    <strong>${safeTitre}</strong> <span style="color:var(--text-muted);">${t('sorter.similar_to')}</span> <em>${safeMatch}</em>
                </div>`;
            });
            listEl.innerHTML = html;
        } else {
            listContainer.style.display = 'none';
            listEl.innerHTML = '';
        }
    }
}

function fermerTrieur() {
    const modal = document.getElementById('modal-trieur');
    if (modal) modal.style.display = 'none';
    trieurQueue = [];
    currentInboxFile = null;
    currentInboxBase64Array = [];
    itemFusionCible = null;
    itemProbableCible = null;
    chargerVocabulaireApi();
}


// ==========================================
// --- WAKE LOCK & NOTIFICATIONS ARRIÈRE-PLAN ---
// ==========================================

let wakeLockSentinel = null;

async function activerWakeLock() {
    try {
        if ('wakeLock' in navigator && !wakeLockSentinel) {
            wakeLockSentinel = await navigator.wakeLock.request('screen');
            wakeLockSentinel.addEventListener('release', () => {
                wakeLockSentinel = null;
            });
            console.log("Wake Lock activé : mise en veille écran suspendue.");
        }
    } catch (err) {
        console.warn("Wake Lock non supporté ou non autorisé :", err);
    }
}

async function desactiverWakeLock() {
    if (wakeLockSentinel) {
        try {
            await wakeLockSentinel.release();
        } catch (e) { }
        wakeLockSentinel = null;
        console.log("Wake Lock désactivé.");
    }
}

const NOTIF_TIMER_ID = 1000;
const NOTIF_BREAK_ID = 1000;

async function initNotifications() {
    if (window.Capacitor && Capacitor.isNativePlatform()) {
        try {
            const { LocalNotifications } = Capacitor.Plugins;
            const perm = await LocalNotifications.requestPermissions();
            console.log("Permissions notifications Capacitor :", perm);
            await LocalNotifications.createChannel({
                id: 'timer_alerts',
                name: t('notif.channel_name'),
                description: t('notif.channel_desc'),
                importance: 5,
                visibility: 1,
                vibration: true,
                sound: undefined
            });
        } catch (e) {
            console.warn("LocalNotifications Capacitor non disponibles :", e);
        }
    } else if ('Notification' in window && Notification.permission === 'default') {
        try {
            Notification.requestPermission();
        } catch (e) { }
    }
}

async function programmerNotificationTimer(titre, message, dateFin) {
    if (!dateFin || dateFin.getTime() <= Date.now()) return;
    const host = getSystemHost();
    await host.armTimerNotification({
        title: titre || t('practice.timer_done_title'),
        body: message || t('practice.time_up_body'),
        at: dateFin
    });
}

async function annulerNotificationTimer() {
    const host = getSystemHost();
    await host.disarmTimerNotification();
}

async function programmerNotificationPause(dateFin) {
    if (!dateFin || dateFin.getTime() <= Date.now()) return;
    const host = getSystemHost();
    await host.armTimerNotification({
        title: t('practice.break_done_title'),
        body: t('practice.break_done_body'),
        at: dateFin
    });
}

async function annulerNotificationPause() {
    const host = getSystemHost();
    await host.disarmTimerNotification();
}

function initBackgroundTimers() {
    document.addEventListener('visibilitychange', async () => {
        if (typeof getSystemHost === 'function') {
            await getSystemHost().handleVisibilityChange(document.visibilityState);
        }
        if (document.visibilityState === 'visible') {
            if (activeTimer.index !== null && !activeTimer.isPaused) {
                demarrerBoucleChrono();
                activerWakeLock();
            } else if (isPupitreActive) {
                activerWakeLock();
            }
        }
    });

    if (window.Capacitor && Capacitor.isNativePlatform()) {
        const { App } = Capacitor.Plugins;
        App.addListener('appStateChange', async ({ isActive }) => {
            if (typeof getSystemHost === 'function') {
                await getSystemHost().handleVisibilityChange(isActive ? 'visible' : 'hidden');
            }
            if (isActive) {
                if (activeTimer.index !== null && !activeTimer.isPaused) {
                    demarrerBoucleChrono();
                    activerWakeLock();
                } else if (isPupitreActive) {
                    activerWakeLock();
                }
            }
        });
    }
}

// ==========================================
// --- PARAMÈTRES & CONFIGURATION GLOBALE ---
// ==========================================

function ouvrirModalSettings(ongletParDefaut = 'categories') {
    const modal = document.getElementById('modal-settings');
    if (!modal) {
        console.error("Élément #modal-settings introuvable dans le DOM.");
        return;
    }

    // Affichage immédiat pour une réactivité instantanée
    modal.style.display = 'flex';

    // 1. Initialiser les valeurs du Pomodoro
    try {
        const pomodoro = chargerPomodoroConfig();
        const inputWork = document.getElementById('input-settings-pomodoro-work');
        const inputBreak = document.getElementById('input-settings-pomodoro-break');
        if (inputWork) inputWork.value = pomodoro.workMinutes || 50;
        if (inputBreak) inputBreak.value = pomodoro.breakMinutes || 5;
    } catch (e) {
        console.warn("Erreur chargement config Pomodoro :", e);
    }

    // 2. Initialiser les valeurs Audio
    try {
        const audio = chargerAudioConfig();
        const selectTheme = document.getElementById('select-settings-audio-theme');
        const selectMetro = document.getElementById('select-settings-metronome-theme');
        const inputVol = document.getElementById('input-settings-audio-volume');
        const labelVol = document.getElementById('label-settings-audio-volume');
        if (selectTheme) selectTheme.value = audio.theme || 'jazz';
        if (selectMetro) selectMetro.value = audio.metronomeTheme || 'bois';
        const volPct = Math.round((audio.volume !== undefined ? audio.volume : 0.8) * 100);
        if (inputVol) inputVol.value = volPct;
        if (labelVol) labelVol.textContent = `${volPct}%`;
        majToggleNotificationsUI();
    } catch (e) {
        console.warn("Erreur chargement config Audio :", e);
    }

    // 3. Rendu de la liste des catégories & sous-catégories
    try {
        renderSettingsCategoriesUI();
    } catch (e) {
        console.warn("Erreur rendu Catégories :", e);
    }

    // 4. Activation de l'onglet demandé
    try {
        majThemeUI(localStorage.getItem('piano_workout_theme') || 'oled');
        changerOngletSettings(ongletParDefaut);
    } catch (e) {
        console.warn("Erreur activation onglet :", e);
    }
}

window.ouvrirModalSettings = ouvrirModalSettings;
window.fermerModalSettings = fermerModalSettings;
window.ouvrirModalMetronome = ouvrirModalMetronome;
window.fermerModalMetronome = fermerModalMetronome;
window.basculerLectureMetronome = basculerLectureMetronome;
window.demarrerMetronome = demarrerMetronome;
window.arreterMetronome = arreterMetronome;
window.reglerTempoMetronome = reglerTempoMetronome;
window.ajusterTempoMetronome = ajusterTempoMetronome;
window.tapTempoMetronome = tapTempoMetronome;
window.changerSignatureMetronome = changerSignatureMetronome;
window.basculerUniteMetronome = basculerUniteMetronome;
window.reglerUniteMetronome = reglerUniteMetronome;
window.cyclerSlotMetronome = cyclerSlotMetronome;
if (typeof changerThemeSonMetronome !== 'undefined') window.changerThemeSonMetronome = changerThemeSonMetronome;

// Mode Concert (Jalon 8)
window.concertState = concertState;
window.lancerModeConcert = lancerModeConcert;
window.lancerModeConcertDirect = lancerModeConcertDirect;
window.chargerMorceauConcert = chargerMorceauConcert;
window.majHUDConcert = majHUDConcert;
window.toggleConcertVisualMetronome = toggleConcertVisualMetronome;
window.ouvrirSetlistDrawer = ouvrirSetlistDrawer;
window.fermerSetlistDrawer = fermerSetlistDrawer;
window.renderSetlistDrawerItems = renderSetlistDrawerItems;
window.choisirMorceauConcertDepuisSetlist = choisirMorceauConcertDepuisSetlist;
window.quitterModeConcert = quitterModeConcert;
window.demarrerConcertPremierMorceau = demarrerConcertPremierMorceau;
window.retournerSetlistDepuisPartition = retournerSetlistDepuisPartition;
window.assignerPartitionMorceauConcert = assignerPartitionMorceauConcert;
window.importerFichierPartitionConcert = importerFichierPartitionConcert;
window.getMorceauxSetlistOrdonnes = getMorceauxSetlistOrdonnes;
window.sauvegarderOrdreSetlist = sauvegarderOrdreSetlist;

function fermerModalSettings() {
    const modal = document.getElementById('modal-settings');
    if (modal) modal.style.display = 'none';
}

function ouvrirModalBackup() {
    ouvrirModalSettings('backup');
}

function fermerModalBackup() {
    fermerModalSettings();
}

function changerOngletSettings(nomOnglet) {
    const tabs = ['categories', 'pomodoro', 'audio', 'theme', 'backup'];
    tabs.forEach(tab => {
        const btn = document.getElementById(`tab-btn-${tab}`);
        const pane = document.getElementById(`settings-pane-${tab}`);
        if (btn) {
            if (tab === nomOnglet) btn.classList.add('active');
            else btn.classList.remove('active');
        }
        if (pane) {
            pane.style.display = tab === nomOnglet ? 'block' : 'none';
        }
    });
    if (nomOnglet === 'theme') {
        const curTheme = localStorage.getItem('piano_workout_theme') || 'oled';
        majThemeUI(curTheme);
    }
}

// ==========================================
// --- GESTION DES THÈMES VISUELS         ---
// ==========================================

function chargerThemeConfig() {
    let theme = 'oled';
    try {
        theme = localStorage.getItem('piano_workout_theme') || 'oled';
    } catch (e) { }
    appliquerTheme(theme, false);
}

function appliquerTheme(themeNom, sauvegarder = true) {
    if (!['oled', 'argile', 'groove', 'gris', 'clair', 'creme'].includes(themeNom)) themeNom = 'oled';
    if (typeof document !== 'undefined' && document.documentElement) {
        document.documentElement.setAttribute('data-theme', themeNom);
        const metaTheme = document.getElementById('meta-theme-color');
        if (metaTheme) {
            if (themeNom === 'oled') metaTheme.setAttribute('content', '#110d0a');
            else if (themeNom === 'argile') metaTheme.setAttribute('content', '#1f1e1d');
            else if (themeNom === 'groove' || themeNom === 'gris') metaTheme.setAttribute('content', '#1d2021');
            else metaTheme.setAttribute('content', '#f7f3ec');
        }
    }

    if (sauvegarder) {
        try { localStorage.setItem('piano_workout_theme', themeNom); } catch (e) { }
    }
    majThemeUI(themeNom);
}

function choisirTheme(themeNom) {
    appliquerTheme(themeNom, true);
}

function majThemeUI(themeNom) {
    if (typeof document === 'undefined') return;
    const curTheme = themeNom || (typeof localStorage !== 'undefined' ? localStorage.getItem('piano_workout_theme') : 'oled') || 'oled';
    ['oled', 'argile', 'groove', 'clair'].forEach(t => {
        const card = document.getElementById(`theme-card-${t}`);
        if (card) {
            const isMatch = (t === curTheme) || (t === 'groove' && curTheme === 'gris') || (t === 'clair' && curTheme === 'creme');
            if (isMatch) card.classList.add('active');
            else card.classList.remove('active');
        }
    });
}

window.chargerThemeConfig = chargerThemeConfig;
window.appliquerTheme = appliquerTheme;
window.choisirTheme = choisirTheme;
window.majThemeUI = majThemeUI;

// --- GESTION DES CATÉGORIES ET SOUS-CATÉGORIES ---

function renderSettingsCategoriesUI() {
    const container = document.getElementById('settings-categories-list');
    if (!container) return;
    container.innerHTML = "";

    const categories = SOUS_CATEGORIES;
    const catKeys = Object.keys(categories);

    if (catKeys.length === 0) {
        container.innerHTML = `<p style="color: var(--text-muted); font-size: 13px;">${t('settings.no_categories')}</p>`;
        return;
    }

    catKeys.forEach(cat => {
        const isMorceaux = estCategorieMorceaux(cat);
        const isConcert = cat === 'Concert';
        const isSpecial = isMorceaux || isConcert;
        const sousCats = Array.isArray(categories[cat]) ? categories[cat] : [];
        const listeAffichee = isSpecial ? getSousCategoriesPour(cat) : sousCats;

        const card = document.createElement('div');
        card.className = 'setting-cat-card';

        const header = document.createElement('div');
        header.className = 'setting-cat-header';

        const titleSpan = document.createElement('div');
        titleSpan.style.display = 'flex';
        titleSpan.style.alignItems = 'center';
        titleSpan.style.gap = '8px';
        const subcatPlural = getCurrentLang() === 'en' ? (sousCats.length > 1 ? 'ies' : 'y') : (sousCats.length > 1 ? 's' : '');
        const nbBadgeText = isSpecial ? t('settings.playlists_count', { count: listeAffichee.length }) : t('settings.subcats_count', { count: sousCats.length, plural: subcatPlural });
        titleSpan.innerHTML = `<strong style="font-size: 14px; color: var(--text-primary);">${cat}</strong>
            <span class="badge" style="font-size: 11px;">${nbBadgeText}</span>`;

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn-action btn-ghost-red btn-square';
        deleteBtn.title = t('settings.delete_cat_title', { cat: cat });
        deleteBtn.innerHTML = svgTrash;
        deleteBtn.onclick = () => supprimerCategorie(cat);

        header.appendChild(titleSpan);
        header.appendChild(deleteBtn);
        card.appendChild(header);

        // Liste des puces de sous-catégories
        const chipsContainer = document.createElement('div');
        chipsContainer.style.marginBottom = '10px';
        chipsContainer.style.display = 'flex';
        chipsContainer.style.flexWrap = 'wrap';

        if (isSpecial) {
            listeAffichee.forEach(pl => {
                const chip = document.createElement('span');
                chip.className = 'setting-subcat-chip';
                chip.textContent = pl;
                chipsContainer.appendChild(chip);
            });
        } else {
            sousCats.forEach(sc => {
                const chip = document.createElement('span');
                chip.className = 'setting-subcat-chip';
                chip.innerHTML = `${sc} <span class="setting-subcat-remove" title="${t('common.delete')}" onclick="supprimerSousCategorie('${cat.replace(/'/g, "\\'")}', '${sc.replace(/'/g, "\\'")}')">&times;</span>`;
                chipsContainer.appendChild(chip);
            });
        }
        card.appendChild(chipsContainer);

        // Formulaire ajout sous-catégorie
        if (!isSpecial) {
            const addRow = document.createElement('div');
            addRow.style.display = 'flex';
            addRow.style.gap = '6px';
            addRow.style.alignItems = 'center';

            const inputAddSc = document.createElement('input');
            inputAddSc.type = 'text';
            inputAddSc.placeholder = t('settings.subcat_placeholder');
            inputAddSc.style.height = '28px';
            inputAddSc.style.fontSize = '12px';
            inputAddSc.style.flex = '1';
            inputAddSc.style.margin = '0';
            inputAddSc.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    ajouterSousCategorie(cat, inputAddSc.value);
                }
            };

            const btnAddSc = document.createElement('button');
            btnAddSc.type = 'button';
            btnAddSc.className = 'btn-action btn-ghost-neutral';
            btnAddSc.style.height = '28px';
            btnAddSc.style.fontSize = '12px';
            btnAddSc.style.padding = '0 10px';
            btnAddSc.style.display = 'inline-flex';
            btnAddSc.style.alignItems = 'center';
            btnAddSc.style.gap = '4px';
            btnAddSc.innerHTML = `<svg viewBox="0 0 24 24" style="width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;"><path d="M5 12h14"/><path d="M12 5v14"/></svg> ${t('common.add')}`;
            btnAddSc.onclick = () => ajouterSousCategorie(cat, inputAddSc.value);

            addRow.appendChild(inputAddSc);
            addRow.appendChild(btnAddSc);
            card.appendChild(addRow);
        } else {
            const noticeRow = document.createElement('div');
            noticeRow.style.fontSize = '11px';
            noticeRow.style.color = 'var(--text-muted)';
            noticeRow.style.fontStyle = 'italic';
            noticeRow.textContent = t('settings.setlists_managed_notice');
            card.appendChild(noticeRow);
        }

        container.appendChild(card);
    });
}

function ajouterNouvelleCategorie() {
    const input = document.getElementById('input-new-category-name');
    if (!input) return;
    const nom = input.value.trim();
    if (!nom) return alert(t('settings.alert_enter_cat'));
    if (SOUS_CATEGORIES[nom]) return alert(t('settings.alert_cat_exists'));

    SOUS_CATEGORIES[nom] = [];
    sauvegarderCategoriesConfig(SOUS_CATEGORIES);
    input.value = "";
}

function supprimerCategorie(cat) {
    if (!confirm(t('settings.confirm_delete_cat', { cat: cat }))) return;
    delete SOUS_CATEGORIES[cat];
    sauvegarderCategoriesConfig(SOUS_CATEGORIES);
}

function ajouterSousCategorie(cat, nomSousCat) {
    const sc = (nomSousCat || "").trim();
    if (!sc) return;
    if (!SOUS_CATEGORIES[cat]) SOUS_CATEGORIES[cat] = [];
    if (SOUS_CATEGORIES[cat].includes(sc)) return alert(t('settings.alert_subcat_exists'));

    SOUS_CATEGORIES[cat].push(sc);
    sauvegarderCategoriesConfig(SOUS_CATEGORIES);
}

function supprimerSousCategorie(cat, nomSousCat) {
    if (!SOUS_CATEGORIES[cat]) return;
    SOUS_CATEGORIES[cat] = SOUS_CATEGORIES[cat].filter(s => s !== nomSousCat);
    sauvegarderCategoriesConfig(SOUS_CATEGORIES);
}

function estTonaliteCreationAffichee() {
    try {
        const val = localStorage.getItem('piano_workout_afficher_tonalite');
        return val === null ? false : val === 'true';
    } catch (e) {
        return false;
    }
}

function toggleMasquerTonaliteCreation() {
    const actuellementAffiche = estTonaliteCreationAffichee();
    const nouvelEtat = !actuellementAffiche;
    try {
        localStorage.setItem('piano_workout_afficher_tonalite', String(nouvelEtat));
    } catch (e) { }
    majAffichageTonaliteCreationUI();
}

function majAffichageTonaliteCreationUI() {
    const affiche = estTonaliteCreationAffichee();
    const section = document.getElementById('section-tonalite-creation');
    if (section) {
        section.style.display = affiche ? 'block' : 'none';
        if (!affiche) {
            const inputNote = document.getElementById('input-ton-note');
            const inputMode = document.getElementById('input-ton-mode');
            if (inputNote) inputNote.value = '';
            if (inputMode) inputMode.value = '';
            const chips = section.querySelectorAll('.chip');
            chips.forEach(c => { c.classList.remove('active', 'btn-ghost-blue'); c.classList.add('btn-ghost-neutral'); });
        }
    }

    const btn = document.getElementById('btn-toggle-masquer-tonalite');
    if (btn) {
        btn.classList.toggle('on', !!affiche);
        btn.setAttribute('aria-checked', String(!!affiche));
        btn.setAttribute('title', (affiche ? t('settings.enabled') : t('settings.hidden')) || (affiche ? 'Activé' : 'Masqué'));
    }
}

function reinitialiserParametresDefaut() {
    const doConfirm = typeof confirm !== 'undefined' ? confirm : (typeof window !== 'undefined' && window.confirm ? window.confirm : () => true);
    if (!doConfirm(t('settings.confirm_restore_defaults'))) return;

    // 1. Catégories par défaut selon la langue active
    SOUS_CATEGORIES = getCategoriesDefautPourLangue(getCurrentLang());
    sauvegarderCategoriesConfig(SOUS_CATEGORIES);

    // 2. Pomodoro (50 min travail, 5 min pause)
    const configPomo = { workMinutes: 50, breakMinutes: 5 };
    localStorage.setItem('piano_workout_pomodoro', JSON.stringify(configPomo));
    const inputWork = document.getElementById('input-settings-pomodoro-work');
    const inputBreak = document.getElementById('input-settings-pomodoro-break');
    if (inputWork) inputWork.value = 50;
    if (inputBreak) inputBreak.value = 5;
    if (!globalTimerData.isRunning) {
        globalTimerData.remaining = 50 * 60;
    }

    // 3. Audio & Sons (8-bit Jazz, volume 100%, métronome bois)
    const configAudio = { theme: 'jazz', volume: 1.0, metronomeTheme: 'bois' };
    localStorage.setItem('piano_workout_audio', JSON.stringify(configAudio));
    const selectTheme = document.getElementById('select-settings-audio-theme');
    const selectMetro = document.getElementById('select-settings-metronome-theme');
    const inputVol = document.getElementById('input-settings-audio-volume');
    const labelVol = document.getElementById('label-settings-audio-volume');
    if (selectTheme) selectTheme.value = 'jazz';
    if (selectMetro) selectMetro.value = 'bois';
    if (inputVol) inputVol.value = 100;
    if (labelVol) labelVol.textContent = '100%';

    // 4. Thème Sombre OLED
    choisirTheme('oled');

    // 5. Tonalité désactivée par défaut
    try { localStorage.setItem('piano_workout_afficher_tonalite', 'false'); } catch (e) { }
    majAffichageTonaliteCreationUI();

    alert(t('settings.restore_defaults_done'));
}

function reinitialiserCategoriesDefaut() {
    return reinitialiserParametresDefaut();
}

// --- GESTION DU POMODORO ET DE L'AUDIO ---

function ajusterPomodoro(type, delta) {
    const input = document.getElementById(type === 'work' ? 'input-settings-pomodoro-work' : 'input-settings-pomodoro-break');
    if (!input) return;
    const minVal = type === 'work' ? 5 : 1;
    const maxVal = type === 'work' ? 180 : 60;
    let val = (parseInt(input.value, 10) || (type === 'work' ? 50 : 5)) + delta;
    val = Math.max(minVal, Math.min(maxVal, val));
    input.value = val;
    sauvegarderParametresPomodoro();
}
window.ajusterPomodoro = ajusterPomodoro;

function sauvegarderParametresPomodoro() {
    const inputWork = document.getElementById('input-settings-pomodoro-work');
    const inputBreak = document.getElementById('input-settings-pomodoro-break');
    const workMin = Math.max(1, parseInt(inputWork ? inputWork.value : 50) || 50);
    const breakMin = Math.max(1, parseInt(inputBreak ? inputBreak.value : 5) || 5);

    const config = { workMinutes: workMin, breakMinutes: breakMin };
    localStorage.setItem('piano_workout_pomodoro', JSON.stringify(config));

    if (!globalTimerData.isRunning) {
        globalTimerData.remaining = workMin * 60;
    }
}

function sauvegarderParametresPomodoroDirect(config) {
    if (!config) return;
    const workMin = Math.max(1, parseInt(config.workMinutes) || 50);
    const breakMin = Math.max(1, parseInt(config.breakMinutes) || 5);
    localStorage.setItem('piano_workout_pomodoro', JSON.stringify({ workMinutes: workMin, breakMinutes: breakMin }));
    if (!globalTimerData.isRunning) {
        globalTimerData.remaining = workMin * 60;
    }
}

function sauvegarderParametresAudio() {
    const selectTheme = document.getElementById('select-settings-audio-theme');
    const selectMetro = document.getElementById('select-settings-metronome-theme');
    const inputVol = document.getElementById('input-settings-audio-volume');
    const theme = selectTheme ? selectTheme.value : 'arpege';
    const metro = selectMetro ? selectMetro.value : 'bois';
    const vol = inputVol ? (parseInt(inputVol.value) / 100) : 0.8;

    const config = { theme: theme, volume: vol, metronomeTheme: metro };
    localStorage.setItem('piano_workout_audio', JSON.stringify(config));
}

function sauvegarderParametresAudioDirect(config) {
    if (!config) return;
    localStorage.setItem('piano_workout_audio', JSON.stringify(config));
}

function mettreAJourVolumeAudio(val) {
    const label = document.getElementById('label-settings-audio-volume');
    if (label) label.textContent = `${val}%`;
    sauvegarderParametresAudio();
}

// ==========================================
// --- SYSTÈME DE SAUVEGARDE & RESTAURATION ---
// ==========================================

async function telechargerFichierSysteme(blob, nomFichier, mime) {
    // 1. Android SAF (Intent.ACTION_CREATE_DOCUMENT via NativeSystemBridge)
    if (window.Capacitor && Capacitor.isNativePlatform() && window.NativeSystemBridge && typeof window.NativeSystemBridge.saveToDocument === 'function') {
        try {
            const base64Data = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    const res = reader.result;
                    const b64 = typeof res === 'string' ? res.split(',')[1] : null;
                    if (b64) resolve(b64);
                    else reject(new Error("Échec conversion Base64"));
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            const Filesystem = Capacitor.Plugins.Filesystem;
            await Filesystem.writeFile({
                path: nomFichier,
                data: base64Data,
                directory: 'CACHE'
            });

            return new Promise((resolve) => {
                window.onNativeSaveResult = (success) => {
                    window.onNativeSaveResult = null;
                    try { Filesystem.deleteFile({ path: nomFichier, directory: 'CACHE' }); } catch (e) { }
                    resolve(success === true || success === 'true');
                };
                window.NativeSystemBridge.saveToDocument(nomFichier, nomFichier, mime || blob.type || 'application/octet-stream');
            });
        } catch (e) {
            console.warn("Échec sauvegarde SAF Android :", e);
        }
    }

    // 2. PC / Navigateurs modernes (File System Access API: showSaveFilePicker)
    if (typeof window.showSaveFilePicker === 'function') {
        try {
            const ext = nomFichier.split('.').pop().toLowerCase();
            const mimeType = mime || (ext === 'zip' ? 'application/zip' : 'application/json');
            const handle = await window.showSaveFilePicker({
                suggestedName: nomFichier,
                types: [{
                    description: ext === 'zip' ? 'Archive ZIP' : 'Fichier JSON',
                    accept: { [mimeType]: [`.${ext}`] }
                }]
            });
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return true;
        } catch (pickerErr) {
            if (pickerErr.name === 'AbortError') return false;
            console.warn("showSaveFilePicker a échoué, repli téléchargement classique :", pickerErr);
        }
    }

    // 3. Repli : Téléchargement Web classique (<a download>)
    try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = nomFichier;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            if (a.parentNode) document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 60000);
        return true;
    } catch (e) {
        console.error("Erreur téléchargement repli :", e);
        alert(t('settings.download_error', { error: e.message }));
        return false;
    }
}

async function telechargerBlob(blob, nomFichier) {
    return telechargerFichierSysteme(blob, nomFichier);
}

async function exporterBackupJson() {
    const btn = document.getElementById('btn-export-json');
    const msg = document.getElementById('backup-status-msg');
    const originalText = btn ? btn.innerHTML : '';

    const dateStr = new Date().toISOString().split('T')[0];
    const nomFichier = `piano_workout_backup_${dateStr}.json`;

    let fileHandle = null;
    if (typeof window.showSaveFilePicker === 'function' && !(window.Capacitor && Capacitor.isNativePlatform())) {
        try {
            fileHandle = await window.showSaveFilePicker({
                suggestedName: nomFichier,
                types: [{
                    description: 'Fichier JSON',
                    accept: { 'application/json': ['.json'] }
                }]
            });
        } catch (pickerErr) {
            if (pickerErr.name === 'AbortError') return;
            console.warn("showSaveFilePicker a échoué d'emblée, repli standard :", pickerErr);
        }
    }

    if (btn) btn.disabled = true;
    if (msg) { msg.style.display = 'block'; msg.textContent = t('settings.generating_json'); }

    try {
        const repo = getStorageRepo();
        const backup = await repo.buildBackup({
            categories: chargerCategoriesConfig(),
            pomodoro: chargerPomodoroConfig(),
            audio: chargerAudioConfig()
        });

        const jsonStr = JSON.stringify(backup, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const res = await getSystemHost().saveBackupFile(nomFichier, blob, 'application/json', { handle: fileHandle });

        if (msg) {
            if (res !== false) {
                msg.textContent = t('settings.json_downloaded');
                setTimeout(() => { msg.style.display = 'none'; }, 3000);
            } else {
                msg.style.display = 'none';
            }
        }
    } catch (err) {
        console.error("Erreur export JSON :", err);
        alert(t('settings.json_error', { error: err.message }));
        if (msg) msg.style.display = 'none';
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
    }
}

async function exporterBackupCompletZip() {
    const btn = document.getElementById('btn-export-zip');
    const msg = document.getElementById('backup-status-msg');
    const originalText = btn ? btn.innerHTML : '';

    const dateStr = new Date().toISOString().split('T')[0];
    const nomFichier = `piano_workout_backup_complet_${dateStr}.zip`;

    let fileHandle = null;
    if (typeof window.showSaveFilePicker === 'function' && !(window.Capacitor && Capacitor.isNativePlatform())) {
        try {
            fileHandle = await window.showSaveFilePicker({
                suggestedName: nomFichier,
                types: [{
                    description: 'Archive ZIP',
                    accept: { 'application/zip': ['.zip'] }
                }]
            });
        } catch (pickerErr) {
            if (pickerErr.name === 'AbortError') return;
            console.warn("showSaveFilePicker a échoué d'emblée, repli standard :", pickerErr);
        }
    }

    if (btn) btn.disabled = true;
    if (msg) { msg.style.display = 'block'; msg.textContent = t('settings.reading_db'); }

    try {
        const repo = getStorageRepo();
        const backup = await repo.buildBackup({
            categories: chargerCategoriesConfig(),
            pomodoro: chargerPomodoroConfig(),
            audio: chargerAudioConfig()
        });

        const zip = new JSZip();
        zip.file("database.json", JSON.stringify(backup, null, 2));
        const dossierFichiers = zip.folder("fichiers");

        const media = await repo.collectMedia(backup);
        let count = 0;
        const total = Object.keys(media).length;

        for (const [nomFichier, b64] of Object.entries(media)) {
            count++;
            if (msg) msg.textContent = t('settings.packing_files', { count: count, total: total });
            dossierFichiers.file(nomFichier, b64, { base64: true });
        }

        if (msg) msg.textContent = t('settings.compressing_zip');
        const zipBlob = await zip.generateAsync({ type: "blob" }, (metadata) => {
            if (msg) msg.textContent = t('settings.compressing_zip_pct', { pct: Math.round(metadata.percent) });
        });

        const res = await getSystemHost().saveBackupFile(nomFichier, zipBlob, 'application/zip', { handle: fileHandle });

        if (msg) {
            if (res !== false) {
                msg.textContent = t('settings.zip_exported', { total: total });
                setTimeout(() => { msg.style.display = 'none'; }, 4000);
            } else {
                msg.style.display = 'none';
            }
        }
    } catch (err) {
        console.error("Erreur export ZIP :", err);
        alert(t('settings.zip_error', { error: err.message }));
        if (msg) msg.style.display = 'none';
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
    }
}

async function importerFichierBackup(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const msg = document.getElementById('backup-status-msg');
    const input = event.target;
    if (msg) { msg.style.display = 'block'; msg.textContent = t('settings.analyzing_backup'); }

    try {
        const repo = getStorageRepo();
        const nom = (file.name || '').toLowerCase();
        const isZipMime = ['application/zip', 'application/x-zip-compressed', 'application/x-zip'].includes(file.type);
        const isJsonMime = file.type === 'application/json';

        if (nom.endsWith('.json') || (isJsonMime && !nom.endsWith('.zip'))) {
            const contenu = await file.text();
            const data = JSON.parse(contenu);
            const bilan = await repo.restoreBackup(data);
            if (data.categories) sauvegarderCategoriesConfig(data.categories);
            if (data.pomodoro) sauvegarderParametresPomodoroDirect(data.pomodoro);
            if (data.audio) sauvegarderParametresAudioDirect(data.audio);
            await rafraichirApresRestauration();
            alert(t('settings.restore_json_done', {
                vocab: bilan.itemsRestaures,
                seances: bilan.seancesRestaurees,
                routines: bilan.routinesRestaurees
            }));
        } else if (nom.endsWith('.zip') || isZipMime) {
            const zip = await JSZip.loadAsync(file);
            let dbFile = zip.file("database.json") || zip.file("data.json");
            if (!dbFile) {
                const found = zip.file(/database\.json$/i);
                if (found && found.length > 0) dbFile = found[0];
            }

            if (!dbFile) {
                alert(t('settings.invalid_zip_db'));
                if (msg) msg.style.display = 'none';
                return;
            }

            if (msg) msg.textContent = t('settings.restoring_db');
            const jsonText = await dbFile.async("text");
            const data = JSON.parse(jsonText);

            const media = {};
            const entries = Object.keys(zip.files).filter(k => !zip.files[k].dir && !k.endsWith('.json'));

            for (let i = 0; i < entries.length; i++) {
                const k = entries[i];
                if (msg) msg.textContent = t('settings.restoring_files', { current: i + 1, total: entries.length });
                const entry = zip.files[k];
                const fileName = entry.name.split('/').pop();
                if (fileName) {
                    media[fileName] = await entry.async("base64");
                }
            }

            const bilan = await repo.restoreBackup(data, media);
            if (data.categories) sauvegarderCategoriesConfig(data.categories);
            if (data.pomodoro) sauvegarderParametresPomodoroDirect(data.pomodoro);
            if (data.audio) sauvegarderParametresAudioDirect(data.audio);
            await rafraichirApresRestauration();

            alert(t('settings.restore_zip_done', {
                vocab: bilan.itemsRestaures,
                seances: bilan.seancesRestaurees,
                routines: bilan.routinesRestaurees,
                files: bilan.mediasRestaures
            }));
        } else {
            alert(t('settings.unrecognized_backup'));
        }

        if (msg) {
            msg.textContent = t('settings.restore_success_msg');
            setTimeout(() => { msg.style.display = 'none'; fermerModalSettings(); }, 1500);
        }
    } catch (err) {
        console.error("Erreur restauration :", err);
        alert(t('settings.restore_error', { error: err.message }));
        if (msg) msg.style.display = 'none';
    } finally {
        input.value = "";
    }
}

async function rafraichirApresRestauration() {
    try { await chargerVocabulaireApi(); } catch (e) { }
    try { await chargerRoutinesApi(); } catch (e) { }
    try { await chargerHistorique(); } catch (e) { }
    try { await chargerDerniereSeance(); } catch (e) { }
}
if (typeof window !== 'undefined') {
    window.toggleNotificationsSysteme = toggleNotificationsSysteme;
    window.majToggleNotificationsUI = majToggleNotificationsUI;
    window.sontNotificationsActivees = sontNotificationsActivees;
    window.ouvrirModalMicPermission = ouvrirModalMicPermission;
    window.fermerModalMicPermission = fermerModalMicPermission;
    window.ouvrirParametresAndroidApp = ouvrirParametresAndroidApp;
    window.getSystemHost = getSystemHost;
    window.getStorageRepo = getStorageRepo;
    window.estTonaliteCreationAffichee = estTonaliteCreationAffichee;
    window.toggleMasquerTonaliteCreation = toggleMasquerTonaliteCreation;
    window.majAffichageTonaliteCreationUI = majAffichageTonaliteCreationUI;
    window.reinitialiserParametresDefaut = reinitialiserParametresDefaut;
    window.reinitialiserCategoriesDefaut = reinitialiserCategoriesDefaut;
    window.dictaphoneState = dictaphoneState;
    window.ouvrirModalDictaphone = ouvrirModalDictaphone;
    window.ouvrirDictaphoneDepuisImmersif = ouvrirDictaphoneDepuisImmersif;
    window.fermerModalDictaphone = fermerModalDictaphone;
    window.basculerEnregistrementDictaphone = basculerEnregistrementDictaphone;
    window.demarrerEnregistrementDictaphone = demarrerEnregistrementDictaphone;
    window.arreterEnregistrementDictaphone = arreterEnregistrementDictaphone;
    window.basculerPauseDictaphone = basculerPauseDictaphone;
    window.annulerPriseDictaphone = annulerPriseDictaphone;
    window.recommencerPriseDictaphone = recommencerPriseDictaphone;
    window.sauvegarderDictaphoneAssocieMorceau = sauvegarderDictaphoneAssocieMorceau;
    window.sauvegarderDictaphoneNouvelItem = sauvegarderDictaphoneNouvelItem;
    window.telechargerFichierDictaphone = telechargerFichierDictaphone;
    window.majSousCategoriesDictaphone = majSousCategoriesDictaphone;
    window.toggleMesuresCahier = toggleMesuresCahier;
    window.initShareTarget = initShareTarget;
    window.executerImportIRealPro = executerImportIRealPro;
    window.ouvrirPreparationTrieur = ouvrirPreparationTrieur;
    window.demarrerImportTrieur = demarrerImportTrieur;
    window.choisirModeTrieur = choisirModeTrieur;
    window.selectChipPreparationTrieur = selectChipPreparationTrieur;
    if (typeof ignorerFichierTrieur !== 'undefined') window.ignorerFichierTrieur = ignorerFichierTrieur;
    if (typeof validerCreationTrieur !== 'undefined') window.validerCreationTrieur = validerCreationTrieur;
    if (typeof validerFusionTrieur !== 'undefined') window.validerFusionTrieur = validerFusionTrieur;
    if (typeof annulerFusionTrieur !== 'undefined') window.annulerFusionTrieur = annulerFusionTrieur;
    if (typeof filtrerAutocompleteTrieur !== 'undefined') window.filtrerAutocompleteTrieur = filtrerAutocompleteTrieur;
    if (typeof fermerTrieur !== 'undefined') window.fermerTrieur = fermerTrieur;
    if (typeof traiterInboxZip !== 'undefined') window.traiterInboxZip = traiterInboxZip;
}

// FIN DU FICHIER
