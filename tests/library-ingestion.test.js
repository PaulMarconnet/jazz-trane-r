import { describe, it, expect } from 'vitest';
import LibraryDomain from '../www/modules/library-domain.js';

const mk = (titre, extra = {}) => LibraryDomain.normalizeItem({ id: Math.floor(Math.random() * 1e6), titre, type_item: 'Morceaux', ...extra });

describe('library-domain - Niveau 1 : canonisation jazz', () => {
    it('ignore casse, accents, apostrophes et ponctuation', () => {
        const c = LibraryDomain.canonicalTitle;
        expect(c("Bags' Groove")).toBe(c("Bag's Groove"));
        expect(c("'Round Midnight")).toBe(c('Round Midnight'));
        expect(c('Déjà Vu.')).toBe(c('deja vu'));
        expect(c('Blue-Bossa')).toBe(c('Blue Bossa'));
    });
    it('ramène les articles de fin au début et unifie St./Saint', () => {
        const c = LibraryDomain.canonicalTitle;
        expect(c('Autumn Leaves, The')).toBe(c('The Autumn Leaves'));
        expect(c('Valse, La')).toBe(c('La Valse'));
        expect(c('St. Thomas')).toBe(c('Saint Thomas'));
    });
});

describe('library-domain - findMatch (2 niveaux)', () => {
    const items = [mk("Bag's Groove"), mk('Autumn Leaves'), mk('Voicing X', { type_item: 'Voicings' })];
    it('Correspondance Exacte via canonisation', () => {
        const r = LibraryDomain.findMatch(items, "Bags' Groove", { categorie: 'Morceaux' });
        expect(r.type).toBe('exact');
        expect(r.item.titre).toBe("Bag's Groove");
    });
    it('Doublon Probable via Levenshtein >= 0.80', () => {
        const r = LibraryDomain.findMatch(items, 'Autum Leavs', { categorie: 'Morceaux' });
        expect(r.type).toBe('probable');
        expect(r.item.titre).toBe('Autumn Leaves');
        expect(r.similarity).toBeGreaterThanOrEqual(0.8);
    });
    it('aucune correspondance si titres éloignés ou catégorie différente', () => {
        expect(LibraryDomain.findMatch(items, 'Giant Steps', { categorie: 'Morceaux' }).type).toBe('none');
        expect(LibraryDomain.findMatch(items, 'Voicing X', { categorie: 'Morceaux' }).type).toBe('none');
    });
    it('similarité normalisée', () => {
        expect(LibraryDomain.levenshteinSimilarity('abc', 'abc')).toBe(1);
        expect(LibraryDomain.levenshteinSimilarity('abcd', 'abce')).toBe(0.75);
    });
});

describe('library-domain - normalisation du compositeur iReal Pro', () => {
    it('inverse Nom Prénom en Prénom Nom', () => {
        const norm = LibraryDomain.normalizeComposerName;
        expect(norm('Coltrane John')).toBe('John Coltrane');
        expect(norm('Corea Chick')).toBe('Chick Corea');
        expect(norm('Van Heusen Jimmy')).toBe('Jimmy Van Heusen');
        expect(norm('Evans Bill')).toBe('Bill Evans');
    });
    it('préserve les auteurs multiples contenant &, / ou virgule', () => {
        const norm = LibraryDomain.normalizeComposerName;
        expect(norm('Rodgers Richard & Hart Lorenz')).toBe('Rodgers Richard & Hart Lorenz');
        expect(norm('Gershwin George / Gershwin Ira')).toBe('Gershwin George / Gershwin Ira');
        expect(norm('Davis, Miles')).toBe('Davis, Miles');
        expect(norm('Unknown')).toBe('Unknown');
        expect(norm(null)).toBeNull();
    });
});

describe('library-domain - décodage iReal Pro', () => {
    it('décode une playlist irealb:// avec nom de playlist, compositeur inversé et article déplacé', () => {
        const raw = 'irealb://Autumn Leaves, The=Kosma Joseph=Medium Swing=Gm=n=T44{x}===Blue Bossa=Dorham Kenny=Bossa Nova=Cm=n=T44{y}===Ma Playlist';
        const r = LibraryDomain.parseIRealLink(raw);
        expect(r.playlistName).toBe('Ma Playlist');
        expect(r.tunes).toHaveLength(2);
        expect(r.tunes[0]).toMatchObject({ titre: 'The Autumn Leaves', compositeur: 'Joseph Kosma', style: 'Medium Swing', tonalite: 'Gm' });
        expect(r.tunes[1]).toMatchObject({ titre: 'Blue Bossa', compositeur: 'Kenny Dorham', style: 'Bossa Nova', tonalite: 'Cm' });
        expect(r.tunes[0].grille).toContain('irealb://Autumn Leaves, The=Kosma');
    });
    it('décode un lien encodé en URI dans du HTML', () => {
        const html = '<a href="irealb://Solar%3DDavis%20Miles%3DMedium%20Swing%3DCm%3Dn%3DT44">x</a>';
        const r = LibraryDomain.parseIRealLink(html);
        expect(r.tunes[0].titre).toBe('Solar');
        expect(r.tunes[0].compositeur).toBe('Miles Davis');
        expect(r.playlistName).toBeNull();
    });
    it('décode les formats playlist irealbook:// dans du HTML avec guillemets simples ou retour à la ligne', () => {
        const html = `<!DOCTYPE html><html><body>
            <a href='irealbook://Autumn%20Leaves%2C%20The%3DKosma%20Joseph%3DMedium%20Swing%3DGm%3Dn%3DT44%7Bx%7D===\nBlue%20Bossa%3DDorham%20Kenny%3DBossa%20Nova%3DCm%3Dn%3DT44%7By%7D===Mes%20Morceaux'>x</a>
        </body></html>`;
        const r = LibraryDomain.parseIRealLink(html);
        expect(r.playlistName).toBe('Mes Morceaux');
        expect(r.tunes).toHaveLength(2);
        expect(r.tunes[0].titre).toBe('The Autumn Leaves');
        expect(r.tunes[1].titre).toBe('Blue Bossa');
    });
    it('décode sans crasher sur des symboles % non échappés dans les grilles', () => {
        const raw = 'irealb://Take 5=Desmond Paul=Swing=Eb=n=| C | % |===Ma Playlist';
        const r = LibraryDomain.parseIRealLink(raw);
        expect(r.playlistName).toBe('Ma Playlist');
        expect(r.tunes).toHaveLength(1);
        expect(r.tunes[0].titre).toBe('Take 5');
        expect(r.tunes[0].compositeur).toBe('Paul Desmond');
    });
    it('retourne une liste vide sans lien', () => {
        expect(LibraryDomain.parseIRealLink('rien').tunes).toEqual([]);
    });
});

describe('library-domain - regroupement des fichiers importés', () => {
    it('ne regroupe jamais les PDF multipages et préserve les suffixes comme 26-2', () => {
        const groups = LibraryDomain.groupImportFiles(['26-2.pdf', '9 -20.pdf', 'Giant Steps.pdf']);
        expect(groups.map(g => g.baseName)).toEqual(['26-2', '9 -20', 'Giant Steps']);
        expect(groups.every(g => g.names.length === 1)).toBe(true);
    });
    it('regroupe les images seulement si au moins deux fichiers partagent la base', () => {
        const groups = LibraryDomain.groupImportFiles([
            'Solar-1.png', 'Solar-2.png',
            'Solo-2.jpg',
            'Take.mp3',
            'notes.txt',
            '__MACOSX/x.png'
        ]);
        expect(groups.map(g => g.baseName)).toEqual(['Solar', 'Solo-2', 'Take']);
        expect(groups[0].names).toEqual(['Solar-1.png', 'Solar-2.png']);
        expect(groups[1].names).toEqual(['Solo-2.jpg']);
        expect(groups[0].ext).toBe('png');
        expect(groups[2].kind).toBe('audio');
    });
});

describe('library-domain - fusion non destructive', () => {
    it('enrichit sans écraser et sans injecter le style dans sous_categories', () => {
        const existing = mk('Solar', { attributs: { compositeur: 'Miles Davis', tempo: 160 }, sous_categories: ['Trio'] });
        const merged = LibraryDomain.mergeImport(existing, {
            compositeur: 'Autre', style: 'Medium Swing', tonalite: 'Cm', tempo: 120,
            grille: 'irealb://x', sous_categories: ['Set A'], fichier_image: ['a.png'], fichier_audio: 'a.mp3'
        });
        expect(merged.attributs).toEqual({ compositeur: 'Miles Davis', style: 'Medium Swing', tonalite: 'Cm', tempo: 160 });
        expect(merged.ireal_data.grille).toBe('irealb://x');
        expect(merged.sous_categories).toEqual(['Trio', 'Set A']);
        expect(merged.sous_categories).not.toContain('Medium Swing');
        expect(merged.fichier_image).toEqual(['a.png']);
        expect(merged.fichier_audio).toBe('a.mp3');
    });
    it('ne remplace ni la grille ni l\'audio existants, et ajoute les nouvelles pages', () => {
        const existing = mk('Solar', { fichier_audio: 'old.mp3', fichier_image: ['p1.png'], ireal_data: { grille: 'irealb://old' } });
        const merged = LibraryDomain.mergeImport(existing, { grille: 'irealb://new', fichier_audio: 'new.mp3', fichier_image: ['p1.png', 'p2.png'] });
        expect(merged.ireal_data.grille).toBe('irealb://old');
        expect(merged.fichier_audio).toBe('old.mp3');
        expect(merged.fichier_image).toEqual(['p1.png', 'p2.png']);
    });
});

describe('library-domain - modes de lot', () => {
    const items = [mk('Autumn Leaves'), mk("Bag's Groove")];
    const cands = [
        { titre: "Bags' Groove", categorie: 'Morceaux', style: 'Swing' },  // exact
        { titre: 'Giant Steps', categorie: 'Morceaux' },                    // nouveau
        { titre: 'Autum Leavs', categorie: 'Morceaux' }                     // probable
    ];
    it('Mode Rapide : fusionne les exacts, crée les nouveaux, crée aussi les probables et génère un bilan', () => {
        const r = LibraryDomain.planBatch(cands, items, 'rapide');
        expect(r.pending).toEqual([]);
        expect(r.operations.map(o => o.kind)).toEqual(['merge', 'create', 'create']);
        expect(r.operations[0].item.attributs.style).toBe('Swing');
        expect(r.summary).toBeDefined();
        expect(r.summary.created).toBe(2);
        expect(r.summary.merged).toBe(1);
        expect(r.summary.probableDuplicates).toHaveLength(1);
        expect(r.summary.probableDuplicates[0].candidate.titre).toBe('Autum Leavs');
        expect(r.summary.probableDuplicates[0].probableMatch.titre).toBe('Autumn Leaves');
    });
    it('Mode Prudent : fusionne les exacts puis s\'arrête sur le premier nouvel Item', () => {
        const r = LibraryDomain.planBatch(cands, items, 'prudent');
        expect(r.operations.map(o => o.kind)).toEqual(['merge']);
        expect(r.pending).toHaveLength(2);
        expect(r.stop).toMatchObject({ reason: 'new' });
        expect(r.pending[0].titre).toBe('Giant Steps');
    });
    it('Mode Prudent : s\'arrête sur un doublon probable', () => {
        const r = LibraryDomain.planBatch([cands[2]], items, 'prudent');
        expect(r.operations).toEqual([]);
        expect(r.stop.reason).toBe('probable');
        expect(r.stop.match.titre).toBe('Autumn Leaves');
    });
    it('détecte les doublons au sein du même lot', () => {
        const r = LibraryDomain.planBatch([{ titre: 'Solar', categorie: 'Morceaux' }, { titre: 'solar', categorie: 'Morceaux', tonalite: 'Cm' }], [], 'rapide');
        expect(r.operations.map(o => o.kind)).toEqual(['create', 'merge']);
    });
});
