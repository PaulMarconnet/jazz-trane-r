import { describe, it, expect } from 'vitest';
import SessionTimer from '../www/modules/session-timer.js';

describe('session-timer — Seam 1 : Cycle de vie d\'un exercice, exclusivité et passage en overtime', () => {
    it('démarre un exercice, bascule en overtime à 0s avec comptage ascendant et garantit l\'exclusivité d\'un seul exercice actif', () => {
        const timer = SessionTimer.createTimerMachine({ workSec: 3000, breakSec: 300, afkLimitSec: 3600 });
        const t0 = 1000000;

        // 1. Démarrage de l'exercice 0 (durée prévue 10 min = 600s)
        timer.startExercise(0, { plannedSeconds: 600, remainingSeconds: 600, isOvertime: false }, t0);
        let state = timer.getState(t0);

        expect(state.activeExercise.index).toBe(0);
        expect(state.activeExercise.isPaused).toBe(false);
        expect(state.activeExercise.isOvertime).toBe(false);
        expect(state.activeExercise.displaySeconds).toBe(600);

        // 2. Avance de 599s -> reste 1s
        let tickResult = timer.tick(t0 + 599 * 1000);
        expect(tickResult.events.enteredOvertime).toBe(false);
        expect(timer.getState(t0 + 599 * 1000).activeExercise.displaySeconds).toBe(1);

        // 3. Avance de 2s (t0 + 601s) -> passage en overtime
        tickResult = timer.tick(t0 + 601 * 1000);
        expect(tickResult.events.enteredOvertime).toBe(true);
        state = timer.getState(t0 + 601 * 1000);
        expect(state.activeExercise.isOvertime).toBe(true);
        expect(state.activeExercise.displaySeconds).toBe(1); // 1 seconde de dépassement

        // 4. Démarrage d'un autre exercice (index 1) -> remplace et réinitialise l'exercice actif (exclusivité)
        timer.startExercise(1, { plannedSeconds: 300, remainingSeconds: 300, isOvertime: false }, t0 + 610 * 1000);
        state = timer.getState(t0 + 610 * 1000);
        expect(state.activeExercise.index).toBe(1);
        expect(state.activeExercise.isOvertime).toBe(false);
        expect(state.activeExercise.displaySeconds).toBe(300);

        // 5. Complétion de l'exercice actif
        const completed = timer.completeExercise(t0 + 650 * 1000);
        expect(completed).toEqual({
            index: 1,
            plannedSeconds: 300,
            remainingSeconds: 260,
            isOvertime: false,
            realDurationSeconds: 40 // 300 - 260 = 40s
        });
        expect(timer.getState(t0 + 650 * 1000).activeExercise.index).toBeNull();
    });

    it('ajuste l\'index de l\'exercice actif lors d\'une réorganisation (drag & drop)', () => {
        const timer = SessionTimer.createTimerMachine();
        timer.startExercise(1, { plannedSeconds: 300 }, 1000);

        // Déplacement de l'exercice 1 vers l'index 3
        timer.reorderExercises(1, 3);
        expect(timer.getState(1000).activeExercise.index).toBe(3);

        // Déplacement d'un autre exercice qui affecte l'index actif (ex: 0 vers 4)
        timer.reorderExercises(0, 4);
        expect(timer.getState(1000).activeExercise.index).toBe(2);
    });
});

describe('session-timer — Seam 2 : Cumul des pauses, Pomodoro et Pause café', () => {
    it('met en pause et reprend un exercice en suspendant la durée de séance et le Pomodoro', () => {
        const timer = SessionTimer.createTimerMachine({ workSec: 1500, breakSec: 300 });
        const t0 = 1000000;

        // Démarrer la séance et l'exercice 0 (10 min = 600s)
        timer.startSession({ id: 10, timestamp_debut: t0 }, t0);
        timer.startExercise(0, { plannedSeconds: 600, remainingSeconds: 600 }, t0);

        // 100s s'écoulent
        timer.tick(t0 + 100 * 1000);
        expect(timer.getState(t0 + 100 * 1000).sessionDurationSec).toBe(100);
        expect(timer.getState(t0 + 100 * 1000).pomodoro.workRemainingSec).toBe(1400);

        // Mise en pause à t0 + 100s
        timer.togglePause(t0 + 100 * 1000);
        expect(timer.getState(t0 + 100 * 1000).activeExercise.isPaused).toBe(true);

        // 60s en pause (t0 + 160s) : la durée de séance et le Pomodoro ne bougent pas
        timer.tick(t0 + 160 * 1000);
        expect(timer.getState(t0 + 160 * 1000).sessionDurationSec).toBe(100);
        expect(timer.getState(t0 + 160 * 1000).pomodoro.workRemainingSec).toBe(1400);
        expect(timer.getState(t0 + 160 * 1000).activeExercise.displaySeconds).toBe(500);

        // Reprise à t0 + 160s
        timer.togglePause(t0 + 160 * 1000);
        expect(timer.getState(t0 + 160 * 1000).activeExercise.isPaused).toBe(false);

        // 50s supplémentaires (t0 + 210s) : durée séance = 100 + 50 = 150s
        timer.tick(t0 + 210 * 1000);
        expect(timer.getState(t0 + 210 * 1000).sessionDurationSec).toBe(150);
        expect(timer.getState(t0 + 210 * 1000).pomodoro.workRemainingSec).toBe(1350);
        expect(timer.getState(t0 + 210 * 1000).activeExercise.displaySeconds).toBe(450);
    });

    it('suspend automatiquement l\'exercice et le cumul de séance pendant une Pause café, et émet les événements Pomodoro', () => {
        const timer = SessionTimer.createTimerMachine({ workSec: 200, breakSec: 60 });
        const t0 = 2000000;

        timer.startSession({ id: 20, timestamp_debut: t0 }, t0);
        timer.startExercise(0, { plannedSeconds: 600 }, t0);

        // Avance de 200s -> déclenchement suggestion de pause Pomodoro
        const tickPomo = timer.tick(t0 + 200 * 1000);
        expect(tickPomo.events.pomodoroBreakSuggested).toBe(true);
        expect(timer.getState(t0 + 200 * 1000).pomodoro.isBreakPending).toBe(true);

        // Déclenchement de la Pause café à t0 + 205s (durée 60s)
        timer.startCoffeeBreak(t0 + 205 * 1000);
        let state = timer.getState(t0 + 205 * 1000);
        expect(state.coffeeBreak.isActive).toBe(true);
        expect(state.coffeeBreak.remainingSec).toBe(60);
        expect(state.activeExercise.isPaused).toBe(true); // Exercice suspendu !

        // 30s de pause café s'écoulent (t0 + 235s) : la séance reste figée à 205s
        timer.tick(t0 + 235 * 1000);
        expect(timer.getState(t0 + 235 * 1000).sessionDurationSec).toBe(205);
        expect(timer.getState(t0 + 235 * 1000).coffeeBreak.remainingSec).toBe(30);

        // Fin de la pause café à t0 + 265s
        const tickBreakFin = timer.tick(t0 + 265 * 1000);
        expect(tickBreakFin.events.coffeeBreakFinished).toBe(true);
        expect(timer.getState(t0 + 265 * 1000).coffeeBreak.isActive).toBe(false);
        expect(timer.getState(t0 + 265 * 1000).sessionDurationSec).toBe(205);
    });
});

describe('session-timer — Seam 3 : Détection AFK à +60 min d\'overtime sans interaction', () => {
    it('déclenche la clôture automatique AFK après 60 min en overtime sans interaction avec soustraction de 3600s', () => {
        const timer = SessionTimer.createTimerMachine({ afkLimitSec: 3600 });
        const t0 = 3000000;

        // Séance démarrée à t0, exercice de 10 min (600s)
        timer.startSession({ id: 30, timestamp_debut: t0 }, t0);
        timer.startExercise(0, { plannedSeconds: 600 }, t0);

        // t0 + 600s : exercice arrive à terme et entre en overtime
        timer.tick(t0 + 600 * 1000);
        expect(timer.getState(t0 + 600 * 1000).activeExercise.isOvertime).toBe(true);

        // 3599s d'inactivité en overtime s'écoulent (t0 + 600 + 3599s) -> pas encore AFK
        let tickResult = timer.tick(t0 + (600 + 3599) * 1000);
        expect(tickResult.events.afkTriggered).toBe(false);
        expect(tickResult.events.afkClosure).toBeNull();

        // 1 seconde de plus (3600s pile en overtime et inactif) -> Déclenchement AFK !
        tickResult = timer.tick(t0 + (600 + 3600) * 1000);
        expect(tickResult.events.afkTriggered).toBe(true);
        expect(tickResult.events.afkClosure).toEqual({
            exerciseIndex: 0,
            exerciseRealDurationSeconds: 600, // plafonné au temps prévu (10 min)
            sessionFinalDurationSeconds: 600  // durée brute (600 + 3600 = 4200) - 3600s d'AFK = 600s
        });

        // L'exercice actif a été désactivé
        expect(timer.getState(t0 + (600 + 3600) * 1000).activeExercise.index).toBeNull();
    });

    it('ne déclenche pas l\'AFK si l\'utilisateur a interagi pendant l\'overtime', () => {
        const timer = SessionTimer.createTimerMachine({ afkLimitSec: 3600 });
        const t0 = 4000000;

        timer.startSession({ id: 40, timestamp_debut: t0 }, t0);
        timer.startExercise(0, { plannedSeconds: 600 }, t0);

        // Overtime à t0 + 600s
        timer.tick(t0 + 600 * 1000);

        // Interaction utilisateur à t0 + 2000s
        timer.recordInteraction(t0 + 2000 * 1000);

        // À t0 + 600 + 3600 = t0 + 4200s, l'overtime a 3600s mais l'inactivité n'est que de 2200s -> Pas d'AFK
        const tickResult = timer.tick(t0 + 4200 * 1000);
        expect(tickResult.events.afkTriggered).toBe(false);
        expect(timer.getState(t0 + 4200 * 1000).activeExercise.index).toBe(0);
    });

    it('ne déclenche pas l\'AFK si l\'exercice est en pause', () => {
        const timer = SessionTimer.createTimerMachine({ afkLimitSec: 3600 });
        const t0 = 5000000;

        timer.startSession({ id: 50, timestamp_debut: t0 }, t0);
        timer.startExercise(0, { plannedSeconds: 600 }, t0);

        // Overtime à t0 + 600s
        timer.tick(t0 + 600 * 1000);

        // Mise en pause de l'exercice en overtime à t0 + 700s
        timer.togglePause(t0 + 700 * 1000);

        // À t0 + 5000s (> 3600s d'inactivité) -> Pas d'AFK car l'exercice est en pause
        const tickResult = timer.tick(t0 + 5000 * 1000);
        expect(tickResult.events.afkTriggered).toBe(false);
    });
});

describe('session-timer — Seam 4 : Formule unique de durée réelle & Horloge 24h', () => {
    it('calcule la durée réelle avec exactitude pour une séance en cours, repli sur items ou séance terminée', () => {
        const t0 = 1700000000000;

        // Cas 1 : Séance en cours sans pause (300s écoulées)
        const seanceLive = {
            id: 1,
            statut: 'en_cours',
            timestamp_debut: t0
        };
        expect(SessionTimer.calculateSessionRealDuration(seanceLive, t0 + 300 * 1000)).toBe(300);

        // Cas 2 : Séance en cours avec pauses cumulées (60s) et pause active (40s)
        const seanceLivePaused = {
            id: 2,
            statut: 'en_cours',
            timestamp_debut: t0,
            temps_pause_cumule_ms: 60 * 1000,
            pause_active_debut: t0 + 260 * 1000
        };
        // Total brut à t0 + 300s = 300s. Pauses = 60s + 40s = 100s. Durée réelle = 200s.
        expect(SessionTimer.calculateSessionRealDuration(seanceLivePaused, t0 + 300 * 1000)).toBe(200);

        // Cas 3 : Séance terminée avec champ duree_reelle présent
        const seanceDone = {
            id: 3,
            statut: 'terminee',
            duree_reelle: 1850
        };
        expect(SessionTimer.calculateSessionRealDuration(seanceDone)).toBe(1850);

        // Cas 4 : Repli sur les items faits
        const seanceFallback = {
            id: 4,
            items: [
                { fait: true, temps_prevu: 10, temps_restant: 120, isOvertime: false }, // 600 - 120 = 480s
                { fait: true, temps_prevu: 5, temps_restant: 60, isOvertime: true },   // 300 + 60 = 360s
                { fait: false, temps_prevu: 15 }                                       // non fait
            ]
        };
        expect(SessionTimer.calculateSessionRealDuration(seanceFallback)).toBe(840); // 480 + 360 = 840s
    });

    it('formate l\'horloge discrète en 24h (HH:MM) et les durées', () => {
        // Horloge 24h
        const d1 = new Date(2026, 9, 29, 9, 5, 0); // 09:05
        expect(SessionTimer.formatClock24h(d1)).toBe('09:05');

        const d2 = new Date(2026, 9, 29, 21, 45, 0); // 21:45
        expect(SessionTimer.formatClock24h(d2)).toBe('21:45');

        const d3 = new Date(2026, 9, 29, 0, 0, 0); // 00:00
        expect(SessionTimer.formatClock24h(d3)).toBe('00:00');

        // Formats de durées
        expect(SessionTimer.formaterTemps(125)).toBe('2:05');
        expect(SessionTimer.formaterDureeSeance(75)).toBe('01:15');
        expect(SessionTimer.formaterDureeSeance(3665)).toBe('1h01:05');
    });
});


