// Module 1 : Domaine Bibliothèque, Setlists, Attributs d'item & Ingestion (library-domain)
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.LibraryDomain = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const IREAL_STYLES_SET = new Set([
        'medium swing', 'medium up swing', 'up tempo swing', 'slow swing', 'fast swing', 'swing',
        'medium ballad', 'ballad', 'slow ballad',
        'waltz', 'jazz waltz', 'medium waltz', 'slow waltz',
        'bossa nova', 'medium bossa', 'bossa', 'samba', 'latin', 'latin swing', 'afro-cuban', 'bolero', 'cha cha',
        'funk', 'rock', 'pop', 'even 8ths', 'even 16ths', 'calypso', 'reggae', 'straight 8ths', 'rock pop',
        'medium', 'slow', 'fast', 'up tempo', 'up', 'bop', 'hard bop', 'bebop', 'trad jazz', 'fusion'
    ]);

    function isIrealStyle(texte) {
        if (!texte || typeof texte !== 'string') return false;
        const clean = texte.trim().toLowerCase();
        if (!clean) return false;
        if (IREAL_STYLES_SET.has(clean)) return true;
        return /(swing|ballad|bossa|waltz|latin|samba|afro|funk|rock|pop|even\s*8|even\s*16|straight|shuffle|calypso|reggae|bolero|rumba|tango|choche|dixie|fusion|bop|tempo)/i.test(clean);
    }

    function isValidTonalite(str) {
        if (!str || typeof str !== 'string') return false;
        const clean = str.trim();
        if (!clean || isIrealStyle(clean)) return false;
        return /^[A-Ga-g][b#♭♯]?(?:\s*(?:m|min|mineur|maj|majeur|minor|major|-|\+|m7|Δ|o))?$/i.test(clean);
    }

    const DEFAULT_CATEGORIES_FR = {
        'Voicings': ['II V I majeur', 'II V I mineur', 'Mineur', 'Majeur', 'Dominante', 'Diminué', 'Drop 2', 'So What', 'Autres'],
        'Patterns': ['Majeur', 'Mineur', 'Dominante', 'Pentatonique', 'Diminué', 'Autres'],
        'Licks': ['II V I majeur', 'II V I mineur', 'I VI II V', 'Blues', 'Autres'],
        'Morceaux': [],
        'Relevés': [],
        'Technique': ['Gammes majeures', 'Gammes mineures', 'Gammes dominantes', 'Hanon', 'Autres']
    };

    const DEFAULT_CATEGORIES_EN = {
        'Voicings': ['Major II-V-I', 'Minor II-V-I', 'Minor', 'Major', 'Dominant', 'Diminished', 'Drop 2', 'So What', 'Other'],
        'Patterns': ['Major', 'Minor', 'Dominant', 'Pentatonic', 'Diminished', 'Other'],
        'Licks': ['Major II-V-I', 'Minor II-V-I', 'I-VI-II-V', 'Blues', 'Other'],
        'Tunes': [],
        'Transcriptions': [],
        'Technique': ['Major Scales', 'Minor Scales', 'Dominant Scales', 'Hanon', 'Other']
    };

    function getDefaultCategories(lang) {
        const l = (lang === 'en') ? 'en' : 'fr';
        return JSON.parse(JSON.stringify(l === 'en' ? DEFAULT_CATEGORIES_EN : DEFAULT_CATEGORIES_FR));
    }

    function isTunesCategory(cat) {
        if (!cat) return false;
        const c = String(cat).trim();
        return c === 'Morceaux' || c === 'Tunes' || c === 'Songs';
    }

    function isFavoritesLabel(sc) {
        if (!sc || typeof sc !== 'string') return false;
        const s = sc.trim();
        return s === 'Favoris' || s === 'Favorites';
    }

    function getSetlists(items) {
        const setlists = new Set();
        if (Array.isArray(items)) {
            for (const item of items) {
                if (!item || !isTunesCategory(item.type_item)) continue;
                const scList = Array.isArray(item.sous_categories)
                    ? item.sous_categories
                    : (item.sous_categorie ? [item.sous_categorie] : []);
                for (const sc of scList) {
                    if (typeof sc !== 'string') continue;
                    const trimmed = sc.trim();
                    if (trimmed && !isFavoritesLabel(trimmed) && !isIrealStyle(trimmed)) {
                        setlists.add(trimmed);
                    }
                }
            }
        }
        return Array.from(setlists).sort();
    }

    function cleanNullableString(val) {
        if (val === undefined || val === null) return null;
        const trimmed = String(val).trim();
        return trimmed.length > 0 ? trimmed : null;
    }

    function cleanNullableTempo(val) {
        if (val === undefined || val === null || val === '') return null;
        const num = Number(val);
        if (!Number.isFinite(num) || num <= 0) return null;
        return Math.round(num);
    }

    function normalizeFichierImage(rawImages) {
        if (!rawImages) return [];
        const list = Array.isArray(rawImages) ? rawImages : [rawImages];
        const result = [];
        for (const entry of list) {
            if (typeof entry === 'string') {
                const parts = entry.split('|').map(p => p.trim()).filter(Boolean);
                for (const p of parts) {
                    if (!result.includes(p)) result.push(p);
                }
            }
        }
        return result;
    }

    function normalizeItem(rawItem) {
        const raw = (rawItem && typeof rawItem === 'object') ? rawItem : {};

        const rawId = Number(raw.id);
        const id = (raw.id !== undefined && raw.id !== null && raw.id !== '' && Number.isFinite(rawId))
            ? rawId
            : (Date.now() + Math.floor(Math.random() * 1000000));

        const titre = cleanNullableString(raw.titre !== undefined ? raw.titre : raw.nom) || '';

        let typeItem = cleanNullableString(raw.type_item) || 'Morceaux';
        if (typeItem === 'Standards' || typeItem === 'Thèmes') {
            typeItem = 'Morceaux';
        }

        // Collect sous_categories and detect Favoris label or misplaced iReal styles
        const rawScList = [];
        if (Array.isArray(raw.sous_categories)) {
            rawScList.push(...raw.sous_categories);
        }
        if (typeof raw.sous_categorie === 'string' && raw.sous_categorie.trim()) {
            rawScList.push(raw.sous_categorie);
        }

        let hadFavorisInSc = false;
        let rescuedStyleFromSc = null;
        const sousCategories = [];
        for (const sc of rawScList) {
            if (typeof sc !== 'string') continue;
            const trimmed = sc.trim();
            if (!trimmed) continue;
            if (isFavoritesLabel(trimmed)) {
                hadFavorisInSc = true;
                continue;
            }
            if (isIrealStyle(trimmed)) {
                if (!rescuedStyleFromSc) rescuedStyleFromSc = trimmed;
                continue;
            }
            if (!sousCategories.includes(trimmed)) {
                sousCategories.push(trimmed);
            }
        }

        const rawAttr = (raw.attributs && typeof raw.attributs === 'object') ? raw.attributs : {};
        const rawIreal = (raw.ireal_data && typeof raw.ireal_data === 'object') ? raw.ireal_data : {};

        const compositeur = cleanNullableString(
            rawAttr.compositeur !== undefined ? rawAttr.compositeur
                : (raw.compositeur !== undefined ? raw.compositeur : rawIreal.compositeur)
        );

        const candidateTona = cleanNullableString(
            rawAttr.tonalite !== undefined ? rawAttr.tonalite
                : (raw.tonalite !== undefined ? raw.tonalite : rawIreal.tona_origine)
        );
        const rescuedStyleFromTona = (candidateTona && isIrealStyle(candidateTona)) ? candidateTona : null;

        const explicitStyle = cleanNullableString(
            rawAttr.style !== undefined ? rawAttr.style
                : (raw.style !== undefined ? raw.style
                    : (rawIreal.style !== undefined ? rawIreal.style : rawIreal.metrique))
        );
        const style = explicitStyle || rescuedStyleFromSc || rescuedStyleFromTona || null;

        const tonalite = (candidateTona && isValidTonalite(candidateTona)) ? candidateTona : null;

        const tempo = cleanNullableTempo(
            rawAttr.tempo !== undefined ? rawAttr.tempo : raw.tempo
        );

        const irealTonaCandidate = cleanNullableString(rawIreal.tona_origine);
        const irealTona = (irealTonaCandidate && isValidTonalite(irealTonaCandidate))
            ? irealTonaCandidate
            : tonalite;

        const irealData = {
            grille: cleanNullableString(rawIreal.grille),
            tona_origine: irealTona || null
        };

        const fichierImage = normalizeFichierImage(raw.fichier_image);
        const fichierAudio = cleanNullableString(raw.fichier_audio);
        const cahierData = (raw.cahier_data && typeof raw.cahier_data === 'object') ? raw.cahier_data : null;

        const favori = Boolean(
            raw.favori === true ||
            raw.favori === 'true' ||
            raw.favori === 1 ||
            hadFavorisInSc
        );

        const rawStats = (raw.stats && typeof raw.stats === 'object') ? raw.stats : {};
        const nbPratiquesRaw = rawStats.nb_pratiques !== undefined ? rawStats.nb_pratiques : raw.nb_pratiques;
        const nbPratiques = Math.max(0, parseInt(nbPratiquesRaw, 10) || 0);
        const dateDernierePratique = cleanNullableString(rawStats.date_derniere_pratique);

        return {
            id,
            titre,
            type_item: typeItem,
            sous_categories: sousCategories,
            attributs: {
                compositeur,
                style,
                tonalite,
                tempo
            },
            fichier_image: fichierImage,
            fichier_audio: fichierAudio,
            ireal_data: irealData,
            cahier_data: cahierData,
            favori,
            stats: {
                nb_pratiques: nbPratiques,
                date_derniere_pratique: dateDernierePratique
            }
        };
    }

    function formatItemAttributes(itemOrAttributs, options) {
        if (!itemOrAttributs || typeof itemOrAttributs !== 'object') return '';
        const attr = itemOrAttributs.attributs && typeof itemOrAttributs.attributs === 'object'
            ? itemOrAttributs.attributs
            : itemOrAttributs;

        const parts = [];
        const comp = cleanNullableString(attr.compositeur);
        if (comp) parts.push(comp);

        const style = cleanNullableString(attr.style);
        if (style) parts.push(style);

        const tona = cleanNullableString(attr.tonalite);
        if (tona && isValidTonalite(tona)) {
            const formatter = options && typeof options.formatTonalite === 'function' ? options.formatTonalite : null;
            parts.push(formatter ? formatter(tona) : tona);
        }

        const tempo = cleanNullableTempo(attr.tempo);
        if (tempo !== null) {
            parts.push(`${tempo} BPM`);
        }

        return parts.join(' · ');
    }

    function applyItemUpdate(existingItem, patch) {
        const base = normalizeItem(existingItem);
        const changes = (patch && typeof patch === 'object') ? patch : {};
        const patchAttr = (changes.attributs && typeof changes.attributs === 'object') ? changes.attributs : {};

        const merged = {
            ...base,
            id: base.id,
            titre: changes.titre !== undefined ? changes.titre : (changes.nom !== undefined ? changes.nom : base.titre),
            type_item: changes.type_item !== undefined ? changes.type_item : base.type_item,
            sous_categories: changes.sous_categories !== undefined
                ? changes.sous_categories
                : (changes.sous_categorie !== undefined ? [changes.sous_categorie].filter(Boolean) : base.sous_categories),
            attributs: {
                compositeur: patchAttr.compositeur !== undefined ? patchAttr.compositeur : (changes.compositeur !== undefined ? changes.compositeur : base.attributs.compositeur),
                style: patchAttr.style !== undefined ? patchAttr.style : (changes.style !== undefined ? changes.style : base.attributs.style),
                tonalite: patchAttr.tonalite !== undefined ? patchAttr.tonalite : (changes.tonalite !== undefined ? changes.tonalite : base.attributs.tonalite),
                tempo: patchAttr.tempo !== undefined ? patchAttr.tempo : (changes.tempo !== undefined ? changes.tempo : base.attributs.tempo)
            },
            fichier_image: changes.fichier_image !== undefined ? changes.fichier_image : base.fichier_image,
            fichier_audio: changes.fichier_audio !== undefined ? changes.fichier_audio : base.fichier_audio,
            ireal_data: changes.ireal_data !== undefined ? { ...base.ireal_data, ...changes.ireal_data } : base.ireal_data,
            cahier_data: changes.cahier_data !== undefined ? changes.cahier_data : base.cahier_data,
            favori: changes.favori !== undefined ? changes.favori : base.favori,
            stats: changes.stats !== undefined ? { ...base.stats, ...changes.stats } : base.stats
        };

        return normalizeItem(merged);
    }

    function sortImmersiveQueue(items) {
        return items.slice().sort((a, b) => {
            const isFavA = a.favori ? 1 : 0;
            const isFavB = b.favori ? 1 : 0;
            if (isFavA !== isFavB) return isFavB - isFavA;

            const pratA = (a.stats && typeof a.stats.nb_pratiques === 'number') ? a.stats.nb_pratiques : 0;
            const pratB = (b.stats && typeof b.stats.nb_pratiques === 'number') ? b.stats.nb_pratiques : 0;
            if (pratA !== pratB) return pratA - pratB;

            const dateA = (a.stats && a.stats.date_derniere_pratique) ? new Date(a.stats.date_derniere_pratique).getTime() : 0;
            const dateB = (b.stats && b.stats.date_derniere_pratique) ? new Date(b.stats.date_derniere_pratique).getTime() : 0;
            return dateA - dateB;
        });
    }

    function drawImmersiveQueue(items, filterConfig) {
        if (!Array.isArray(items)) return [];
        const config = (filterConfig && typeof filterConfig === 'object') ? filterConfig : {};
        const categorie = cleanNullableString(config.categorie);
        const sousCategoriesArray = Array.isArray(config.sousCategories)
            ? config.sousCategories.filter(Boolean).map(s => String(s).trim())
            : [];

        const normalizedItems = items.map(normalizeItem);

        // 1. Filtrage strict par catégorie
        const isMorceauCat = isTunesCategory(categorie);
        let filtered = normalizedItems.filter(item => {
            if (!categorie) return true;
            if (isMorceauCat) return isTunesCategory(item.type_item);
            return item.type_item === categorie;
        });

        // 2. Filtrage ensembliste sur Favoris et Sous-catégories / Setlists
        if (sousCategoriesArray.length > 0) {
            const veutFavoris = sousCategoriesArray.some(sc => isFavoritesLabel(sc));
            const autresSousCats = sousCategoriesArray.filter(sc => !isFavoritesLabel(sc));

            const matchSousCat = (item) => item.sous_categories.some(sc => autresSousCats.includes(sc));

            if (veutFavoris && autresSousCats.length === 0) {
                filtered = filtered.filter(item => item.favori);
            } else if (!veutFavoris && autresSousCats.length > 0) {
                filtered = filtered.filter(item => matchSousCat(item));
            } else if (veutFavoris && autresSousCats.length > 0) {
                filtered = filtered.filter(item => item.favori && matchSousCat(item));
            }
        }

        // 3. Tri multicritère : favoris desc -> nb_pratiques asc -> date_derniere_pratique asc
        return sortImmersiveQueue(filtered);
    }

    return {
        name: 'library-domain',
        normalizeItem,
        formatItemAttributes,
        applyItemUpdate,
        isIrealStyle,
        isValidTonalite,
        getDefaultCategories,
        isTunesCategory,
        isFavoritesLabel,
        getSetlists,
        sortImmersiveQueue,
        drawImmersiveQueue
    };
}));
