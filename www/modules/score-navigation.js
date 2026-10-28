// Module 4 : Navigation du Lecteur de Partition & Double-Buffering PDF (score-navigation)
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.ScoreNavigation = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    return {
        name: 'score-navigation'
    };
}));
