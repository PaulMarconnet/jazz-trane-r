// Module 3 : Analytique d'Historique (history-analytics)
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory(root);
    } else {
        root.HistoryAnalytics = factory(root);
    }
}(typeof self !== 'undefined' ? self : this, function (root) {
    'use strict';

    /**
     * Retourne la durée réelle en secondes d'une séance.
     * Priorité :
     * 1. Calculateur injecté ou SessionTimer.calculateSessionRealDuration
     * 2. s.duree_reelle (stockée en secondes)
     * 3. Somme des items terminés
     */
    function calculateSessionDuration(seance, options) {
        if (!seance || typeof seance !== 'object') return 0;

        const calculator = (options && typeof options.sessionDurationCalculator === 'function')
            ? options.sessionDurationCalculator
            : (root && root.SessionTimer && typeof root.SessionTimer.calculateSessionRealDuration === 'function'
                ? root.SessionTimer.calculateSessionRealDuration
                : null);

        if (calculator) {
            const sec = calculator(seance, options && options.now);
            if (Number.isFinite(sec) && sec > 0) return Math.round(sec);
        }

        if (seance.duree_reelle !== undefined && seance.duree_reelle !== null && Number(seance.duree_reelle) > 0) {
            return Math.round(Number(seance.duree_reelle));
        }

        if (Array.isArray(seance.items)) {
            let totalSec = 0;
            seance.items.forEach(item => {
                if (item && item.fait) {
                    if (item.duree_reelle_secondes !== undefined && item.duree_reelle_secondes !== null) {
                        totalSec += Math.max(0, Number(item.duree_reelle_secondes) || 0);
                    } else {
                        const prevuSec = Number(item.temps_prevu || 0) * 60;
                        const restantSec = Number(item.temps_restant || 0);
                        const reelSec = item.isOvertime ? (prevuSec + restantSec) : Math.max(0, prevuSec - restantSec);
                        totalSec += Math.max(0, reelSec);
                    }
                }
            });
            if (totalSec > 0) return Math.round(totalSec);
        }

        return 0;
    }

    /**
     * Retourne la durée réelle en minutes (arrondie à la minute la plus proche).
     */
    function calculateSessionDurationMinutes(seance, options) {
        const secs = calculateSessionDuration(seance, options);
        return Math.round(secs / 60);
    }

    /**
     * Formate une durée en minutes (ex: 45 min, 2h15, 0 min).
     */
    function formatDuree(minutes) {
        const m = Math.max(0, Math.round(Number(minutes) || 0));
        if (m === 0) return "0 min";
        if (m < 60) return `${m} min`;
        const h = Math.floor(m / 60);
        const mins = m % 60;
        return `${h}h${mins.toString().padStart(2, '0')}`;
    }

    /**
     * Retourne le lundi de la semaine à 00:00:00.000 local.
     */
    function getMonday(dateOrTimestamp) {
        const d = (dateOrTimestamp instanceof Date)
            ? new Date(dateOrTimestamp.getTime())
            : (dateOrTimestamp ? new Date(dateOrTimestamp) : new Date());

        const day = d.getDay(); // 0 = Dimanche, 1 = Lundi, ...
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    /**
     * Parse une date de séance en objet Date local valide.
     */
    function parseDateSeance(dateStr) {
        if (!dateStr) return null;
        if (dateStr instanceof Date) return dateStr;
        // Si chaîne ISO "YYYY-MM-DDTHH:mm:ss" ou "YYYY-MM-DD"
        if (typeof dateStr === 'string') {
            const parts = dateStr.split('T')[0].split('-');
            if (parts.length === 3) {
                const year = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const day = parseInt(parts[2], 10);
                if (dateStr.includes('T')) {
                    const timePart = dateStr.split('T')[1];
                    const timeParts = timePart.split(':');
                    const hours = parseInt(timeParts[0] || '0', 10);
                    const minutes = parseInt(timeParts[1] || '0', 10);
                    const seconds = parseInt(timeParts[2] || '0', 10);
                    return new Date(year, month, day, hours, minutes, seconds);
                }
                return new Date(year, month, day, 0, 0, 0);
            }
        }
        return new Date(dateStr);
    }

    /**
     * Retourne la relative majeure d'une tonalité mineure, ou la tonalité majeure normalisée.
     */
    function getRelativeMajorKey(tona) {
        if (!tona || typeof tona !== 'string') return null;
        let str = tona.trim();
        if (!str) return null;

        // Normalisation symboles ♭ et ♯
        str = str.replace(/♭/g, 'b').replace(/♯/g, '#');

        // Cas des notations abrégées jazz : "Am" -> "A mineur", "C-" -> "C mineur"
        str = str.replace(/^([A-Ga-g][b#]?)-$/, '$1 mineur');
        str = str.replace(/^([A-Ga-g][b#]?)m$/, '$1 mineur');

        // Remplacement anglais minor/major
        str = str.replace(/\bminor\b/gi, 'mineur').replace(/\bmajor\b/gi, 'majeur');

        // Si simple note fondamentale sans qualificatif (ex: "Eb", "C", "Bb")
        if (/^[A-Ga-g][b#]?$/.test(str)) {
            str = `${str} majeur`;
        }

        // Si mineur : mapping vers la relative majeure
        if (str.includes('mineur')) {
            const rootMatch = str.match(/^([A-Ga-g][b#]?)\s*mineur/i);
            if (rootMatch) {
                const root = rootMatch[1].charAt(0).toUpperCase() + rootMatch[1].slice(1);
                const mapping = {
                    "C": "Eb majeur",
                    "C#": "E majeur",
                    "Db": "E majeur",
                    "D": "F majeur",
                    "D#": "Gb majeur",
                    "Eb": "Gb majeur",
                    "E": "G majeur",
                    "F": "Ab majeur",
                    "F#": "A majeur",
                    "Gb": "A majeur",
                    "G": "Bb majeur",
                    "G#": "B majeur",
                    "Ab": "B majeur",
                    "A": "C majeur",
                    "A#": "Db majeur",
                    "Bb": "Db majeur",
                    "B": "D majeur"
                };
                return mapping[root] || `${root} mineur`;
            }
        }

        // Si majeur : capitaliser la première lettre
        const majMatch = str.match(/^([A-Ga-g][b#]?)\s*majeur/i);
        if (majMatch) {
            const root = majMatch[1].charAt(0).toUpperCase() + majMatch[1].slice(1);
            return `${root} majeur`;
        }

        return str;
    }

    /**
     * Calcule la distribution des séances par tonalité relative majeure.
     */
    function calculateTonalitiesDistribution(seances) {
        const list = Array.isArray(seances) ? seances : [];
        const terminees = list.filter(s => s && (s.statut === 'terminee' || s.statut === undefined));
        const counts = {};

        terminees.forEach(s => {
            if (s.tonalite_du_jour) {
                const rel = getRelativeMajorKey(s.tonalite_du_jour);
                if (rel) {
                    counts[rel] = (counts[rel] || 0) + 1;
                }
            }
        });

        return counts;
    }

    /**
     * Calcule la tonalité reine (la plus pratiquée en relative majeure).
     */
    function calculateReineTonalite(seances) {
        const counts = calculateTonalitiesDistribution(seances);
        let reine = null;
        let maxCount = 0;

        for (const [ton, count] of Object.entries(counts)) {
            if (count > maxCount) {
                maxCount = count;
                reine = ton;
            }
        }

        return reine;
    }

    /**
     * Calcule des pourcentages entiers exacts totalisant strictement 100%
     * par la méthode du plus fort reste (Largest Remainder).
     */
    function calculateExactPercentages(dataMap) {
        if (!dataMap || typeof dataMap !== 'object') {
            return { labels: [], percentages: [], formattedLabels: [] };
        }

        const entries = Object.entries(dataMap).filter(([_, val]) => Number(val) > 0);
        if (entries.length === 0) {
            return { labels: [], percentages: [], formattedLabels: [] };
        }

        const total = entries.reduce((sum, [_, val]) => sum + Number(val), 0);
        if (total === 0) {
            const labels = entries.map(([k]) => k);
            return {
                labels,
                percentages: labels.map(() => 0),
                formattedLabels: labels.map(l => `${l} · 0%`)
            };
        }

        const items = entries.map(([label, val], index) => {
            const exactPct = (Number(val) / total) * 100;
            const floor = Math.floor(exactPct);
            const remainder = exactPct - floor;
            return { label, val, index, exactPct, floor, remainder };
        });

        const sumFloors = items.reduce((sum, item) => sum + item.floor, 0);
        let deficit = 100 - sumFloors;

        // Trier par plus fort reste décroissant
        const sorted = [...items].sort((a, b) => b.remainder - a.remainder);
        for (let i = 0; i < deficit && i < sorted.length; i++) {
            sorted[i].floor += 1;
        }

        // Réordonner selon l'ordre initial
        items.sort((a, b) => a.index - b.index);

        const labels = items.map(it => it.label);
        const percentages = items.map(it => it.floor);
        const formattedLabels = items.map(it => `${it.label} · ${it.floor}%`);

        return {
            labels,
            percentages,
            formattedLabels
        };
    }

    /**
     * Palettes de catégories de jazz aux teintes distinctes et élégantes,
     * alternant systématiquement teintes chaudes et froides pour garantir
     * qu'aucun segment adjacent ne prête à confusion.
     */
    const JAZZ_CATEGORY_PALETTE = [
        '#e3a24a', // 1. Ambre jazz chaud (doré/orangé lumineux)
        '#3d828a', // 2. Bleu pétrole / Canard feutré (froid, contraste direct avec l'ambre)
        '#d69e46', // 3. Ocre jaune / Moutarde chaude
        '#9a6288', // 4. Prune / Améthyste feutré (violacé raffiné)
        '#8da868', // 5. Vert sauge franc (végétal distinct)
        '#cc6a4e', // 6. Terracotta / Brique chaude (rouge-brun)
        '#5c94a6', // 7. Ardoise claire / Bleu acier
        '#c47953'  // 8. Cuivre / Argile
    ];

    const JAZZ_CATEGORY_PALETTE_LIGHT = [
        '#c2782b', // 1. Ambre foncé / Caramel chaud
        '#256870', // 2. Canard profond
        '#9b6b28', // 3. Ocre tabac
        '#7c3f68', // 4. Prune profonde
        '#557d38', // 5. Vert mousse
        '#b8432a', // 6. Brique / Terracotta soutenu
        '#395b77', // 7. Bleu nuit / Ardoise
        '#874136'  // 8. Marron chaud
    ];

    /**
     * Retourne une palette contrastée pour un nombre de catégories donné.
     */
    function getCategoryPalette(count, isLight = false) {
        const base = isLight ? JAZZ_CATEGORY_PALETTE_LIGHT : JAZZ_CATEGORY_PALETTE;
        const total = Math.max(1, count || 1);
        if (total <= base.length) {
            return base.slice(0, total);
        }
        const res = [];
        for (let i = 0; i < total; i++) {
            res.push(base[i % base.length]);
        }
        return res;
    }

    /**
     * Sélectionne une palette contrastée en intercalant teintes chaudes/froides
     * pour que les parts adjacentes du camembert ne se confondent jamais.
     */
    function getContrastingPalette(basePalette, count, isLight = false) {
        if (!Array.isArray(basePalette) || basePalette.length < 4) {
            return getCategoryPalette(count, isLight);
        }

        const src = basePalette;
        const totalReq = Math.max(1, count || 1);

        if (src.length < totalReq) {
            const res = [];
            for (let i = 0; i < totalReq; i++) {
                res.push(src[i % src.length]);
            }
            return res;
        }

        // Si le nuancier passé est suffisant, intercaler [0, milieu, 1, milieu+1, ...]
        const result = [];
        const step = Math.floor(src.length / 2);
        for (let i = 0; i < totalReq; i++) {
            const index = (i % 2 === 0)
                ? (Math.floor(i / 2)) % src.length
                : (step + Math.floor(i / 2)) % src.length;
            result.push(src[index]);
        }

        if (result.length > 2 && result[result.length - 1] === result[0]) {
            const temp = result[result.length - 1];
            result[result.length - 1] = result[result.length - 2];
            result[result.length - 2] = temp;
        }

        return result;
    }

    /**
     * Plugin Chart.js affichant directement les étiquettes "Catégorie · XX%"
     * sur chaque part ET les détails dynamiques dans le centre évidé du doughnut,
     * éliminant 100% des collisions et s'adaptant parfaitement aux thèmes clairs/sombres.
     */
    function createCategoryDoughnutPlugin(pluginOptions) {
        const defaultOpts = pluginOptions || {};
        return {
            id: 'categoryDoughnutLabels',
            afterDraw(chart) {
                if (chart.config.type !== 'doughnut' && chart.config.type !== 'pie') return;

                const meta = chart.getDatasetMeta(0);
                if (!meta || !meta.data || meta.data.length === 0) return;

                const dataset = chart.data.datasets[0];
                if (!dataset || !dataset.data || dataset.data.length === 0) return;

                const chartPluginOpts = (chart.config && chart.config.options && chart.config.options.plugins && chart.config.options.plugins.categoryDoughnutLabels) || {};
                const opts = Object.assign({}, defaultOpts, chartPluginOpts);

                let textColor = opts.textColor;
                let textMuted = opts.textMutedColor;
                let textSecondary = opts.textSecondaryColor;
                let isLight = opts.isLight;

                if (typeof window !== 'undefined' && (!textColor || !textMuted || !textSecondary || isLight === undefined)) {
                    try {
                        const rootElem = (chart.canvas && chart.canvas.ownerDocument) ? chart.canvas.ownerDocument.documentElement : document.documentElement;
                        const style = window.getComputedStyle(rootElem);
                        if (!textColor) textColor = style.getPropertyValue('--text-primary').trim();
                        if (!textMuted) textMuted = style.getPropertyValue('--text-muted').trim();
                        if (!textSecondary) textSecondary = style.getPropertyValue('--accent-secondary').trim();
                        if (isLight === undefined) {
                            const theme = rootElem.getAttribute('data-theme');
                            isLight = (theme === 'clair' || theme === 'creme');
                        }
                    } catch (e) { }
                }

                textColor = textColor || (isLight ? '#2d2325' : '#f3e8d8');
                textMuted = textMuted || (isLight ? '#6b575d' : '#dbc8ae');
                textSecondary = textSecondary || (isLight ? '#745863' : '#9aae7c');

                const centerTitleColor = opts.centerTitleColor || (isLight ? textSecondary : textColor);
                const centerHoursColor = opts.centerHoursColor || textColor;
                const centerTotalColor = opts.centerTotalColor || textMuted;

                const formattedLabels = chart.data.formattedLabels || [];
                const labels = chart.data.labels || [];
                const durations = chart.data.durationsFormatted || [];
                const ctx = chart.ctx;
                const chartArea = chart.chartArea;
                if (!chartArea) return;

                const centerX = (chartArea.left + chartArea.right) / 2;
                const centerY = (chartArea.top + chartArea.bottom) / 2;

                ctx.save();

                // Détection de l'élément actif / survolé par Chart.js
                const activeElements = (typeof chart.getActiveElements === 'function')
                    ? chart.getActiveElements()
                    : [];
                const activeIndex = (activeElements && activeElements.length > 0)
                    ? activeElements[0].index
                    : null;

                const firstArc = meta.data[0];
                const innerRadius = firstArc ? firstArc.innerRadius : 60;

                // 1. DESSIN DU CENTRE DU DOUGHNUT (Information claire et sans aucun overlap, adaptée au thème)
                if (innerRadius >= 30) {
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    if (activeIndex !== null && dataset.data[activeIndex] !== undefined) {
                        // ÉTAT SURVOL : Nom de catégorie + Durée & Pourcentage
                        const catName = labels[activeIndex] || '';
                        const dur = durations[activeIndex] || '';
                        const rawPct = formattedLabels[activeIndex] ? formattedLabels[activeIndex].split('·')[1]?.trim() : '';
                        const sliceColor = (Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[activeIndex] : null) || (isLight ? '#c2782b' : '#e3a24a');

                        // Titre catégorie en gras avec la couleur adaptée au thème (couleur secondaire en clair)
                        ctx.font = 'bold 16px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                        ctx.fillStyle = centerTitleColor;
                        ctx.fillText(catName, centerX, centerY - 11);

                        // Durée et pourcentage en couleur de la tranche
                        ctx.font = '600 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                        ctx.fillStyle = sliceColor;
                        const detailText = dur ? `${dur} (${rawPct})` : rawPct;
                        ctx.fillText(detailText, centerX, centerY + 11);
                    } else {
                        // ÉTAT REPOS : Total de la période
                        const totalHoursText = chart.data.totalHoursFormatted ? `${chart.data.totalHoursFormatted} h` : '';

                        ctx.font = '700 10px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                        ctx.fillStyle = centerTotalColor;
                        ctx.fillText('TOTAL', centerX, centerY - 10);

                        ctx.font = 'bold 18px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                        ctx.fillStyle = centerHoursColor;
                        ctx.fillText(totalHoursText, centerX, centerY + 10);
                    }
                }

                // 2. DESSIN DES ÉTIQUETTES STATIQUES SUR LES TRANCHES DU CAMEMBERT
                meta.data.forEach((arc, i) => {
                    const val = dataset.data[i];
                    if (!val || val <= 0) return;

                    const labelText = formattedLabels[i] || labels[i] || '';
                    if (!labelText) return;

                    const angle = (arc.startAngle + arc.endAngle) / 2;
                    const arcSpread = arc.endAngle - arc.startAngle;

                    // Si l'arc fait moins de ~4% (0.22 rad), ne pas afficher pour éviter la surcharge
                    if (arcSpread < 0.22) return;

                    const midRadius = (arc.innerRadius + arc.outerRadius) / 2;
                    let x = arc.x + Math.cos(angle) * midRadius;
                    let y = arc.y + Math.sin(angle) * midRadius;

                    ctx.font = 'bold 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';

                    const textMetrics = ctx.measureText(labelText);
                    const textWidth = textMetrics.width;
                    const pillWidth = textWidth + 14;
                    const pillHeight = 20;

                    // Si l'arc est trop étroit en largeur pour la capsule, la décaler vers l'extérieur
                    if (arcSpread * midRadius < pillWidth + 6) {
                        const outerDist = arc.outerRadius + 14;
                        x = arc.x + Math.cos(angle) * outerDist;
                        y = arc.y + Math.sin(angle) * outerDist;
                    }

                    const pillX = x - pillWidth / 2;
                    const pillY = y - pillHeight / 2;
                    const radius = 6;
                    const isHovered = (i === activeIndex);

                    ctx.beginPath();
                    ctx.fillStyle = isHovered ? 'rgba(0, 0, 0, 0.95)' : 'rgba(17, 13, 10, 0.88)';
                    ctx.strokeStyle = isHovered ? (isLight ? '#ffffff' : '#f3e8d8') : 'rgba(255, 255, 255, 0.22)';
                    ctx.lineWidth = isHovered ? 1.5 : 1;

                    if (typeof ctx.roundRect === 'function') {
                        ctx.roundRect(pillX, pillY, pillWidth, pillHeight, radius);
                    } else {
                        ctx.rect(pillX, pillY, pillWidth, pillHeight);
                    }
                    ctx.fill();
                    ctx.stroke();

                    ctx.fillStyle = isHovered ? '#ffffff' : '#f3e8d8';
                    ctx.fillText(labelText, x, y);
                });

                ctx.restore();
            }
        };
    }

    /**
     * Formate une date en chaîne "YYYY-MM-DD" selon l'heure locale.
     */
    function toLocalDateKey(d) {
        if (!d || !(d instanceof Date) || isNaN(d.getTime())) return null;
        const year = d.getFullYear();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Calcule la progression vers l'objectif hebdomadaire.
     * Si goalHours est 0, null ou non défini, l'objectif est inactif (hasGoal: false).
     */
    function calculateWeeklyGoal(weeklyMinutes, goalHours) {
        const hours = (goalHours !== null && goalHours !== undefined) ? Number(goalHours) : 0;
        const currentMins = Math.max(0, Math.round(Number(weeklyMinutes) || 0));

        if (hours <= 0 || isNaN(hours)) {
            return {
                hasGoal: false,
                goalHours: 0,
                goalMinutes: 0,
                weeklyMinutes: currentMins,
                percentage: 0,
                isCompleted: false,
                progressRatio: 0,
                formattedPercentage: '-- %'
            };
        }

        const goalMinutes = Math.round(hours * 60);
        const rawPercentage = Math.round((currentMins / goalMinutes) * 100);
        // Le pourcentage est plafonné à 100% au maximum (pas de dépassement affiché)
        const percentage = Math.min(100, rawPercentage);
        const progressRatio = Math.min(1.0, currentMins / goalMinutes);
        const isCompleted = currentMins >= goalMinutes;

        return {
            hasGoal: true,
            goalHours: hours,
            goalMinutes,
            weeklyMinutes: currentMins,
            percentage,
            rawPercentage,
            isCompleted,
            progressRatio,
            formattedPercentage: `${percentage} %`
        };
    }

    /**
     * Calcule les statistiques complètes de régularité (streak en cours, record historique,
     * grille des 30 derniers jours, jours actifs dans le mois).
     */
    function calculateStreakStats(seances, nowInput, options) {
        const opts = options || {};
        const now = (nowInput instanceof Date)
            ? new Date(nowInput.getTime())
            : (nowInput ? new Date(nowInput) : new Date());

        const list = Array.isArray(seances) ? seances : [];
        const terminees = list.filter(s => s && (s.statut === 'terminee' || s.statut === undefined));

        const activeDaysMap = {}; // "YYYY-MM-DD" -> { count, totalMinutes, seances }
        terminees.forEach(s => {
            const d = parseDateSeance(s.date_seance);
            const key = toLocalDateKey(d);
            if (!key) return;
            if (!activeDaysMap[key]) {
                activeDaysMap[key] = { count: 0, totalMinutes: 0, seances: [] };
            }
            const mins = calculateSessionDurationMinutes(s, opts);
            activeDaysMap[key].count++;
            activeDaysMap[key].totalMinutes += mins;
            activeDaysMap[key].seances.push(s);
        });

        const sortedDates = Object.keys(activeDaysMap).sort();
        const totalActiveDays = sortedDates.length;

        // 1. Calcul du record historique (maxStreak)
        let maxStreak = 0;
        let currentRun = 0;
        let prevDate = null;

        sortedDates.forEach(dateStr => {
            const [y, m, d] = dateStr.split('-').map(Number);
            const curDate = new Date(y, m - 1, d, 12, 0, 0);

            if (!prevDate) {
                currentRun = 1;
            } else {
                const diffMs = curDate.getTime() - prevDate.getTime();
                const diffDays = Math.round(diffMs / (24 * 3600 * 1000));
                if (diffDays === 1) {
                    currentRun++;
                } else {
                    currentRun = 1;
                }
            }
            if (currentRun > maxStreak) {
                maxStreak = currentRun;
            }
            prevDate = curDate;
        });

        // 2. Série en cours (currentStreak)
        const currentStreak = calculateStreak(terminees, now);
        if (currentStreak > maxStreak) {
            maxStreak = currentStreak;
        }

        // 3. Jours actifs ce mois-ci
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();
        let monthActiveDays = 0;
        sortedDates.forEach(dateStr => {
            const [y, m] = dateStr.split('-').map(Number);
            if (y === currentYear && (m - 1) === currentMonth) {
                monthActiveDays++;
            }
        });

        // 4. Les 30 derniers jours (du plus ancien à aujourd'hui)
        const last30Days = [];
        const locale = opts.locale || (typeof getLocaleCode === 'function' ? getLocaleCode() : 'fr-FR');
        for (let i = 29; i >= 0; i--) {
            const dayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i, 12, 0, 0);
            const dateKey = toLocalDateKey(dayDate);
            const hasPractice = Boolean(activeDaysMap[dateKey]);
            const dayStats = activeDaysMap[dateKey] || { count: 0, totalMinutes: 0 };

            last30Days.push({
                dateKey,
                date: dayDate,
                dayNum: dayDate.getDate(),
                dayName: dayDate.toLocaleDateString(locale, { weekday: 'narrow' }),
                dayShortName: dayDate.toLocaleDateString(locale, { weekday: 'short' }),
                hasPractice,
                isToday: (i === 0),
                totalMinutes: dayStats.totalMinutes,
                count: dayStats.count
            });
        }

        return {
            currentStreak,
            maxStreak,
            totalActiveDays,
            monthActiveDays,
            activeDaysMap,
            last30Days
        };
    }

    /**
     * Calcule la grille mensuelle civile complète pour le Calendrier de pratique.
     * Aligne sur un découpage du Lundi au Dimanche avec padding des jours adjacents,
     * exactement comme dans Google Agenda.
     */
    function calculateMonthCalendar(seances, yearInput, monthInput, options) {
        const opts = options || {};
        const now = (opts.now instanceof Date)
            ? new Date(opts.now.getTime())
            : (opts.now ? new Date(opts.now) : new Date());

        const year = (typeof yearInput === 'number' && !isNaN(yearInput)) ? yearInput : now.getFullYear();
        const month = (typeof monthInput === 'number' && !isNaN(monthInput)) ? monthInput : now.getMonth();

        const list = Array.isArray(seances) ? seances : [];
        const terminees = list.filter(s => s && (s.statut === 'terminee' || s.statut === undefined));

        // Indexation des séances par date locale "YYYY-MM-DD"
        const activeDaysMap = {};
        terminees.forEach(s => {
            const d = parseDateSeance(s.date_seance);
            const key = toLocalDateKey(d);
            if (!key) return;
            if (!activeDaysMap[key]) {
                activeDaysMap[key] = { count: 0, totalMinutes: 0, seances: [] };
            }
            const mins = calculateSessionDurationMinutes(s, opts);
            activeDaysMap[key].count++;
            activeDaysMap[key].totalMinutes += mins;
            activeDaysMap[key].seances.push(s);
        });

        // Premier jour du mois civil
        const firstDayOfMonth = new Date(year, month, 1, 12, 0, 0);
        // Dernier jour du mois civil
        const lastDayOfMonth = new Date(year, month + 1, 0, 12, 0, 0);
        const daysInMonth = lastDayOfMonth.getDate();

        // Jour de la semaine du 1er du mois (0 = Dimanche, 1 = Lundi...)
        const dayOfWeek1 = firstDayOfMonth.getDay();
        const mondayOffset = (dayOfWeek1 === 0 ? 6 : dayOfWeek1 - 1);

        // Premier jour affiché dans la grille (lundi de la première semaine)
        const startDate = new Date(year, month, 1 - mondayOffset, 12, 0, 0);

        // Dernier jour du mois : quel jour de la semaine ?
        const dayOfWeekLast = lastDayOfMonth.getDay();
        const sundayOffset = (dayOfWeekLast === 0 ? 0 : 7 - dayOfWeekLast);

        // Dernier jour affiché dans la grille (dimanche de la dernière semaine)
        const endDate = new Date(year, month, daysInMonth + sundayOffset, 12, 0, 0);

        const locale = opts.locale || (typeof getLocaleCode === 'function' ? getLocaleCode() : 'fr-FR');
        const isEnglish = locale.startsWith('en');

        // Intitulé du mois : ex. "Octobre 2026"
        const rawMonthTitle = firstDayOfMonth.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
        const monthTitle = rawMonthTitle.charAt(0).toUpperCase() + rawMonthTitle.slice(1);

        // Jours de la semaine courts (L, M, M, J, V, S, D ou M, T, W, T, F, S, S)
        const weekdays = isEnglish
            ? ['M', 'T', 'W', 'T', 'F', 'S', 'S']
            : ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

        const days = [];
        let monthActiveDays = 0;
        let cur = new Date(startDate.getTime());

        const todayKey = toLocalDateKey(now);

        while (cur <= endDate) {
            const dateKey = toLocalDateKey(cur);
            const curYear = cur.getFullYear();
            const curMonth = cur.getMonth();
            const isCurrentMonth = (curYear === year && curMonth === month);
            const isToday = (dateKey === todayKey);

            const dayStats = activeDaysMap[dateKey] || { count: 0, totalMinutes: 0 };
            const hasPractice = Boolean(dayStats.count > 0);

            if (isCurrentMonth && hasPractice) {
                monthActiveDays++;
            }

            days.push({
                dateKey,
                date: new Date(cur.getTime()),
                dayNum: cur.getDate(),
                isCurrentMonth,
                isToday,
                hasPractice,
                totalMinutes: dayStats.totalMinutes,
                sessionCount: dayStats.count
            });

            cur.setDate(cur.getDate() + 1);
        }

        return {
            year,
            month,
            monthTitle,
            daysInMonth,
            monthActiveDays,
            weekdays,
            days,
            activeRatioFormatted: `${monthActiveDays} / ${daysInMonth} j`
        };
    }

    /**
     * Calcule la série de jours consécutifs de pratique (streak).
     * Si l'utilisateur n'a pas encore pratiqué aujourd'hui, la série d'hier est conservée.
     */
    function calculateStreak(seances, nowInput) {
        const list = Array.isArray(seances) ? seances : [];
        const terminees = list.filter(s => s && (s.statut === 'terminee' || s.statut === undefined));
        if (terminees.length === 0) return 0;

        const datesSet = new Set();
        terminees.forEach(s => {
            const d = parseDateSeance(s.date_seance);
            const key = toLocalDateKey(d);
            if (key) datesSet.add(key);
        });

        if (datesSet.size === 0) return 0;

        const now = (nowInput instanceof Date)
            ? new Date(nowInput.getTime())
            : (nowInput ? new Date(nowInput) : new Date());

        let streak = 0;
        let d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
        let dateStr = toLocalDateKey(d);

        // Si l'utilisateur n'a pas encore pratiqué aujourd'hui, tester à partir d'hier
        if (!datesSet.has(dateStr)) {
            d.setDate(d.getDate() - 1);
            dateStr = toLocalDateKey(d);
        }

        while (datesSet.has(dateStr)) {
            streak++;
            d.setDate(d.getDate() - 1);
            dateStr = toLocalDateKey(d);
        }

        return streak;
    }

    /**
     * Calcule le résumé global de l'historique pour les cartes de statistiques.
     */
    function calculateHistorySummary(seances, options) {
        const opts = options || {};
        const now = (opts.now instanceof Date)
            ? opts.now
            : (opts.now ? new Date(opts.now) : new Date());

        const lundiCetteSemaine = getMonday(now);
        const list = Array.isArray(seances) ? seances : [];
        const terminees = list.filter(s => s && (s.statut === 'terminee' || s.statut === undefined));

        let weeklyDurationSeconds = 0;
        let weeklyDurationMinutes = 0;
        let itemsFaits = 0;
        let itemsTotal = 0;

        terminees.forEach(s => {
            const dateSeance = parseDateSeance(s.date_seance);
            const durationSec = calculateSessionDuration(s, opts);
            const durationMin = Math.round(durationSec / 60);

            if (dateSeance && dateSeance >= lundiCetteSemaine) {
                weeklyDurationSeconds += durationSec;
                weeklyDurationMinutes += durationMin;
            }

            if (Array.isArray(s.items)) {
                s.items.forEach(item => {
                    itemsTotal++;
                    if (item && item.fait) itemsFaits++;
                });
            }
        });

        const completionRatePercent = itemsTotal === 0 ? 0 : Math.round((itemsFaits / itemsTotal) * 100);
        const streakDays = calculateStreak(terminees, now);
        const streakStats = calculateStreakStats(terminees, now, opts);
        const reineTonalite = calculateReineTonalite(terminees);
        const weeklyGoal = calculateWeeklyGoal(weeklyDurationMinutes, opts.weeklyGoalHours);

        return {
            totalSessions: terminees.length,
            weeklyDurationMinutes,
            weeklyDurationSeconds,
            weeklyDurationFormatted: formatDuree(weeklyDurationMinutes),
            completionRatePercent,
            streakDays,
            streakStats,
            reineTonalite,
            weeklyGoal
        };
    }

    /**
     * Calcule les données complètes pour le graphique selon la période demandée.
     * Garantit l'absence totale de divergence avec calculateHistorySummary.
     */
    function calculatePeriodChartData(seances, period, options) {
        const opts = options || {};
        const now = (opts.now instanceof Date)
            ? opts.now
            : (opts.now ? new Date(opts.now) : new Date());

        const list = Array.isArray(seances) ? seances : [];
        const terminees = list.filter(s => s && (s.statut === 'terminee' || s.statut === undefined));

        let startDate = new Date(0);
        let labels = [];
        let dataMap = {};

        const daysWeekLabels = (opts.i18n && opts.i18n.days_week) || ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        const weeksMonthLabels = (opts.i18n && opts.i18n.weeks_month) || ['Semaine 1', 'Semaine 2', 'Semaine 3', 'Semaine 4', 'Semaine 5'];
        const monthsYearLabels = (opts.i18n && opts.i18n.months_year) || ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc'];

        if (period === 'semaine') {
            startDate = getMonday(now);
            labels = [...daysWeekLabels];
            labels.forEach(l => { dataMap[l] = 0; });
        } else if (period === 'mois') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
            labels = [...weeksMonthLabels];
            labels.forEach(l => { dataMap[l] = 0; });
        } else if (period === 'annee') {
            startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0);
            labels = [...monthsYearLabels];
            labels.forEach(l => { dataMap[l] = 0; });
        } else {
            // 'total' : regroupement par années rencontrées
            startDate = new Date(0);
        }

        let totalMinutes = 0;
        const tonalitiesMap = {};
        const categoriesMap = {};

        terminees.forEach(s => {
            const dateSeance = parseDateSeance(s.date_seance);
            if (!dateSeance) return;

            if (dateSeance >= startDate) {
                const sessionMins = calculateSessionDurationMinutes(s, opts);
                totalMinutes += sessionMins;

                if (Array.isArray(s.items)) {
                    s.items.forEach(item => {
                        if (item && item.fait && item.categorie) {
                            let itemSec = 0;
                            if (item.duree_reelle_secondes !== undefined && item.duree_reelle_secondes !== null) {
                                itemSec = Math.max(0, Number(item.duree_reelle_secondes) || 0);
                            } else {
                                const prevuSec = Number(item.temps_prevu || 0) * 60;
                                const restantSec = Number(item.temps_restant || 0);
                                const reelSec = item.isOvertime ? (prevuSec + restantSec) : Math.max(0, prevuSec - restantSec);
                                itemSec = Math.max(0, reelSec);
                            }
                            const itemMin = Math.round(itemSec / 60);
                            categoriesMap[item.categorie] = (categoriesMap[item.categorie] || 0) + itemMin;
                        }
                    });
                }

                if (s.tonalite_du_jour) {
                    const rel = getRelativeMajorKey(s.tonalite_du_jour);
                    if (rel) {
                        tonalitiesMap[rel] = (tonalitiesMap[rel] || 0) + 1;
                    }
                }

                if (period === 'semaine') {
                    const day = dateSeance.getDay();
                    const idx = day === 0 ? 6 : day - 1; // 0 (dimanche) -> 6, 1 (lundi) -> 0
                    const label = labels[idx];
                    if (label) dataMap[label] = (dataMap[label] || 0) + sessionMins;
                } else if (period === 'mois') {
                    const dateNum = dateSeance.getDate();
                    let weekIdx = Math.floor((dateNum - 1) / 7);
                    if (weekIdx > 4) weekIdx = 4;
                    const label = labels[weekIdx];
                    if (label) dataMap[label] = (dataMap[label] || 0) + sessionMins;
                } else if (period === 'annee') {
                    const m = dateSeance.getMonth();
                    const label = labels[m];
                    if (label) dataMap[label] = (dataMap[label] || 0) + sessionMins;
                } else {
                    // total
                    const yr = dateSeance.getFullYear().toString();
                    if (!labels.includes(yr)) {
                        labels.push(yr);
                        dataMap[yr] = 0;
                    }
                    dataMap[yr] = (dataMap[yr] || 0) + sessionMins;
                }
            }
        });

        if (period === 'total') {
            labels.sort();
        }

        const dataMinutes = labels.map(l => dataMap[l] || 0);
        const dataHours = dataMinutes.map(m => parseFloat((m / 60).toFixed(1)));
        const totalHoursFormatted = (totalMinutes / 60).toFixed(1);

        const tonalitiesLabels = Object.keys(tonalitiesMap);
        const tonalitiesCounts = tonalitiesLabels.map(l => tonalitiesMap[l]);

        const categoriesPercentages = calculateExactPercentages(categoriesMap);
        const categoriesLabels = categoriesPercentages.labels;
        const categoriesDataMinutes = categoriesLabels.map(l => categoriesMap[l] || 0);

        return {
            period,
            labels,
            dataMinutes,
            dataHours,
            totalMinutes,
            totalHoursFormatted,
            categories: {
                labels: categoriesLabels,
                dataMinutes: categoriesDataMinutes,
                percentages: categoriesPercentages.percentages,
                formattedLabels: categoriesPercentages.formattedLabels,
                map: categoriesMap
            },
            tonalities: {
                labels: tonalitiesLabels,
                counts: tonalitiesCounts,
                map: tonalitiesMap
            }
        };
    }

    return {
        name: 'history-analytics',
        calculateSessionDuration,
        calculateSessionDurationMinutes,
        formatDuree,
        getMonday,
        parseDateSeance,
        toLocalDateKey,
        getRelativeMajorKey,
        calculateTonalitiesDistribution,
        calculateReineTonalite,
        calculateStreak,
        calculateStreakStats,
        calculateMonthCalendar,
        calculateWeeklyGoal,
        calculateExactPercentages,
        getCategoryPalette,
        getContrastingPalette,
        createCategoryDoughnutPlugin,
        calculateHistorySummary,
        calculatePeriodChartData
    };
}));
