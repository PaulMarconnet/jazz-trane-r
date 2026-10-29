// Module 5 : Persistance Locale & Archives (storage-repo)
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.StorageRepo = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const MEDIA_EXTENSIONS = ['png', 'jpg', 'jpeg', 'pdf', 'mp3', 'wav', 'm4a', 'webm', 'ogg', 'aac'];

    // --- Adapters en mémoire (tests) ---------------------------------------
    function createMemoryStoreAdapter() {
        const stores = {};
        const of = (n) => (stores[n] = stores[n] || new Map());
        return {
            async getAll(name) { return Array.from(of(name).values()); },
            async getById(name, id) { return of(name).has(id) ? of(name).get(id) : null; },
            async put(name, obj) { of(name).set(obj.id, obj); return obj; },
            async delete(name, id) { of(name).delete(id); },
            async clear(name) { of(name).clear(); }
        };
    }

    function createMemoryFileAdapter() {
        const files = new Map();
        return {
            async write(name, dataUrl) { files.set(name, dataUrl); return name; },
            async read(name) { return files.has(name) ? files.get(name) : null; },
            async list() { return Array.from(files.keys()); }
        };
    }

    function today() { return new Date().toISOString().split('T')[0]; }

    function normalizeItem(domain, item) {
        return domain && typeof domain.normalizeItem === 'function' ? domain.normalizeItem(item) : item;
    }

    function mimeFromExtension(ext) {
        const e = String(ext || '').toLowerCase();
        if (e === 'pdf') return 'application/pdf';
        if (e === 'jpg' || e === 'jpeg') return 'image/jpeg';
        if (e === 'png') return 'image/png';
        if (e === 'mp3') return 'audio/mpeg';
        if (e === 'wav') return 'audio/wav';
        if (e === 'webm') return 'audio/webm';
        if (e === 'ogg') return 'audio/ogg';
        if (e === 'm4a' || e === 'aac') return 'audio/mp4';
        return 'application/octet-stream';
    }

    /**
     * Crée un dépôt de persistance.
     * @param {{store: object, files: object, domain?: object}} deps
     *   store : seam des stores structurés (seances, vocabulaire, routines, annotations)
     *   files : seam binaire (Capacitor Filesystem sur Android, IndexedDB sur Web/test)
     *   domain: library-domain (normalisation des items)
     */
    function createRepo(deps) {
        const store = deps.store;
        const files = deps.files;
        const domain = deps.domain || null;
        const idGen = deps.generateId || (() => Date.now() + Math.floor(Math.random() * 1000000));

        async function list(resource) {
            const all = (await store.getAll(resource)) || [];
            return resource === 'vocabulaire' ? all.map(i => normalizeItem(domain, i)) : all;
        }

        async function create(resource, body) {
            let obj = { ...body, id: idGen() };
            if (resource === 'seances') obj.statut = 'en_cours';
            if (resource === 'vocabulaire') obj = normalizeItem(domain, obj);
            await store.put(resource, obj);
            return obj;
        }

        async function update(resource, id, body) {
            let obj = { ...body, id: Number(id) };
            if (resource === 'vocabulaire') {
                if (obj.nom) { obj.titre = obj.nom; delete obj.nom; }
                const existing = await store.getById(resource, obj.id);
                if (existing) {
                    obj = domain && typeof domain.applyItemUpdate === 'function'
                        ? domain.applyItemUpdate(existing, obj)
                        : { ...existing, ...obj };
                } else {
                    obj = normalizeItem(domain, obj);
                }
            }
            await store.put(resource, obj);
            return obj;
        }

        async function remove(resource, id) {
            const num = Number(id);
            if (!isNaN(num)) await store.delete(resource, num);
            await store.delete(resource, String(id));
            return { success: true };
        }

        async function reset(resource) {
            await store.clear(resource);
            return { success: true };
        }

        async function finishSession(id, payload) {
            payload = payload || {};
            const all = (await store.getAll('seances')) || [];
            let active = all.find(s => String(s.id) === String(id));
            if (!active) active = all.slice().reverse().find(s => s.statut !== 'terminee');
            if (active) {
                active.statut = 'terminee';
                if (payload.duree !== undefined) active.duree_reelle = payload.duree;
                if (payload.date_seance) active.date_seance = payload.date_seance;
                if (payload.items) active.items = payload.items;
            } else {
                active = {
                    id: (id && !isNaN(Number(id))) ? Number(id) : Date.now(),
                    statut: 'terminee',
                    duree_reelle: payload.duree || 0,
                    date_seance: payload.date_seance || today(),
                    items: payload.items || []
                };
            }
            await store.put('seances', active);
            return active;
        }

        async function adjustPractice(id, delta) {
            const item = await store.getById('vocabulaire', Number(id));
            if (!item) return undefined;
            item.stats = item.stats || { nb_pratiques: item.nb_pratiques || 0, date_derniere_pratique: null };
            item.stats.nb_pratiques = Math.max(0, (item.stats.nb_pratiques || 0) + delta);
            if (delta > 0) item.stats.date_derniere_pratique = today();
            item.nb_pratiques = item.stats.nb_pratiques;
            await store.put('vocabulaire', item);
            return item;
        }

        async function toggleFavorite(id) {
            const item = await store.getById('vocabulaire', Number(id));
            if (!item) return undefined;
            item.favori = !item.favori;
            await store.put('vocabulaire', item);
            return { favori: item.favori };
        }

        async function saveFile(name, dataUrl) { return files.write(name, dataUrl); }
        async function readFile(name) { return files.read(name); }

        // --- Sauvegardes ---------------------------------------------------
        async function buildBackup(config) {
            config = config || {};
            return {
                version: 'piano-workout-backup-v1',
                date_export: new Date().toISOString(),
                seances: await store.getAll('seances'),
                vocabulaire: await store.getAll('vocabulaire'),
                routines: await store.getAll('routines'),
                annotations: await store.getAll('annotations'),
                categories: config.categories,
                pomodoro: config.pomodoro,
                audio: config.audio
            };
        }

        function referencedFileNames(backup) {
            const set = new Set();
            ((backup && backup.vocabulaire) || []).forEach(item => {
                const img = item.fichier_image;
                if (Array.isArray(img)) img.forEach(f => { if (f) set.add(f); });
                else if (typeof img === 'string' && img) set.add(img);
                if (item.fichier_audio && typeof item.fichier_audio === 'string') set.add(item.fichier_audio);
            });
            return set;
        }

        /** Médias à empaqueter dans un zip : { nom: base64 pur }. */
        async function collectMedia(backup) {
            const names = referencedFileNames(backup);
            if (typeof files.list === 'function') (await files.list()).forEach(n => names.add(n));
            const out = {};
            for (const name of names) {
                try {
                    const data = await files.read(name);
                    if (data) out[name] = data.indexOf(',') >= 0 ? data.split(',')[1] : data;
                } catch (e) { /* fichier absent : omis */ }
            }
            return out;
        }

        /**
         * Restaure une sauvegarde. `media` : { nom: base64 pur } (archive .zip).
         * Retourne le bilan exact des éléments restaurés.
         */
        async function restoreBackup(data, media) {
            const bilan = { itemsRestaures: 0, mediasRestaures: 0, seancesRestaurees: 0, routinesRestaurees: 0 };
            if (!data) return bilan;

            if (Array.isArray(data.vocabulaire)) {
                const existants = (await store.getAll('vocabulaire')) || [];
                const map = new Map();
                existants.forEach(i => {
                    if (i.id) map.set(i.id, i);
                    if (i.titre) map.set(String(i.titre).toLowerCase().trim(), i);
                });
                for (const item of data.vocabulaire) {
                    const match = map.get(item.id) || map.get(String(item.titre || '').toLowerCase().trim());
                    if (match) {
                        const sc = Array.isArray(match.sous_categories) ? [...match.sous_categories] : [];
                        (Array.isArray(item.sous_categories) ? item.sous_categories : []).forEach(s => { if (!sc.includes(s)) sc.push(s); });
                        await store.put('vocabulaire', { ...match, ...item, id: match.id, sous_categories: sc });
                    } else {
                        await store.put('vocabulaire', item);
                    }
                    bilan.itemsRestaures++;
                }
            }
            if (Array.isArray(data.routines)) {
                for (const r of data.routines) { await store.put('routines', r); bilan.routinesRestaurees++; }
            }
            if (Array.isArray(data.seances)) {
                for (const s of data.seances) { await store.put('seances', s); bilan.seancesRestaurees++; }
            }
            if (Array.isArray(data.annotations)) {
                for (const a of data.annotations) await store.put('annotations', a);
            }
            if (media) {
                for (const name of Object.keys(media)) {
                    const ext = name.split('.').pop();
                    if (!MEDIA_EXTENSIONS.includes(String(ext).toLowerCase())) continue;
                    await files.write(name, `data:${mimeFromExtension(ext)};base64,${media[name]}`);
                    bilan.mediasRestaures++;
                }
            }
            return bilan;
        }

        return {
            list, create, update, remove, reset,
            getById: (resource, id) => store.getById(resource, Number(id)),
            put: (resource, obj) => store.put(resource, obj),
            finishSession,
            practice: (id) => adjustPractice(id, 1),
            unpractice: (id) => adjustPractice(id, -1),
            toggleFavorite,
            saveFile, readFile,
            buildBackup, collectMedia, restoreBackup
        };
    }

    return {
        name: 'storage-repo',
        createRepo,
        createMemoryStoreAdapter,
        createMemoryFileAdapter,
        mimeFromExtension,
        MEDIA_EXTENSIONS
    };
}));
