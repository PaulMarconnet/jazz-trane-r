import { describe, it, expect, beforeEach } from 'vitest';
import StorageRepo from '../www/modules/storage-repo.js';
import LibraryDomain from '../www/modules/library-domain.js';

let repo, files;
beforeEach(() => {
    files = StorageRepo.createMemoryFileAdapter();
    repo = StorageRepo.createRepo({
        store: StorageRepo.createMemoryStoreAdapter(),
        files,
        domain: LibraryDomain
    });
});

describe('storage-repo : CRUD', () => {
    it('cree, liste, met a jour et supprime un item', async () => {
        const c = await repo.create('vocabulaire', { titre: 'Autumn Leaves', type_item: 'Morceaux' });
        expect((await repo.list('vocabulaire'))).toHaveLength(1);
        const u = await repo.update('vocabulaire', c.id, { titre: 'Autumn Leaves 2' });
        expect(u.titre).toBe('Autumn Leaves 2');
        await repo.remove('vocabulaire', c.id);
        expect(await repo.list('vocabulaire')).toHaveLength(0);
    });

    it('pratiquer / depratiquer / favori', async () => {
        const c = await repo.create('vocabulaire', { titre: 'X', type_item: 'Licks' });
        await repo.practice(c.id); await repo.practice(c.id);
        expect((await repo.getById('vocabulaire', c.id)).stats.nb_pratiques).toBe(2);
        await repo.unpractice(c.id);
        expect((await repo.getById('vocabulaire', c.id)).stats.nb_pratiques).toBe(1);
        expect(await repo.toggleFavorite(c.id)).toEqual({ favori: true });
    });

    it('termine une seance et reset un store', async () => {
        const s = await repo.create('seances', { date_seance: '2026-01-01', items: [] });
        const done = await repo.finishSession(s.id, { duree: 120 });
        expect(done).toMatchObject({ statut: 'terminee', duree_reelle: 120 });
        await repo.reset('seances');
        expect(await repo.list('seances')).toHaveLength(0);
    });
});

describe('storage-repo : sauvegarde / restauration', () => {
    it('restaure un zip avec un bilan chiffre exact', async () => {
        const a = await repo.create('vocabulaire', { titre: 'A', type_item: 'Morceaux', fichier_image: ['p.pdf'] });
        await repo.create('vocabulaire', { titre: 'B', type_item: 'Licks' });
        await repo.create('routines', { nom: 'R' });
        await repo.create('seances', { items: [] });
        await files.write('p.pdf', 'data:application/pdf;base64,QUJD');

        const backup = await repo.buildBackup({});
        const media = await repo.collectMedia(backup);
        expect(media).toEqual({ 'p.pdf': 'QUJD' });
        expect(a.id).toBeDefined();

        const files2 = StorageRepo.createMemoryFileAdapter();
        const repo2 = StorageRepo.createRepo({ store: StorageRepo.createMemoryStoreAdapter(), files: files2, domain: LibraryDomain });
        const bilan = await repo2.restoreBackup(JSON.parse(JSON.stringify(backup)), media);
        expect(bilan).toEqual({ itemsRestaures: 2, mediasRestaures: 1, seancesRestaurees: 1, routinesRestaurees: 1 });
        expect(await files2.read('p.pdf')).toBe('data:application/pdf;base64,QUJD');
    });

    it('un backup json seul ne restaure aucun media', async () => {
        await repo.create('vocabulaire', { titre: 'A', type_item: 'Morceaux' });
        const bilan = await repo.restoreBackup(await repo.buildBackup({}));
        expect(bilan.mediasRestaures).toBe(0);
        expect(bilan.itemsRestaures).toBe(1);
        expect(await repo.list('vocabulaire')).toHaveLength(1);
    });
});
