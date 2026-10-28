// Module 5 : Persistance Locale & Archives (storage-repo)
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.StorageRepo = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    return {
        name: 'storage-repo'
    };
}));
