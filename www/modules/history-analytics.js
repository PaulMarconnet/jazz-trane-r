// Module 3 : Analytique d'Historique (history-analytics)
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.HistoryAnalytics = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    return {
        name: 'history-analytics'
    };
}));
