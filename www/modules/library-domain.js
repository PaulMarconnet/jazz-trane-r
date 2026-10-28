// Module 1 : Domaine Bibliothèque, Setlists, Attributs d'item & Ingestion (library-domain)
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.LibraryDomain = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    return {
        name: 'library-domain'
    };
}));
