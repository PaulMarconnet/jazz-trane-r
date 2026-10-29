import { describe, it, expect } from 'vitest';
import ScoreNavigation from '../www/modules/score-navigation.js';

describe('ScoreNavigation — Seam 1 : Pagination, cibles de pré-rendu (N-1, N, N+1) et clé d\'annotation par page', () => {
    it('calcule les cibles de pré-rendu (prev, current, next) aux bornes et au milieu d\'un document', () => {
        // Page 0 sur 4 -> prev: null, current: 0, next: 1
        expect(ScoreNavigation.getPrerenderTargets(0, 4, 'pdf')).toEqual({
            prev: null,
            current: 0,
            next: 1
        });

        // Page 1 sur 4 -> prev: 0, current: 1, next: 2
        expect(ScoreNavigation.getPrerenderTargets(1, 4, 'pdf')).toEqual({
            prev: 0,
            current: 1,
            next: 2
        });

        // Dernière page (3 sur 4) -> prev: 2, current: 3, next: null
        expect(ScoreNavigation.getPrerenderTargets(3, 4, 'pdf')).toEqual({
            prev: 2,
            current: 3,
            next: null
        });

        // Page unique -> prev: null, current: 0, next: null
        expect(ScoreNavigation.getPrerenderTargets(0, 1, 'pdf')).toEqual({
            prev: null,
            current: 0,
            next: null
        });

        // Mode cahier -> pas de voisins à pré-rendre
        expect(ScoreNavigation.getPrerenderTargets(0, 1, 'cahier')).toEqual({
            prev: null,
            current: 0,
            next: null
        });
    });

    it('génère une clé d\'annotation canonique par page et met à jour l\'état lors des transitions de page', () => {
        const nav = ScoreNavigation.createNavigationMachine({
            type: 'pdf',
            sourceNom: 'file_123_Autumn Leaves (Bb).pdf',
            titre: 'Autumn Leaves',
            totalCount: 3,
            currentIndex: 0
        });

        let state = nav.getState();
        expect(state.currentIndex).toBe(0);
        expect(state.annotationKey).toBe('annot_file_123_Autumn_Leaves__Bb_.pdf_p0');
        expect(state.prerenderTargets).toEqual({ prev: null, current: 0, next: 1 });
        expect(state.canTurnPrev).toBe(false);
        expect(state.canTurnNext).toBe(true);

        // Impossible de reculer depuis la page 0 hors Mode Live
        const noopPrev = nav.turnPage(-1);
        expect(noopPrev.action).toBe('noop');
        expect(nav.getState().currentIndex).toBe(0);

        // Avancer à la page 1
        const step1 = nav.turnPage(1);
        expect(step1).toEqual({
            action: 'page',
            previousPageIndex: 0,
            pageIndex: 1,
            prerenderTargets: { prev: 0, current: 1, next: 2 },
            annotationKey: 'annot_file_123_Autumn_Leaves__Bb_.pdf_p1'
        });

        // Avancer à la page 2 (dernière page)
        const step2 = nav.turnPage(1);
        expect(step2.action).toBe('page');
        expect(step2.pageIndex).toBe(2);
        expect(step2.prerenderTargets).toEqual({ prev: 1, current: 2, next: null });
        expect(step2.annotationKey).toBe('annot_file_123_Autumn_Leaves__Bb_.pdf_p2');
        expect(nav.getState().canTurnNext).toBe(false);

        // Impossible d'avancer au-delà de la dernière page hors Mode Live
        const noopNext = nav.turnPage(1);
        expect(noopNext.action).toBe('noop');
        expect(nav.getState().currentIndex).toBe(2);
    });
});

describe('ScoreNavigation — Seam 2 : Enchaînement des morceaux d\'une Setlist en Mode Live', () => {
    const setlistSongs = [
        { id: 10, titre: 'So What', fichier_image: ['so_what.pdf'] },
        { id: 20, titre: 'Blue in Green', fichier_image: ['blue_in_green.pdf'] },
        { id: 30, titre: 'All Blues', fichier_image: ['all_blues.pdf'] }
    ];

    it('passe de la dernière page d\'un morceau à la première page (0) du morceau suivant, et de la page 0 à la dernière page (\'last\') du morceau précédent', () => {
        const nav = ScoreNavigation.createNavigationMachine({
            type: 'pdf',
            sourceNom: 'so_what.pdf',
            titre: 'So What',
            totalCount: 2,
            currentIndex: 0,
            isLiveMode: true,
            setlistSongs,
            currentSongIndex: 0
        });

        // Premier morceau, page 0 : impossible de reculer (début de Setlist)
        expect(nav.canTurnPage(-1)).toBe(false);
        expect(nav.canTurnPage(1)).toBe(true);
        expect(nav.turnPage(-1)).toEqual({ action: 'noop', reason: 'start_of_setlist' });

        // Avancer à la page 1 (dernière page de So What)
        const pageTurn = nav.turnPage(1);
        expect(pageTurn.action).toBe('page');
        expect(pageTurn.pageIndex).toBe(1);

        // Sur la dernière page du morceau 0 : canTurnPage(1) est vrai car il y a un morceau suivant
        expect(nav.canTurnPage(1)).toBe(true);

        // Avancer depuis la dernière page de So What -> bascule vers Blue in Green (index 1), page 0
        const nextSongTurn = nav.turnPage(1);
        expect(nextSongTurn).toEqual({
            action: 'song',
            previousSongIndex: 0,
            songIndex: 1,
            song: setlistSongs[1],
            targetPage: 0
        });
        expect(nav.getState().currentSongIndex).toBe(1);

        // Simuler le chargement de Blue in Green (3 pages, ouvert à la page 0)
        nav.loadDocument({
            type: 'pdf',
            sourceNom: 'blue_in_green.pdf',
            titre: 'Blue in Green',
            totalCount: 3,
            currentIndex: 0
        });

        // Depuis la page 0 de Blue in Green, reculer -> bascule vers So What (index 0) à sa dernière page ('last')
        expect(nav.canTurnPage(-1)).toBe(true);
        const prevSongTurn = nav.turnPage(-1);
        expect(prevSongTurn).toEqual({
            action: 'song',
            previousSongIndex: 1,
            songIndex: 0,
            song: setlistSongs[0],
            targetPage: 'last'
        });
        expect(nav.getState().currentSongIndex).toBe(0);
    });

    it('bloque le changement à la fin du dernier morceau de la Setlist', () => {
        const nav = ScoreNavigation.createNavigationMachine({
            type: 'pdf',
            sourceNom: 'all_blues.pdf',
            titre: 'All Blues',
            totalCount: 1,
            currentIndex: 0,
            isLiveMode: true,
            setlistSongs,
            currentSongIndex: 2 // Dernier morceau
        });

        expect(nav.canTurnPage(1)).toBe(false);
        expect(nav.turnPage(1)).toEqual({ action: 'noop', reason: 'end_of_setlist' });
        expect(nav.canTurnPage(-1)).toBe(true);
    });
});

describe('ScoreNavigation — Seam 3 : Verrouillage du swipe pendant l\'annotation et physique du glissement', () => {
    it('interdit strictement le swipe de changement de page dès qu\'un outil d\'annotation (pen, highlighter, eraser, text, line) est actif ou en mode cahier', () => {
        const nav = ScoreNavigation.createNavigationMachine({
            type: 'pdf',
            sourceNom: 'score.pdf',
            titre: 'Giant Steps',
            totalCount: 3,
            currentIndex: 1
        });

        // Par défaut, aucun outil d'annotation actif -> swipe autorisé
        expect(nav.getState().isSwipeLocked).toBe(false);
        expect(ScoreNavigation.isSwipeAllowed({ type: 'pdf', isAnnotationActive: false, activeTool: 'pen' })).toBe(true);

        // Activation de chacun des outils d'annotation : le swipe doit être verrouillé (0 déplacement, pas de tourné)
        for (const tool of ['pen', 'highlighter', 'eraser', 'text', 'line']) {
            nav.setAnnotationMode(true, tool);
            expect(nav.getState().isSwipeLocked).toBe(true);
            expect(ScoreNavigation.isSwipeAllowed({ type: 'pdf', isAnnotationActive: true, activeTool: tool })).toBe(false);

            const swipeAttempt = nav.evaluateSwipe({
                dx: -180,
                dy: 5,
                elapsedMs: 120,
                containerWidth: 800
            });
            expect(swipeAttempt).toEqual({
                allowed: false,
                isHorizontalSwipe: false,
                dragOffsetPx: 0,
                shouldTurn: false,
                delta: 0
            });
        }

        // Désactivation du mode annotation -> le swipe redevient autorisé
        nav.setAnnotationMode(false);
        expect(nav.getState().isSwipeLocked).toBe(false);

        // En mode Cahier manuscrit, le swipe est toujours verrouillé même si isAnnotationActive est false
        nav.loadDocument({ type: 'cahier', totalCount: 1, currentIndex: 0 });
        expect(nav.getState().isSwipeLocked).toBe(true);
        expect(nav.evaluateSwipe({ dx: -200, dy: 0, elapsedMs: 100, containerWidth: 800 }).allowed).toBe(false);
    });

    it('calcule le suivi physique du doigt (dragOffsetPx), la résistance élastique aux bornes et le seuil de déclenchement (distance ou vélocité)', () => {
        const nav = ScoreNavigation.createNavigationMachine({
            type: 'pdf',
            sourceNom: 'score.pdf',
            titre: 'Confirmation',
            totalCount: 3,
            currentIndex: 0 // Première page : peut aller à droite (delta +1, dx < 0), mais en butée à gauche (delta -1, dx > 0)
        });

        // 1. Glissement vers la gauche (dx = -120px) pour aller à la page suivante (autorisé, plein suivi 1:1)
        const moveNext = nav.evaluateSwipe({
            dx: -120,
            dy: 10,
            elapsedMs: 300,
            containerWidth: 800
        });
        expect(moveNext.allowed).toBe(true);
        expect(moveNext.isHorizontalSwipe).toBe(true);
        expect(moveNext.dragOffsetPx).toBe(-120);
        expect(moveNext.delta).toBe(1);
        expect(moveNext.shouldTurn).toBe(true); // |dx| = 120 > min(90, 800*0.16=128) = 90

        // 2. Glissement court mais rapide (flick : dx = -40px en 50ms -> velocity = 0.8 px/ms > 0.45)
        const flickNext = nav.evaluateSwipe({
            dx: -40,
            dy: 4,
            elapsedMs: 50,
            containerWidth: 800
        });
        expect(flickNext.shouldTurn).toBe(true);
        expect(flickNext.delta).toBe(1);

        // 3. Glissement court et lent (dx = -40px en 300ms -> annulé, revient en place)
        const shortSlow = nav.evaluateSwipe({
            dx: -40,
            dy: 4,
            elapsedMs: 300,
            containerWidth: 800
        });
        expect(shortSlow.dragOffsetPx).toBe(-40);
        expect(shortSlow.shouldTurn).toBe(false);

        // 4. Glissement vers la droite depuis la page 0 (dx = +100px, delta = -1 impossible) -> résistance élastique (0.22) et shouldTurn = false
        const elasticPrev = nav.evaluateSwipe({
            dx: 100,
            dy: 5,
            elapsedMs: 100,
            containerWidth: 800
        });
        expect(elasticPrev.allowed).toBe(true);
        expect(elasticPrev.dragOffsetPx).toBeCloseTo(22, 5);
        expect(elasticPrev.shouldTurn).toBe(false);
        expect(elasticPrev.delta).toBe(-1);
    });
});


