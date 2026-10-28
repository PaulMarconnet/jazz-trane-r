import { describe, it, expect } from 'vitest';
import LibraryDomain from '../www/modules/library-domain.js';

describe('library-domain — Normalisation canonique des Items et Attributs d\'item', () => {
    it('normalise un ancien item brut vers le contrat canonique avec les 4 Attributs d\'item', () => {
        const legacyItem = {
            id: '42',
            nom: 'Waltz for Debby',
            type_item: 'Standards',
            sous_categorie: 'Trio Set',
            compositeur: 'Bill Evans',
            tempo: '138',
            fichier_image: 'page1.png|page2.png',
            fichier_audio: '  debby.mp3  ',
            ireal_data: {
                grille: 'irealb://Waltz%20For%20Debby=Evans%20Bill=Jazz%20Waltz=F=n=...',
                tona_origine: 'F',
                style: 'Jazz Waltz'
            },
            favori: 'true',
            nb_pratiques: 7
        };

        const normalized = LibraryDomain.normalizeItem(legacyItem);

        expect(normalized).toEqual({
            id: 42,
            titre: 'Waltz for Debby',
            type_item: 'Morceaux',
            sous_categories: ['Trio Set'],
            attributs: {
                compositeur: 'Bill Evans',
                style: 'Jazz Waltz',
                tonalite: 'F',
                tempo: 138
            },
            fichier_image: ['page1.png', 'page2.png'],
            fichier_audio: 'debby.mp3',
            ireal_data: {
                grille: 'irealb://Waltz%20For%20Debby=Evans%20Bill=Jazz%20Waltz=F=n=...',
                tona_origine: 'F'
            },
            cahier_data: null,
            favori: true,
            stats: {
                nb_pratiques: 7,
                date_derniere_pratique: null
            },
            date_ajout: null
        });
    });

    it('formate sobrement les Attributs d\'item renseignés avec " · " et retourne une chaîne vide s\'ils sont absents', () => {
        const full = LibraryDomain.normalizeItem({
            id: 1,
            titre: 'So What',
            type_item: 'Morceaux',
            attributs: {
                compositeur: 'Miles Davis',
                style: 'Medium Swing',
                tonalite: 'Dm',
                tempo: 136
            }
        });
        expect(LibraryDomain.formatItemAttributes(full)).toBe('Miles Davis · Medium Swing · Dm · 136 BPM');

        const partial = LibraryDomain.normalizeItem({
            id: 2,
            titre: 'Blue in Green',
            type_item: 'Morceaux',
            attributs: {
                compositeur: 'Bill Evans',
                style: null,
                tonalite: 'Bb',
                tempo: null
            }
        });
        expect(LibraryDomain.formatItemAttributes(partial)).toBe('Bill Evans · Bb');

        const empty = LibraryDomain.normalizeItem({
            id: 3,
            titre: 'Exercice Hanon 1',
            type_item: 'Technique'
        });
        expect(LibraryDomain.formatItemAttributes(empty)).toBe('');
    });

    it('purge automatiquement les faux styles iReal Pro de sous_categories et de tonalite tout en préservant les vraies Setlists', () => {
        const pollutedItem = {
            id: 10,
            titre: 'Autumn Leaves',
            type_item: 'Morceaux',
            sous_categories: ['Medium Swing', 'Concert Jazz Club', 'Up Tempo Swing', 'Bossa Nova', 'Standards Trio'],
            tonalite: 'Medium Swing',
            ireal_data: {
                grille: 'irealb://...',
                tona_origine: 'Ballad'
            }
        };

        const normalized = LibraryDomain.normalizeItem(pollutedItem);

        expect(normalized.sous_categories).toEqual(['Concert Jazz Club', 'Standards Trio']);
        expect(normalized.attributs.tonalite).toBeNull();
        expect(normalized.ireal_data.tona_origine).toBeNull();
        expect(normalized.attributs.style).toBe('Medium Swing');
    });

    it('fournit les catégories par défaut FR et EN sans Projets/Projects ni références personnelles, et gère les Setlists comme sous-catégories de Morceaux', () => {
        const catsFr = LibraryDomain.getDefaultCategories('fr');
        const catsEn = LibraryDomain.getDefaultCategories('en');

        expect(Object.keys(catsFr)).toEqual(['Voicings', 'Patterns', 'Licks', 'Morceaux', 'Relevés', 'Technique']);
        expect(Object.keys(catsEn)).toEqual(['Voicings', 'Patterns', 'Licks', 'Tunes', 'Transcriptions', 'Technique']);
        expect(catsFr).not.toHaveProperty('Projets');
        expect(catsEn).not.toHaveProperty('Projects');
        expect(JSON.stringify(catsFr).toLowerCase()).not.toContain('aem');
        expect(JSON.stringify(catsFr).toLowerCase()).not.toContain('1460');

        const items = [
            { id: 1, titre: 'Blue Monk', type_item: 'Morceaux', sous_categories: ['Quartet Vendredi', 'Medium Swing'] },
            { id: 2, titre: 'Nardis', type_item: 'Morceaux', sous_categories: ['Duo Piano/Contrebasse', 'Quartet Vendredi'] },
            { id: 3, titre: 'Lick Bebop', type_item: 'Licks', sous_categories: ['II V I majeur'] }
        ];

        const setlists = LibraryDomain.getSetlists(items);
        expect(setlists).toEqual(['Duo Piano/Contrebasse', 'Quartet Vendredi']);
    });

    it('exécute l\'algorithme ensembliste de tirage du Mode Immersif (Catégorie ∩ Favoris ∩ Union(Sous-catégories/Setlists)) et le tri multicritère', () => {
        const catalog = [
            {
                id: 1,
                titre: 'Tune A (Fav, 5 pratiques, récent)',
                type_item: 'Morceaux',
                sous_categories: ['Setlist Club'],
                favori: true,
                stats: { nb_pratiques: 5, date_derniere_pratique: '2026-10-20' }
            },
            {
                id: 2,
                titre: 'Tune B (Fav, 2 pratiques, ancien)',
                type_item: 'Morceaux',
                sous_categories: ['Setlist Jam'],
                favori: true,
                stats: { nb_pratiques: 2, date_derniere_pratique: '2026-09-01' }
            },
            {
                id: 3,
                titre: 'Tune C (Fav, 2 pratiques, jamais daté)',
                type_item: 'Morceaux',
                sous_categories: ['Setlist Club'],
                favori: true,
                stats: { nb_pratiques: 2, date_derniere_pratique: null }
            },
            {
                id: 4,
                titre: 'Tune D (Non-Fav, 0 pratique)',
                type_item: 'Morceaux',
                sous_categories: ['Setlist Club'],
                favori: false,
                stats: { nb_pratiques: 0, date_derniere_pratique: null }
            },
            {
                id: 5,
                titre: 'Tune E (Fav, hors setlists)',
                type_item: 'Morceaux',
                sous_categories: ['Autre Setlist'],
                favori: true,
                stats: { nb_pratiques: 0, date_derniere_pratique: null }
            },
            {
                id: 6,
                titre: 'Lick Favori (autre catégorie)',
                type_item: 'Licks',
                sous_categories: ['II V I majeur'],
                favori: true,
                stats: { nb_pratiques: 0, date_derniere_pratique: null }
            }
        ];

        // Cas 1 : Catégorie seule -> tous les Morceaux triés (Favoris d'abord -> nb_pratiques asc -> ancienneté asc)
        const allTunes = LibraryDomain.drawImmersiveQueue(catalog, {
            categorie: 'Morceaux',
            sousCategories: []
        });
        expect(allTunes.map(i => i.id)).toEqual([5, 3, 2, 1, 4]);

        // Cas 2 : Catégorie ∩ Favoris uniquement
        const favTunes = LibraryDomain.drawImmersiveQueue(catalog, {
            categorie: 'Morceaux',
            sousCategories: ['Favoris']
        });
        expect(favTunes.map(i => i.id)).toEqual([5, 3, 2, 1]);

        // Cas 3 : Catégorie ∩ Union(Setlists) sans filtre Favoris
        const clubOrJam = LibraryDomain.drawImmersiveQueue(catalog, {
            categorie: 'Morceaux',
            sousCategories: ['Setlist Club', 'Setlist Jam']
        });
        expect(clubOrJam.map(i => i.id)).toEqual([3, 2, 1, 4]);

        // Cas 4 : Catégorie ∩ Favoris ∩ Union(Setlists)
        const favInClubOrJam = LibraryDomain.drawImmersiveQueue(catalog, {
            categorie: 'Morceaux',
            sousCategories: ['Favoris', 'Setlist Club', 'Setlist Jam']
        });
        expect(favInClubOrJam.map(i => i.id)).toEqual([3, 2, 1]);
    });

    it('met à jour un Item existant via applyItemUpdate en préservant ses stats, son état favori et sa grille iReal tout en appliquant les nouveaux Attributs d\'item', () => {
        const existing = LibraryDomain.normalizeItem({
            id: 77,
            titre: 'All The Things You Are',
            type_item: 'Morceaux',
            sous_categories: ['Standards Set', 'Concert'],
            attributs: {
                compositeur: 'Jerome Kern',
                style: 'Medium Swing',
                tonalite: 'Ab',
                tempo: 130
            },
            fichier_image: ['attya.pdf'],
            fichier_audio: 'attya.mp3',
            ireal_data: { grille: 'irealb://...', tona_origine: 'Ab' },
            favori: true,
            stats: { nb_pratiques: 12, date_derniere_pratique: '2026-10-15' }
        });

        const updated = LibraryDomain.applyItemUpdate(existing, {
            titre: 'All the Things You Are',
            sous_categories: ['Standards Set', 'Jam Session'],
            attributs: {
                compositeur: 'Jerome Kern',
                style: 'Up Tempo Swing',
                tonalite: 'G',
                tempo: 180
            }
        });

        expect(updated).toEqual({
            id: 77,
            titre: 'All the Things You Are',
            type_item: 'Morceaux',
            sous_categories: ['Standards Set', 'Jam Session'],
            attributs: {
                compositeur: 'Jerome Kern',
                style: 'Up Tempo Swing',
                tonalite: 'G',
                tempo: 180
            },
            fichier_image: ['attya.pdf'],
            fichier_audio: 'attya.mp3',
            ireal_data: { grille: 'irealb://...', tona_origine: 'Ab' },
            cahier_data: null,
            favori: true,
            stats: { nb_pratiques: 12, date_derniere_pratique: '2026-10-15' },
            date_ajout: null
        });
    });

    it('gère l\'attribut interne date_ajout (conservation, extraction depuis ID horodaté ou génération automatique)', () => {
        // 1. Conservation d'une date_ajout explicite
        const explicit = LibraryDomain.normalizeItem({
            id: 1,
            titre: 'Nardis',
            date_ajout: '2026-03-15T10:00:00.000Z'
        });
        expect(explicit.date_ajout).toBe('2026-03-15T10:00:00.000Z');

        // 2. Extraction depuis un ID horodaté
        const timestamp = 1740000000000;
        const fromTimestamp = LibraryDomain.normalizeItem({
            id: timestamp,
            titre: 'Blue in Green'
        });
        expect(fromTimestamp.date_ajout).toBe(new Date(timestamp).toISOString());

        // 3. Génération automatique pour un nouvel item sans ID
        const fresh = LibraryDomain.normalizeItem({ titre: 'Solar' });
        expect(typeof fresh.date_ajout).toBe('string');
        expect(Number.isNaN(new Date(fresh.date_ajout).getTime())).toBe(false);

        // 4. Préservation lors d'une mise à jour applyItemUpdate
        const updated = LibraryDomain.applyItemUpdate(explicit, { titre: 'Nardis (Edited)' });
        expect(updated.date_ajout).toBe('2026-03-15T10:00:00.000Z');
    });
});
