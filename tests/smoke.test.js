import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import LibraryDomain from '../www/modules/library-domain.js';
import SessionTimer from '../www/modules/session-timer.js';
import HistoryAnalytics from '../www/modules/history-analytics.js';
import ScoreNavigation from '../www/modules/score-navigation.js';
import StorageRepo from '../www/modules/storage-repo.js';
import SystemHost from '../www/modules/system-host.js';

describe('Modules Vanilla sans Bundler (ADR-0001) - Smoke Tests', () => {
    it('charge les 6 deep modules de www/modules/ sous Node via module.exports', () => {
        expect(LibraryDomain).toBeDefined();
        expect(LibraryDomain.name).toBe('library-domain');

        expect(SessionTimer).toBeDefined();
        expect(SessionTimer.name).toBe('session-timer');

        expect(HistoryAnalytics).toBeDefined();
        expect(HistoryAnalytics.name).toBe('history-analytics');

        expect(ScoreNavigation).toBeDefined();
        expect(ScoreNavigation.name).toBe('score-navigation');

        expect(StorageRepo).toBeDefined();
        expect(StorageRepo.name).toBe('storage-repo');

        expect(SystemHost).toBeDefined();
        expect(SystemHost.name).toBe('system-host');
    });

    it('expose les 6 deep modules sur window dans un contexte navigateur sans bundler', () => {
        const fakeWindow = {};
        fakeWindow.window = fakeWindow;
        fakeWindow.self = fakeWindow;
        const context = vm.createContext(fakeWindow);

        const files = [
            'library-domain.js',
            'session-timer.js',
            'history-analytics.js',
            'score-navigation.js',
            'storage-repo.js',
            'system-host.js'
        ];

        for (const file of files) {
            const code = fs.readFileSync(path.join(__dirname, '../www/modules', file), 'utf8');
            vm.runInContext(code, context);
        }

        expect(fakeWindow.LibraryDomain).toBeDefined();
        expect(fakeWindow.SessionTimer).toBeDefined();
        expect(fakeWindow.HistoryAnalytics).toBeDefined();
        expect(fakeWindow.ScoreNavigation).toBeDefined();
        expect(fakeWindow.StorageRepo).toBeDefined();
        expect(fakeWindow.SystemHost).toBeDefined();
    });
});
