// Module 6 : Systeme Hote & Integration Android (system-host)
(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.SystemHost = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const NOTIFICATION_ID = 1000;
    const ACCENT_COLOR = '#e3a24a';
    const CHANNEL_ID = 'timer_alerts';

    /**
     * @param {object} deps
     *   adapter : { scheduleNotification, cancelNotification, saveFile, checkMicrophone,
     *               requestMicrophone, openAppSettings }
     *   getVisibility : () => 'visible' | 'hidden'
     *   isNotificationsEnabled : () => boolean   (interrupteur ON/OFF des Parametres)
     */
    function createHost(deps) {
        const adapter = deps.adapter;
        const getVisibility = deps.getVisibility || (() => 'visible');
        const isEnabled = deps.isNotificationsEnabled || (() => true);
        let pending = null;   // minuteur arme, a programmer des le passage en arriere-plan
        let scheduled = false;

        function isExpired(spec) {
            if (!spec || !spec.at) return true;
            const time = spec.at instanceof Date ? spec.at.getTime() : new Date(spec.at).getTime();
            return isNaN(time) || time <= Date.now();
        }

        function canNotify() {
            return isEnabled() && getVisibility() !== 'visible' && !isExpired(pending);
        }

        async function schedule(spec) {
            await adapter.scheduleNotification({
                id: NOTIFICATION_ID,
                title: spec.title,
                body: spec.body,
                at: spec.at,
                color: ACCENT_COLOR,
                channelId: CHANNEL_ID,
                smallIcon: 'ic_stat_jazz_traner'
            });
            scheduled = true;
        }

        /** Arme la notification de fin de minuteur (id unique : remplace la precedente). */
        async function armTimerNotification(spec) {
            pending = spec || null;
            if (scheduled) { await adapter.cancelNotification(NOTIFICATION_ID); scheduled = false; }
            if (isExpired(pending)) { pending = null; return false; }
            if (pending && canNotify()) { await schedule(pending); return true; }
            return false;
        }

        async function disarmTimerNotification() {
            pending = null;
            if (scheduled) { await adapter.cancelNotification(NOTIFICATION_ID); scheduled = false; }
        }

        /** A appeler a chaque visibilitychange. */
        async function handleVisibilityChange(state) {
            if (state === 'visible') {
                if (scheduled) { await adapter.cancelNotification(NOTIFICATION_ID); scheduled = false; }
                if (isExpired(pending)) { pending = null; }
            } else if (pending && isEnabled() && !scheduled) {
                if (isExpired(pending)) {
                    pending = null;
                    return;
                }
                await schedule(pending);
            }
        }

        async function saveBackupFile(name, blob, mime) {
            return adapter.saveFile({ name, blob, mime });
        }

        /** 'granted' | 'denied' | 'permanently_denied' */
        async function ensureMicrophone() {
            if (!adapter.checkMicrophone) return 'granted';
            if (await adapter.checkMicrophone()) return 'granted';
            const r = await adapter.requestMicrophone();
            return r === 'granted' || r === true ? 'granted'
                : (r === 'permanently_denied' ? 'permanently_denied' : 'denied');
        }

        async function openAppSettings() {
            if (adapter.openAppSettings) await adapter.openAppSettings();
        }

        return {
            armTimerNotification, disarmTimerNotification, handleVisibilityChange,
            saveBackupFile, ensureMicrophone, openAppSettings
        };
    }

    return {
        name: 'system-host',
        createHost,
        NOTIFICATION_ID,
        ACCENT_COLOR,
        CHANNEL_ID
    };
}));
