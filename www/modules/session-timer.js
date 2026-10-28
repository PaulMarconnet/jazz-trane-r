// Module 2 : Machine à États Temporelle de Séance (session-timer)
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SessionTimer = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    return {
        name: 'session-timer'
    };
}));
