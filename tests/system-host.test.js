import { describe, it, expect } from 'vitest';
import SystemHost from '../www/modules/system-host.js';

function setup({ visibility = 'visible', enabled = true } = {}) {
    const state = { visibility, enabled };
    const calls = { scheduled: [], cancelled: [], saved: [], settings: 0 };
    const adapter = {
        scheduleNotification: async (n) => { calls.scheduled.push(n); },
        cancelNotification: async (id) => { calls.cancelled.push(id); },
        saveFile: async (f) => { calls.saved.push(f); return 'ok'; },
        checkMicrophone: async () => state.micGranted === true,
        requestMicrophone: async () => state.micResult,
        openAppSettings: async () => { calls.settings++; }
    };
    const host = SystemHost.createHost({
        adapter,
        getVisibility: () => state.visibility,
        isNotificationsEnabled: () => state.enabled
    });
    return { state, calls, host };
}
const spec = { title: 'Fin', body: 'Temps ecoule', at: new Date(Date.now() + 1000) };

describe('system-host : notifications', () => {
    it('n\'emet aucune notification quand l\'app est visible', async () => {
        const { host, calls } = setup({ visibility: 'visible' });
        expect(await host.armTimerNotification(spec)).toBe(false);
        expect(calls.scheduled).toHaveLength(0);
    });

    it('n\'emet aucune notification quand l\'interrupteur est OFF', async () => {
        const { host, calls, state } = setup({ visibility: 'hidden', enabled: false });
        await host.armTimerNotification(spec);
        await host.handleVisibilityChange('hidden');
        expect(calls.scheduled).toHaveLength(0);
        expect(state.enabled).toBe(false);
    });

    it('programme en arriere-plan avec id unique 1000, couleur et icone dediees', async () => {
        const { host, calls } = setup({ visibility: 'hidden' });
        await host.armTimerNotification(spec);
        expect(calls.scheduled[0]).toMatchObject({ id: 1000, color: '#e3a24a', smallIcon: 'ic_stat_jazz_traner' });
    });

    it('programme au passage en arriere-plan puis efface au retour', async () => {
        const { host, calls, state } = setup({ visibility: 'visible' });
        await host.armTimerNotification(spec);
        state.visibility = 'hidden';
        await host.handleVisibilityChange('hidden');
        expect(calls.scheduled).toHaveLength(1);
        state.visibility = 'visible';
        await host.handleVisibilityChange('visible');
        expect(calls.cancelled).toContain(1000);
    });

    it('ne s\'empile jamais : re-armer annule la precedente', async () => {
        const { host, calls } = setup({ visibility: 'hidden' });
        await host.armTimerNotification(spec);
        await host.armTimerNotification(spec);
        expect(calls.scheduled.every(n => n.id === 1000)).toBe(true);
        expect(calls.cancelled).toHaveLength(1);
    });

    it('invalide un minuteur expire sans le reprogrammer lors d\'un passage en arriere-plan', async () => {
        const { host, calls, state } = setup({ visibility: 'visible' });
        const expired = { title: 'Fin', body: 'Expire', at: new Date(Date.now() - 5000) };
        expect(await host.armTimerNotification(expired)).toBe(false);
        state.visibility = 'hidden';
        await host.handleVisibilityChange('hidden');
        expect(calls.scheduled).toHaveLength(0);
    });
});

describe('system-host : sauvegarde et micro', () => {
    it('delegue l\'enregistrement a l\'adapter', async () => {
        const { host, calls } = setup();
        await host.saveBackupFile('a.json', 'blob', 'application/json');
        expect(calls.saved[0]).toEqual({ name: 'a.json', blob: 'blob', mime: 'application/json' });
    });

    it('micro : accorde / refuse / refus definitif', async () => {
        const a = setup(); a.state.micGranted = true;
        expect(await a.host.ensureMicrophone()).toBe('granted');
        const b = setup(); b.state.micResult = 'granted';
        expect(await b.host.ensureMicrophone()).toBe('granted');
        const c = setup(); c.state.micResult = 'denied';
        expect(await c.host.ensureMicrophone()).toBe('denied');
        const d = setup(); d.state.micResult = 'permanently_denied';
        expect(await d.host.ensureMicrophone()).toBe('permanently_denied');
        await d.host.openAppSettings();
        expect(d.calls.settings).toBe(1);
    });
});
