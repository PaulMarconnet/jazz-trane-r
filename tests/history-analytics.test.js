import { describe, it, expect } from 'vitest';
import HistoryAnalytics from '../www/modules/history-analytics.js';

describe('HistoryAnalytics — Seam 1 : Calcul de durée et identité stricte entre indicateurs et séries de graphiques', () => {
    it('calcule la durée réelle d\'une séance avec SessionTimer ou repli sur duree_reelle / items', () => {
        // Séance avec duree_reelle explicite (en secondes)
        const s1 = { id: 1, statut: 'terminee', duree_reelle: 1800 };
        expect(HistoryAnalytics.calculateSessionDuration(s1)).toBe(1800); // 30 min en secondes
        expect(HistoryAnalytics.calculateSessionDurationMinutes(s1)).toBe(30);

        // Séance sans duree_reelle mais avec items faits
        const s2 = {
            id: 2,
            statut: 'terminee',
            items: [
                { fait: true, temps_prevu: 10, temps_restant: 120, isOvertime: false }, // 10 min - 2 min = 8 min = 480s
                { fait: true, temps_prevu: 15, temps_restant: 300, isOvertime: true },  // 15 min + 5 min = 20 min = 1200s
                { fait: false, temps_prevu: 10, temps_restant: 600, isOvertime: false } // non fait
            ]
        };
        // 480s + 1200s = 1680s = 28 min
        expect(HistoryAnalytics.calculateSessionDuration(s2)).toBe(1680);
        expect(HistoryAnalytics.calculateSessionDurationMinutes(s2)).toBe(28);

        // Séance avec item.duree_reelle_secondes explicite
        const s3 = {
            id: 3,
            statut: 'terminee',
            items: [
                { fait: true, duree_reelle_secondes: 900 }
            ]
        };
        expect(HistoryAnalytics.calculateSessionDuration(s3)).toBe(900);
        expect(HistoryAnalytics.calculateSessionDurationMinutes(s3)).toBe(15);

        // Séance vide
        expect(HistoryAnalytics.calculateSessionDuration(null)).toBe(0);
        expect(HistoryAnalytics.calculateSessionDurationMinutes({})).toBe(0);
    });

    it('calcule le lundi de la semaine à 00:00:00 local pour n\'importe quelle date', () => {
        // Jeudi 29 Octobre 2026 à 14:30:00
        const now = new Date(2026, 9, 29, 14, 30, 0); // Mois 9 = Octobre (0-indexé)
        const monday = HistoryAnalytics.getMonday(now);

        expect(monday.getFullYear()).toBe(2026);
        expect(monday.getMonth()).toBe(9);
        expect(monday.getDate()).toBe(26); // Lundi 26 Octobre 2026
        expect(monday.getHours()).toBe(0);
        expect(monday.getMinutes()).toBe(0);
        expect(monday.getSeconds()).toBe(0);

        // Dimanche 1er Novembre 2026 -> son lundi est toujours le 26 Octobre 2026
        const sunday = new Date(2026, 10, 1, 22, 0, 0);
        const mondayFromSun = HistoryAnalytics.getMonday(sunday);
        expect(mondayFromSun.getDate()).toBe(26);
        expect(mondayFromSun.getMonth()).toBe(9);
    });

    it('garantit l\'identité stricte entre la durée totale hebdomadaire et la somme des barres du graphique semaine', () => {
        // Date de référence : Mercredi 28 Octobre 2026 à 15:00
        const now = new Date(2026, 9, 28, 15, 0, 0);

        const seances = [
            // Lundi 26 Octobre 2026 : 45 min
            { id: 101, statut: 'terminee', date_seance: '2026-10-26T10:00:00', duree_reelle: 2700 },
            // Mardi 27 Octobre 2026 : 60 min
            { id: 102, statut: 'terminee', date_seance: '2026-10-27T18:30:00', duree_reelle: 3600 },
            // Mercredi 28 Octobre 2026 (aujourd'hui) : 30 min
            { id: 103, statut: 'terminee', date_seance: '2026-10-28T11:15:00', duree_reelle: 1800 },
            // Dimanche 25 Octobre 2026 (semaine précédente !) : 90 min - ne doit PAS être compté dans cette semaine
            { id: 99, statut: 'terminee', date_seance: '2026-10-25T16:00:00', duree_reelle: 5400 },
            // Non terminée : ignorée
            { id: 104, statut: 'en_cours', date_seance: '2026-10-28T14:00:00', duree_reelle: 1200 }
        ];

        const summary = HistoryAnalytics.calculateHistorySummary(seances, { now });
        const chartWeek = HistoryAnalytics.calculatePeriodChartData(seances, 'semaine', { now });

        // 45 + 60 + 30 = 135 minutes = 2h15 = 2.25 heures (arrondi à 2.3h pour l'affichage graphique 1 décimale)
        expect(summary.weeklyDurationMinutes).toBe(135);
        expect(chartWeek.totalMinutes).toBe(135);

        // INVARIANT ABSOLU : Zéro divergence entre summary et chart
        expect(summary.weeklyDurationMinutes).toBe(chartWeek.totalMinutes);

        // La somme des 7 barres journalières (Lun à Dim) doit correspondre exactement au totalMinutes
        const sumBarMinutes = chartWeek.dataMinutes.reduce((sum, m) => sum + m, 0);
        expect(sumBarMinutes).toBe(135);
        expect(chartWeek.labels).toEqual(['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']);
        expect(chartWeek.dataMinutes).toEqual([45, 60, 30, 0, 0, 0, 0]);

        // Vérification des données en heures pour Chart.js (arrondies à 1 décimale)
        expect(chartWeek.dataHours).toEqual([0.8, 1.0, 0.5, 0, 0, 0, 0]);
        expect(chartWeek.totalHoursFormatted).toBe('2.3');
    });

    it('calcule correctement les périodes mois, annee et total sans divergence de totalMinutes', () => {
        const now = new Date(2026, 9, 28, 15, 0, 0); // 28 Octobre 2026

        const seances = [
            { id: 1, statut: 'terminee', date_seance: '2026-10-02T10:00:00', duree_reelle: 3600 }, // 60 min (Semaine 1 du mois)
            { id: 2, statut: 'terminee', date_seance: '2026-10-15T10:00:00', duree_reelle: 1800 }, // 30 min (Semaine 3 du mois)
            { id: 3, statut: 'terminee', date_seance: '2026-09-10T10:00:00', duree_reelle: 5400 }, // 90 min (Mois précédent, mais même année)
            { id: 4, statut: 'terminee', date_seance: '2025-11-20T10:00:00', duree_reelle: 7200 }  // 120 min (Année précédente)
        ];

        // Mois : seances 1 et 2 -> 90 min
        const chartMonth = HistoryAnalytics.calculatePeriodChartData(seances, 'mois', { now });
        expect(chartMonth.totalMinutes).toBe(90);
        expect(chartMonth.dataMinutes.reduce((a, b) => a + b, 0)).toBe(90);

        // Année : seances 1, 2, 3 -> 60 + 30 + 90 = 180 min (3.0h)
        const chartYear = HistoryAnalytics.calculatePeriodChartData(seances, 'annee', { now });
        expect(chartYear.totalMinutes).toBe(180);
        expect(chartYear.dataMinutes.reduce((a, b) => a + b, 0)).toBe(180);

        // Total : toutes les 4 séances -> 60 + 30 + 90 + 120 = 300 min (5.0h)
        const chartTotal = HistoryAnalytics.calculatePeriodChartData(seances, 'total', { now });
        expect(chartTotal.totalMinutes).toBe(300);
        expect(chartTotal.dataMinutes.reduce((a, b) => a + b, 0)).toBe(300);
    });
});

describe('HistoryAnalytics — Seam 2 : Calcul calendaire du Streak (jours consécutifs)', () => {
    it('calcule un streak de 0 si aucune séance terminée ou si le dernier jour pratiqué remonte à avant-hier', () => {
        const now = new Date(2026, 9, 29, 14, 0, 0); // 29 Octobre 2026

        expect(HistoryAnalytics.calculateStreak([], now)).toBe(0);
        expect(HistoryAnalytics.calculateStreak(null, now)).toBe(0);

        // Dernière séance le 27 Octobre (avant-hier) -> série brisée, streak = 0
        const seances = [
            { id: 1, statut: 'terminee', date_seance: '2026-10-27T10:00:00' },
            { id: 2, statut: 'terminee', date_seance: '2026-10-26T10:00:00' }
        ];
        expect(HistoryAnalytics.calculateStreak(seances, now)).toBe(0);
    });

    it('calcule la série active si l\'utilisateur a pratiqué aujourd\'hui', () => {
        const now = new Date(2026, 9, 29, 20, 0, 0); // 29 Octobre 2026

        const seances = [
            // Aujourd'hui (29/10) - 2 séances
            { id: 1, statut: 'terminee', date_seance: '2026-10-29T09:00:00' },
            { id: 2, statut: 'terminee', date_seance: '2026-10-29T18:00:00' },
            // Hier (28/10)
            { id: 3, statut: 'terminee', date_seance: '2026-10-28T15:00:00' },
            // Avant-hier (27/10)
            { id: 4, statut: 'terminee', date_seance: '2026-10-27T12:00:00' },
            // Pas de séance le 26/10
            // Séance le 25/10 (non prise en compte car coupure le 26)
            { id: 5, statut: 'terminee', date_seance: '2026-10-25T11:00:00' }
        ];

        // 29, 28, 27 = 3 jours consécutifs
        expect(HistoryAnalytics.calculateStreak(seances, now)).toBe(3);
    });

    it('maintient la série si l\'utilisateur n\'a pas encore pratiqué aujourd\'hui mais a pratiqué hier', () => {
        const now = new Date(2026, 9, 29, 8, 0, 0); // 29 Octobre matin (pas encore joué aujourd'hui)

        const seances = [
            // Hier (28/10)
            { id: 1, statut: 'terminee', date_seance: '2026-10-28T15:00:00' },
            // Avant-hier (27/10)
            { id: 2, statut: 'terminee', date_seance: '2026-10-27T12:00:00' },
            // 26/10
            { id: 3, statut: 'terminee', date_seance: '2026-10-26T10:00:00' },
            // 25/10
            { id: 4, statut: 'terminee', date_seance: '2026-10-25T19:00:00' }
        ];

        // 28, 27, 26, 25 = 4 jours consécutifs
        expect(HistoryAnalytics.calculateStreak(seances, now)).toBe(4);
    });

    it('injecte streak dans calculateHistorySummary', () => {
        const now = new Date(2026, 9, 29, 12, 0, 0);
        const seances = [
            { id: 1, statut: 'terminee', date_seance: '2026-10-29T10:00:00', duree_reelle: 1800 },
            { id: 2, statut: 'terminee', date_seance: '2026-10-28T10:00:00', duree_reelle: 1800 }
        ];
        const summary = HistoryAnalytics.calculateHistorySummary(seances, { now });
        expect(summary.streakDays).toBe(2);
    });
});

describe('HistoryAnalytics — Seam 3 : Tonalités relatives majeures et détection de la tonalité reine', () => {
    it('regroupe correctement les tonalités mineures vers leur relative majeure', () => {
        // En français
        expect(HistoryAnalytics.getRelativeMajorKey('A mineur')).toBe('C majeur');
        expect(HistoryAnalytics.getRelativeMajorKey('C mineur')).toBe('Eb majeur');
        expect(HistoryAnalytics.getRelativeMajorKey('D mineur')).toBe('F majeur');
        expect(HistoryAnalytics.getRelativeMajorKey('G mineur')).toBe('Bb majeur');
        expect(HistoryAnalytics.getRelativeMajorKey('E mineur')).toBe('G majeur');
        expect(HistoryAnalytics.getRelativeMajorKey('B mineur')).toBe('D majeur');
        expect(HistoryAnalytics.getRelativeMajorKey('F mineur')).toBe('Ab majeur');
        expect(HistoryAnalytics.getRelativeMajorKey('Bb mineur')).toBe('Db majeur');
        expect(HistoryAnalytics.getRelativeMajorKey('Eb mineur')).toBe('Gb majeur');
        expect(HistoryAnalytics.getRelativeMajorKey('Ab mineur')).toBe('B majeur');
        expect(HistoryAnalytics.getRelativeMajorKey('Db mineur')).toBe('E majeur');
        expect(HistoryAnalytics.getRelativeMajorKey('Gb mineur')).toBe('A majeur');

        // En anglais ou notation jazz (minor, -)
        expect(HistoryAnalytics.getRelativeMajorKey('C minor')).toBe('Eb majeur');
        expect(HistoryAnalytics.getRelativeMajorKey('A-')).toBe('C majeur');
        expect(HistoryAnalytics.getRelativeMajorKey('Dm')).toBe('F majeur');

        // Les tonalités déjà majeures restent inchangées (normalisées en majeur)
        expect(HistoryAnalytics.getRelativeMajorKey('F majeur')).toBe('F majeur');
        expect(HistoryAnalytics.getRelativeMajorKey('Bb major')).toBe('Bb majeur');
        expect(HistoryAnalytics.getRelativeMajorKey('Eb')).toBe('Eb majeur');

        // Null ou vide
        expect(HistoryAnalytics.getRelativeMajorKey('')).toBeNull();
        expect(HistoryAnalytics.getRelativeMajorKey(null)).toBeNull();
    });

    it('calcule la tonalité reine et la distribution des tonalités relatives', () => {
        const seances = [
            { id: 1, statut: 'terminee', tonalite_du_jour: 'A mineur' }, // -> C majeur
            { id: 2, statut: 'terminee', tonalite_du_jour: 'C majeur' }, // -> C majeur
            { id: 3, statut: 'terminee', tonalite_du_jour: 'C minor' },  // -> Eb majeur
            { id: 4, statut: 'terminee', tonalite_du_jour: 'Eb majeur' },// -> Eb majeur
            { id: 5, statut: 'terminee', tonalite_du_jour: 'Eb mineur' },// -> Gb majeur
            { id: 6, statut: 'terminee', tonalite_du_jour: 'C majeur' }  // -> C majeur
        ];

        // C majeur apparaît 3 fois (1x A mineur, 2x C majeur)
        // Eb majeur apparaît 2 fois (1x C minor, 1x Eb majeur)
        // Gb majeur apparaît 1 fois (1x Eb mineur)
        const dist = HistoryAnalytics.calculateTonalitiesDistribution(seances);
        expect(dist).toEqual({
            'C majeur': 3,
            'Eb majeur': 2,
            'Gb majeur': 1
        });

        expect(HistoryAnalytics.calculateReineTonalite(seances)).toBe('C majeur');
    });

    it('intègre la tonalité reine dans calculateHistorySummary et la distribution dans calculatePeriodChartData', () => {
        const now = new Date(2026, 9, 29, 12, 0, 0);
        const seances = [
            { id: 1, statut: 'terminee', date_seance: '2026-10-28T10:00:00', duree_reelle: 1800, tonalite_du_jour: 'G mineur' }, // Bb majeur
            { id: 2, statut: 'terminee', date_seance: '2026-10-29T10:00:00', duree_reelle: 1800, tonalite_du_jour: 'Bb majeur' }  // Bb majeur
        ];

        const summary = HistoryAnalytics.calculateHistorySummary(seances, { now });
        expect(summary.reineTonalite).toBe('Bb majeur');

        const chart = HistoryAnalytics.calculatePeriodChartData(seances, 'semaine', { now });
        expect(chart.tonalities.labels).toEqual(['Bb majeur']);
        expect(chart.tonalities.counts).toEqual([2]);
    });
});

describe('HistoryAnalytics — Seam 5 : Analytique par catégorie, pourcentages exacts et étiquetage camembert', () => {
    it('calcule le temps par catégorie et des pourcentages exacts totalisant strictement 100%', () => {
        const now = new Date(2026, 9, 29, 12, 0, 0);

        const seances = [
            {
                id: 1,
                statut: 'terminee',
                date_seance: '2026-10-28T10:00:00',
                items: [
                    // Morceaux : 30 min (1800s)
                    { fait: true, categorie: 'Morceaux', temps_prevu: 30, temps_restant: 0, isOvertime: false },
                    // Voicings : 15 min (900s)
                    { fait: true, categorie: 'Voicings', temps_prevu: 15, temps_restant: 0, isOvertime: false },
                    // Technique : 15 min (900s)
                    { fait: true, categorie: 'Technique', temps_prevu: 15, temps_restant: 0, isOvertime: false },
                    // Non fait : ne compte pas
                    { fait: false, categorie: 'Licks', temps_prevu: 20, temps_restant: 20, isOvertime: false }
                ]
            }
        ];

        // Total catégorie = 30 + 15 + 15 = 60 min
        // Morceaux : 30 / 60 = 50%
        // Voicings : 15 / 60 = 25%
        // Technique : 15 / 60 = 25%
        const chart = HistoryAnalytics.calculatePeriodChartData(seances, 'semaine', { now });
        expect(chart.categories.labels).toEqual(['Morceaux', 'Voicings', 'Technique']);
        expect(chart.categories.dataMinutes).toEqual([30, 15, 15]);
        expect(chart.categories.percentages).toEqual([50, 25, 25]);
        expect(chart.categories.formattedLabels).toEqual([
            'Morceaux · 50%',
            'Voicings · 25%',
            'Technique · 25%'
        ]);

        const totalPct = chart.categories.percentages.reduce((a, b) => a + b, 0);
        expect(totalPct).toBe(100);
    });

    it('résout le biais d\'arrondi des pourcentages pour que la somme fasse toujours 100%', () => {
        // 3 catégories avec des durées causant des arrondis qui feraient 33% + 33% + 33% = 99%
        const counts = { 'Morceaux': 10, 'Voicings': 10, 'Technique': 10 }; // 10/30 = 33.333%
        const pcts = HistoryAnalytics.calculateExactPercentages(counts);

        // L'algorithme du plus fort reste (Largest Remainder) doit ajuster pour totaliser 100%
        expect(pcts.percentages.reduce((a, b) => a + b, 0)).toBe(100);
        expect(pcts.formattedLabels).toEqual([
            'Morceaux · 34%',
            'Voicings · 33%',
            'Technique · 33%'
        ]);
    });

    it('génère une palette contrastée intercalée pour éviter les segments adjacents trop similaires', () => {
        const baseColors = [
            '#e3a24a', // ambre
            '#9aae7c', // vert clair
            '#d4a359', // ocre (très proche de l'ambre)
            '#cc6a4e', // rouge terracotta
            '#b8bb26', // vert olive
            '#c9a86a', // or chamois (très proche ocre/ambre)
            '#8fa876', // vert sauge
            '#dbc8ae'  // sable clair
        ];

        const palette4 = HistoryAnalytics.getContrastingPalette(baseColors, 4);
        expect(palette4.length).toBe(4);
        // Les couleurs adjacentes ne doivent pas être consécutives dans le nuancier d'origine si proches
        expect(palette4[0]).toBe('#e3a24a');
        expect(palette4[1]).not.toBe('#d4a359'); // Ne pas coller ocre immédiatement après ambre

        const paletteEmpty = HistoryAnalytics.getContrastingPalette(null, 3);
        expect(paletteEmpty.length).toBe(3);
    });

    it('fournit le plugin Chart.js pour l\'étiquetage visuel du camembert et gère les thèmes clair et sombre', () => {
        const plugin = HistoryAnalytics.createCategoryDoughnutPlugin({
            isLight: true,
            textSecondaryColor: '#745863',
            textColor: '#2d2325',
            textMutedColor: '#6b575d'
        });
        expect(plugin).toBeDefined();
        expect(plugin.id).toBe('categoryDoughnutLabels');
        expect(typeof plugin.afterDraw).toBe('function');

        // Mock d'un chart Chart.js
        const fillStyles = [];
        const filledTexts = [];
        const mockCtx = {
            save: () => {},
            restore: () => {},
            measureText: () => ({ width: 40 }),
            beginPath: () => {},
            fill: () => {},
            stroke: () => {},
            roundRect: () => {},
            fillText: (text) => {
                fillStyles.push(mockCtx.fillStyle);
                filledTexts.push(text);
            },
            font: '',
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 1,
            textAlign: '',
            textBaseline: ''
        };

        const mockChart = {
            config: { type: 'doughnut', options: {} },
            ctx: mockCtx,
            chartArea: { left: 0, right: 200, top: 0, bottom: 200 },
            getActiveElements: () => [{ index: 0 }],
            getDatasetMeta: () => ({
                data: [
                    { innerRadius: 50, outerRadius: 80, startAngle: 0, endAngle: 1.5, x: 100, y: 100 }
                ]
            }),
            data: {
                labels: ['Morceaux'],
                formattedLabels: ['Morceaux · 100%'],
                durationsFormatted: ['1h00'],
                datasets: [{
                    data: [60],
                    backgroundColor: ['#c2782b']
                }]
            }
        };

        plugin.afterDraw(mockChart);

        // Doit avoir affiché le nom de la catégorie avec la couleur secondaire en thème clair
        expect(filledTexts).toContain('Morceaux');
        expect(fillStyles).toContain('#745863');
    });
});

describe('HistoryAnalytics — Seam 4 : Objectif hebdomadaire et statistiques de série pour modales interactives', () => {
    it('calcule correctement l\'objectif hebdomadaire (ou son absence si 0 ou non défini)', () => {
        // Sans objectif (0 ou non défini)
        const noGoal = HistoryAnalytics.calculateWeeklyGoal(180, 0);
        expect(noGoal.hasGoal).toBe(false);
        expect(noGoal.goalHours).toBe(0);
        expect(noGoal.percentage).toBe(0);
        expect(noGoal.isCompleted).toBe(false);
        expect(noGoal.progressRatio).toBe(0);
        expect(noGoal.formattedPercentage).toBe('-- %');

        const undefGoal = HistoryAnalytics.calculateWeeklyGoal(180, null);
        expect(undefGoal.hasGoal).toBe(false);

        // Objectif 5h (300 min), réalisé 204 min -> 68%
        const inProgress = HistoryAnalytics.calculateWeeklyGoal(204, 5);
        expect(inProgress.hasGoal).toBe(true);
        expect(inProgress.goalHours).toBe(5);
        expect(inProgress.goalMinutes).toBe(300);
        expect(inProgress.weeklyMinutes).toBe(204);
        expect(inProgress.percentage).toBe(68);
        expect(inProgress.isCompleted).toBe(false);
        expect(inProgress.progressRatio).toBeCloseTo(0.68, 2);
        expect(inProgress.formattedPercentage).toBe('68 %');

        // Objectif 5h, réalisé 300 min -> 100% (complété)
        const completed = HistoryAnalytics.calculateWeeklyGoal(300, 5);
        expect(completed.hasGoal).toBe(true);
        expect(completed.percentage).toBe(100);
        expect(completed.isCompleted).toBe(true);
        expect(completed.progressRatio).toBe(1.0);
        expect(completed.formattedPercentage).toBe('100 %');

        // Objectif 5h, réalisé 360 min -> 100% (complété, plafonné strictement à 100%, barre bornée à 1.0)
        const exceeded = HistoryAnalytics.calculateWeeklyGoal(360, 5);
        expect(exceeded.hasGoal).toBe(true);
        expect(exceeded.percentage).toBe(100);
        expect(exceeded.rawPercentage).toBe(120);
        expect(exceeded.isCompleted).toBe(true);
        expect(exceeded.progressRatio).toBe(1.0);
        expect(exceeded.formattedPercentage).toBe('100 %');
    });

    it('calcule les statistiques de série avancées (streak en cours, record historique, 30 derniers jours)', () => {
        const now = new Date(2026, 9, 29, 14, 0, 0); // Jeudi 29 Octobre 2026

        const seances = [
            // Série en cours : 29, 28, 27 (3 jours)
            { id: 1, statut: 'terminee', date_seance: '2026-10-29T10:00:00', duree_reelle: 1800 },
            { id: 2, statut: 'terminee', date_seance: '2026-10-28T10:00:00', duree_reelle: 1800 },
            { id: 3, statut: 'terminee', date_seance: '2026-10-27T10:00:00', duree_reelle: 1800 },
            // Pause le 26
            // Ancienne série record de 5 jours : 20, 21, 22, 23, 24 Octobre
            { id: 4, statut: 'terminee', date_seance: '2026-10-24T10:00:00', duree_reelle: 1800 },
            { id: 5, statut: 'terminee', date_seance: '2026-10-23T10:00:00', duree_reelle: 1800 },
            { id: 6, statut: 'terminee', date_seance: '2026-10-22T10:00:00', duree_reelle: 1800 },
            { id: 7, statut: 'terminee', date_seance: '2026-10-21T10:00:00', duree_reelle: 1800 },
            { id: 8, statut: 'terminee', date_seance: '2026-10-20T10:00:00', duree_reelle: 1800 }
        ];

        const stats = HistoryAnalytics.calculateStreakStats(seances, now);
        expect(stats.currentStreak).toBe(3);
        expect(stats.maxStreak).toBe(5); // Record all-time
        expect(stats.totalActiveDays).toBe(8);
        expect(stats.monthActiveDays).toBe(8); // Tous en octobre

        // Vérifie les 30 derniers jours
        expect(stats.last30Days.length).toBe(30);
        const todayObj = stats.last30Days[stats.last30Days.length - 1];
        expect(todayObj.dateKey).toBe('2026-10-29');
        expect(todayObj.isToday).toBe(true);
        expect(todayObj.hasPractice).toBe(true);

        const yesterdayObj = stats.last30Days[stats.last30Days.length - 2];
        expect(yesterdayObj.dateKey).toBe('2026-10-28');
        expect(yesterdayObj.hasPractice).toBe(true);
    });

    it('intègre l\'objectif hebdomadaire dans calculateHistorySummary', () => {
        const now = new Date(2026, 9, 29, 12, 0, 0); // Semaine du lundi 26 oct
        const seances = [
            // 60 min cette semaine
            { id: 1, statut: 'terminee', date_seance: '2026-10-28T10:00:00', duree_reelle: 3600 }
        ];

        // Objectif 2h (120 min) -> 60/120 = 50%
        const summary = HistoryAnalytics.calculateHistorySummary(seances, { now, weeklyGoalHours: 2 });
        expect(summary.weeklyGoal).toBeDefined();
        expect(summary.weeklyGoal.hasGoal).toBe(true);
        expect(summary.weeklyGoal.percentage).toBe(50);
        expect(summary.weeklyGoal.isCompleted).toBe(false);

        // Sans option weeklyGoalHours
        const summaryNoGoal = HistoryAnalytics.calculateHistorySummary(seances, { now });
        expect(summaryNoGoal.weeklyGoal.hasGoal).toBe(false);
    });

    it('calcule la grille mensuelle civile complète pour le Calendrier de pratique (comme Google Agenda)', () => {
        const now = new Date(2026, 9, 29, 14, 0, 0); // Jeudi 29 Octobre 2026

        const seances = [
            { id: 1, statut: 'terminee', date_seance: '2026-10-29T10:00:00', duree_reelle: 1800 },
            { id: 2, statut: 'terminee', date_seance: '2026-10-28T10:00:00', duree_reelle: 2400 },
            { id: 3, statut: 'terminee', date_seance: '2026-10-01T10:00:00', duree_reelle: 1200 }
        ];

        const cal = HistoryAnalytics.calculateMonthCalendar(seances, 2026, 9, { now, locale: 'fr-FR' });

        expect(cal.year).toBe(2026);
        expect(cal.month).toBe(9);
        expect(cal.daysInMonth).toBe(31);
        expect(cal.monthActiveDays).toBe(3);
        expect(cal.weekdays).toEqual(['L', 'M', 'M', 'J', 'V', 'S', 'D']);

        // Octobre 2026 commence un jeudi -> 3 jours de padding en septembre (28, 29, 30)
        // et se termine un samedi 31 -> 1 jour de padding en novembre (1er)
        // Total : 3 + 31 + 1 = 35 jours (5 semaines complètes de 7 jours)
        expect(cal.days.length).toBe(35);

        // Premier jour de la grille : Lundi 28 Septembre (hors mois)
        expect(cal.days[0].dateKey).toBe('2026-09-28');
        expect(cal.days[0].dayNum).toBe(28);
        expect(cal.days[0].isCurrentMonth).toBe(false);

        // Quatrième jour : Jeudi 1er Octobre (dans le mois)
        expect(cal.days[3].dateKey).toBe('2026-10-01');
        expect(cal.days[3].dayNum).toBe(1);
        expect(cal.days[3].isCurrentMonth).toBe(true);
        expect(cal.days[3].hasPractice).toBe(true);
        expect(cal.days[3].totalMinutes).toBe(20);

        // 29 Octobre : aujourd'hui, avec séance
        const day29 = cal.days.find(d => d.dateKey === '2026-10-29');
        expect(day29).toBeDefined();
        expect(day29.isToday).toBe(true);
        expect(day29.hasPractice).toBe(true);
        expect(day29.totalMinutes).toBe(30);

        // Dernier jour : Dimanche 1er Novembre (hors mois)
        expect(cal.days[34].dateKey).toBe('2026-11-01');
        expect(cal.days[34].dayNum).toBe(1);
        expect(cal.days[34].isCurrentMonth).toBe(false);
    });
});
