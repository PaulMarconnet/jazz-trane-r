// Module 2 : Machine à États Temporelle de Séance (session-timer)
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SessionTimer = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    function formaterTemps(secondes) {
        if (!Number.isFinite(secondes) || isNaN(secondes) || secondes < 0) return "0:00";
        const sec = Math.floor(secondes);
        return `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;
    }

    function formaterDureeSeance(secondes) {
        const s = Math.max(0, Math.floor(secondes));
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (h > 0) {
            return `${h}h${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
        }
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }

    function formatClock24h(dateOrTimestamp) {
        const d = (dateOrTimestamp instanceof Date)
            ? dateOrTimestamp
            : (dateOrTimestamp ? new Date(dateOrTimestamp) : new Date());
        const hours = d.getHours().toString().padStart(2, '0');
        const minutes = d.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    function calculateSessionRealDuration(seance, nowInput) {
        if (!seance) return 0;
        const now = (nowInput !== undefined && nowInput !== null) ? nowInput : Date.now();

        if (seance.statut === 'terminee' && seance.duree_reelle !== undefined && seance.duree_reelle !== null && Number(seance.duree_reelle) > 0) {
            return Math.round(Number(seance.duree_reelle));
        }

        if (seance.timestamp_debut) {
            let pauseMs = Number(seance.temps_pause_cumule_ms || 0);
            if (seance.pause_active_debut) {
                pauseMs += Math.max(0, now - seance.pause_active_debut);
            }
            const totalMs = Math.max(0, (now - seance.timestamp_debut) - pauseMs);
            const totalSec = Math.floor(totalMs / 1000);
            if (totalSec > 0) return totalSec;
        }

        // Repli calcul par somme des exercices faits
        if (Array.isArray(seance.items)) {
            let sumSec = 0;
            for (const item of seance.items) {
                if (item && item.fait) {
                    if (item.duree_reelle_secondes !== undefined && item.duree_reelle_secondes !== null) {
                        sumSec += Math.max(0, Number(item.duree_reelle_secondes) || 0);
                    } else {
                        const prevuSecs = Number(item.temps_prevu || 0) * 60;
                        const restantSecs = Number(item.temps_restant || 0);
                        const reelSecs = item.isOvertime ? (prevuSecs + restantSecs) : Math.max(0, prevuSecs - restantSecs);
                        sumSec += reelSecs;
                    }
                }
            }
            if (sumSec > 0) return Math.round(sumSec);
        }

        return 0;
    }

    function createTimerMachine(options = {}) {
        let workSec = Math.max(1, (options.workSec !== undefined ? options.workSec : (50 * 60)));
        let breakSec = Math.max(1, (options.breakSec !== undefined ? options.breakSec : (5 * 60)));
        const afkLimitSec = (options.afkLimitSec !== undefined) ? options.afkLimitSec : 3600;

        // Session Meta
        let session = {
            id: null,
            timestamp_debut: null,
            temps_pause_cumule_ms: 0,
            pause_active_debut: null
        };

        // Active Exercise State
        let activeExercise = {
            index: null,
            plannedSeconds: 0,
            remainingSecsAtPause: 0,
            isOvertime: false,
            isPaused: false,
            endTime: null,
            overtimeStartTime: null
        };

        // Pomodoro State
        let pomodoro = {
            workRemainingSec: workSec,
            isRunning: false,
            isBreakPending: false,
            endTime: null
        };

        // Coffee Break State
        let coffeeBreak = {
            isActive: false,
            endTime: null,
            remainingSec: 0
        };

        // Interaction & AFK
        let lastInteractionTime = null;

        function startSession(meta, now) {
            const current = (now !== undefined && now !== null) ? now : Date.now();
            session.id = meta ? (meta.id || null) : null;
            session.timestamp_debut = (meta && meta.timestamp_debut) ? meta.timestamp_debut : current;
            session.temps_pause_cumule_ms = (meta && Number(meta.temps_pause_cumule_ms)) || 0;
            session.pause_active_debut = (meta && meta.pause_active_debut) || null;
            if (lastInteractionTime === null) lastInteractionTime = current;
        }

        function restoreSession(savedMeta, now) {
            startSession(savedMeta, now);
        }

        function recordInteraction(now) {
            lastInteractionTime = (now !== undefined && now !== null) ? now : Date.now();
        }

        function setPomodoroConfig(config = {}) {
            if (typeof config.workMinutes === 'number') {
                workSec = Math.max(1, config.workMinutes * 60);
                if (!pomodoro.isRunning) {
                    pomodoro.workRemainingSec = workSec;
                }
            }
            if (typeof config.breakMinutes === 'number') {
                breakSec = Math.max(1, config.breakMinutes * 60);
            }
        }

        function startExercise(index, exerciseInfo, now) {
            const current = (now !== undefined && now !== null) ? now : Date.now();
            recordInteraction(current);

            // Si la séance n'avait pas encore démarré
            if (!session.timestamp_debut) {
                session.timestamp_debut = current;
                session.temps_pause_cumule_ms = 0;
                session.pause_active_debut = null;
            } else if (session.pause_active_debut) {
                session.temps_pause_cumule_ms += (current - session.pause_active_debut);
                session.pause_active_debut = null;
            }

            const info = exerciseInfo || {};
            const plannedSec = Number(info.plannedSeconds || 0);
            const remainingSec = (info.remainingSeconds !== undefined && info.remainingSeconds !== null)
                ? Number(info.remainingSeconds)
                : plannedSec;
            const isOvertime = Boolean(info.isOvertime || remainingSec < 0);
            const absRemaining = Math.abs(remainingSec);

            activeExercise.index = index;
            activeExercise.plannedSeconds = plannedSec;
            activeExercise.isOvertime = isOvertime;
            activeExercise.isPaused = false;
            activeExercise.remainingSecsAtPause = absRemaining;

            if (isOvertime) {
                activeExercise.endTime = null;
                activeExercise.overtimeStartTime = current - (absRemaining * 1000);
            } else {
                activeExercise.endTime = current + (absRemaining * 1000);
                activeExercise.overtimeStartTime = null;
            }

            // Démarrage / Reprise du Pomodoro
            if (!coffeeBreak.isActive && !pomodoro.isRunning && !pomodoro.isBreakPending) {
                pomodoro.isRunning = true;
                pomodoro.endTime = current + (pomodoro.workRemainingSec * 1000);
            }
        }

        function pauseExercise(now) {
            if (activeExercise.index === null || activeExercise.isPaused) return;
            const current = (now !== undefined && now !== null) ? now : Date.now();
            recordInteraction(current);

            activeExercise.isPaused = true;
            // Calculer displaySecs à cet instant
            let displaySecs = 0;
            if (!activeExercise.isOvertime) {
                displaySecs = Math.max(0, Math.ceil((activeExercise.endTime - current) / 1000));
            } else {
                displaySecs = Math.max(0, Math.floor((current - activeExercise.overtimeStartTime) / 1000));
            }
            activeExercise.remainingSecsAtPause = displaySecs;

            // Pause de la séance
            if (!session.pause_active_debut) {
                session.pause_active_debut = current;
            }

            // Pause du Pomodoro
            if (pomodoro.isRunning) {
                const pomoLeft = Math.max(0, Math.ceil((pomodoro.endTime - current) / 1000));
                pomodoro.workRemainingSec = pomoLeft;
                pomodoro.isRunning = false;
                pomodoro.endTime = null;
            }
        }

        function resumeExercise(now) {
            if (activeExercise.index === null || !activeExercise.isPaused) return;
            const current = (now !== undefined && now !== null) ? now : Date.now();
            recordInteraction(current);

            activeExercise.isPaused = false;
            const secs = activeExercise.remainingSecsAtPause;
            if (!activeExercise.isOvertime) {
                activeExercise.endTime = current + (secs * 1000);
            } else {
                activeExercise.overtimeStartTime = current - (secs * 1000);
            }

            // Reprise de la séance
            if (session.pause_active_debut) {
                session.temps_pause_cumule_ms += (current - session.pause_active_debut);
                session.pause_active_debut = null;
            }

            // Reprise du Pomodoro si pas de pause café
            if (!coffeeBreak.isActive && !pomodoro.isBreakPending) {
                pomodoro.isRunning = true;
                pomodoro.endTime = current + (pomodoro.workRemainingSec * 1000);
            }
        }

        function togglePause(now) {
            if (activeExercise.index === null) return;
            if (activeExercise.isPaused) {
                resumeExercise(now);
            } else {
                pauseExercise(now);
            }
        }

        function completeExercise(now) {
            if (activeExercise.index === null) return null;
            const current = (now !== undefined && now !== null) ? now : Date.now();
            recordInteraction(current);

            let displaySecs = activeExercise.remainingSecsAtPause;
            if (!activeExercise.isPaused) {
                if (!activeExercise.isOvertime) {
                    displaySecs = Math.max(0, Math.ceil((activeExercise.endTime - current) / 1000));
                } else {
                    displaySecs = Math.max(0, Math.floor((current - activeExercise.overtimeStartTime) / 1000));
                }
            }

            const planned = activeExercise.plannedSeconds;
            const isOvertime = activeExercise.isOvertime;
            const remaining = displaySecs;
            const real = isOvertime ? (planned + remaining) : Math.max(0, planned - remaining);

            const result = {
                index: activeExercise.index,
                plannedSeconds: planned,
                remainingSeconds: remaining,
                isOvertime: isOvertime,
                realDurationSeconds: real
            };

            // Réinitialiser l'exercice actif
            activeExercise.index = null;
            activeExercise.plannedSeconds = 0;
            activeExercise.remainingSecsAtPause = 0;
            activeExercise.isOvertime = false;
            activeExercise.isPaused = true;
            activeExercise.endTime = null;
            activeExercise.overtimeStartTime = null;

            // Pause de la séance si pas d'autre exercice
            if (!session.pause_active_debut) {
                session.pause_active_debut = current;
            }

            // Pause du Pomodoro
            if (pomodoro.isRunning) {
                pomodoro.workRemainingSec = Math.max(0, Math.ceil((pomodoro.endTime - current) / 1000));
                pomodoro.isRunning = false;
                pomodoro.endTime = null;
            }

            return result;
        }

        function reorderExercises(oldIndex, newIndex) {
            if (activeExercise.index === null) return;
            if (activeExercise.index === oldIndex) {
                activeExercise.index = newIndex;
            } else {
                if (oldIndex < activeExercise.index && newIndex >= activeExercise.index) {
                    activeExercise.index--;
                } else if (oldIndex > activeExercise.index && newIndex <= activeExercise.index) {
                    activeExercise.index++;
                }
            }
        }

        function startCoffeeBreak(now) {
            const current = (now !== undefined && now !== null) ? now : Date.now();
            recordInteraction(current);

            // 1. Mettre en pause l'exercice actif s'il tournait
            if (activeExercise.index !== null && !activeExercise.isPaused) {
                pauseExercise(current);
            } else if (session.timestamp_debut && !session.pause_active_debut) {
                session.pause_active_debut = current;
            }

            coffeeBreak.isActive = true;
            coffeeBreak.endTime = current + (breakSec * 1000);
            coffeeBreak.remainingSec = breakSec;
        }

        function cancelCoffeeBreak(now) {
            const current = (now !== undefined && now !== null) ? now : Date.now();
            recordInteraction(current);
            coffeeBreak.isActive = false;
            coffeeBreak.endTime = null;
            coffeeBreak.remainingSec = 0;
            pomodoro.isBreakPending = false;
            pomodoro.workRemainingSec = workSec;
        }

        function tick(now) {
            const current = (now !== undefined && now !== null) ? now : Date.now();
            if (lastInteractionTime === null) lastInteractionTime = current;

            const events = {
                enteredOvertime: false,
                pomodoroBreakSuggested: false,
                coffeeBreakFinished: false,
                afkTriggered: false,
                afkClosure: null
            };

            // 1. Mise à jour de l'exercice actif
            if (activeExercise.index !== null && !activeExercise.isPaused) {
                if (!activeExercise.isOvertime) {
                    const left = Math.ceil((activeExercise.endTime - current) / 1000);
                    if (left <= 0) {
                        activeExercise.isOvertime = true;
                        activeExercise.overtimeStartTime = activeExercise.endTime || current;
                        activeExercise.remainingSecsAtPause = Math.max(0, Math.floor((current - activeExercise.overtimeStartTime) / 1000));
                        events.enteredOvertime = true;
                    } else {
                        activeExercise.remainingSecsAtPause = left;
                    }
                } else {
                    activeExercise.remainingSecsAtPause = Math.max(0, Math.floor((current - activeExercise.overtimeStartTime) / 1000));
                }
            }

            // 2. Mise à jour du Pomodoro de travail
            if (pomodoro.isRunning) {
                const pomoLeft = Math.ceil((pomodoro.endTime - current) / 1000);
                if (pomoLeft <= 0) {
                    pomodoro.isRunning = false;
                    pomodoro.isBreakPending = true;
                    pomodoro.workRemainingSec = 0;
                    events.pomodoroBreakSuggested = true;
                } else {
                    pomodoro.workRemainingSec = pomoLeft;
                }
            }

            // 3. Mise à jour de la Pause café
            if (coffeeBreak.isActive) {
                const breakLeft = Math.ceil((coffeeBreak.endTime - current) / 1000);
                if (breakLeft <= 0) {
                    coffeeBreak.isActive = false;
                    coffeeBreak.endTime = null;
                    coffeeBreak.remainingSec = 0;
                    pomodoro.isBreakPending = false;
                    pomodoro.workRemainingSec = workSec;
                    events.coffeeBreakFinished = true;
                } else {
                    coffeeBreak.remainingSec = breakLeft;
                }
            }

            // 4. Détecteur AFK
            if (activeExercise.index !== null && activeExercise.isOvertime && !activeExercise.isPaused) {
                const inactivitySec = Math.floor((current - lastInteractionTime) / 1000);
                const overtimeSec = activeExercise.overtimeStartTime ? Math.floor((current - activeExercise.overtimeStartTime) / 1000) : 0;

                if (inactivitySec >= afkLimitSec && overtimeSec >= afkLimitSec) {
                    events.afkTriggered = true;

                    // Clôture AFK :
                    // Exercice plafonné au temps prévu (durée réelle = temps_prevu * 60)
                    const exIndex = activeExercise.index;
                    const exPlannedSec = activeExercise.plannedSeconds;

                    activeExercise.index = null;
                    activeExercise.isPaused = true;
                    activeExercise.isOvertime = false;
                    activeExercise.remainingSecsAtPause = 0;

                    // Durée de séance retranchée de 3600 secondes
                    const rawSessionSec = calculateSessionRealDuration(session, current);
                    const finalSessionSec = Math.max(0, rawSessionSec - afkLimitSec);

                    events.afkClosure = {
                        exerciseIndex: exIndex,
                        exerciseRealDurationSeconds: exPlannedSec,
                        sessionFinalDurationSeconds: finalSessionSec
                    };
                }
            }

            return {
                state: getState(current),
                events
            };
        }

        function getState(now) {
            const current = (now !== undefined && now !== null) ? now : Date.now();
            let displaySecs = activeExercise.remainingSecsAtPause;

            if (activeExercise.index !== null && !activeExercise.isPaused) {
                if (!activeExercise.isOvertime) {
                    displaySecs = Math.max(0, Math.ceil((activeExercise.endTime - current) / 1000));
                } else {
                    displaySecs = Math.max(0, Math.floor((current - activeExercise.overtimeStartTime) / 1000));
                }
            }

            const currentSessionDuration = calculateSessionRealDuration(session, current);

            return {
                activeExercise: {
                    index: activeExercise.index,
                    plannedSeconds: activeExercise.plannedSeconds,
                    displaySeconds: displaySecs,
                    isOvertime: activeExercise.isOvertime,
                    isPaused: activeExercise.isPaused
                },
                pomodoro: {
                    workRemainingSec: pomodoro.isRunning
                        ? Math.max(0, Math.ceil((pomodoro.endTime - current) / 1000))
                        : pomodoro.workRemainingSec,
                    isRunning: pomodoro.isRunning,
                    isBreakPending: pomodoro.isBreakPending
                },
                coffeeBreak: {
                    isActive: coffeeBreak.isActive,
                    remainingSec: coffeeBreak.isActive
                        ? Math.max(0, Math.ceil((coffeeBreak.endTime - current) / 1000))
                        : 0
                },
                sessionMeta: {
                    id: session.id,
                    timestamp_debut: session.timestamp_debut,
                    temps_pause_cumule_ms: session.temps_pause_cumule_ms,
                    pause_active_debut: session.pause_active_debut
                },
                sessionDurationSec: currentSessionDuration
            };
        }

        return {
            startSession,
            restoreSession,
            startExercise,
            pauseExercise,
            resumeExercise,
            togglePause,
            completeExercise,
            reorderExercises,
            startCoffeeBreak,
            cancelCoffeeBreak,
            recordInteraction,
            setPomodoroConfig,
            tick,
            getState
        };
    }

    return {
        name: 'session-timer',
        createTimerMachine,
        calculateSessionRealDuration,
        formaterTemps,
        formaterDureeSeance,
        formatClock24h
    };
}));
