// Module 6 : Système Hôte & Intégration Android (system-host)
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SystemHost = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    return {
        name: 'system-host'
    };
}));
