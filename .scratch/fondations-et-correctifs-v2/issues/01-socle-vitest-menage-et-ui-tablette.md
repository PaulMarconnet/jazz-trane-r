# 01: Socle Vitest, Ménage du dépôt & Finitions UI Tablette

**What to build:** Mettre en place le runner de tests unitaires `vitest` et l'architecture des modules autonomes sans bundler ([ADR-0001](../../../docs/adr/0001-modules-vanilla-sans-bundler.md)), nettoyer le dépôt des fichiers et dépendances obsolètes, corriger le cache hors-ligne du Service Worker, et livrer les trois correctifs d'ergonomie tactile et visuelle sur tablette (suppression du survol persistant « sticky hover » après un tap tactile, largeur tabulaire fixe sur tous les badges de temps pour empêcher tout tremblement, et harmonisation typographique des titres de **Cadres** internes dans les modales Métronome, Dictaphone, Lecteur Audio et Trieur Express).

**Blocked by:** None (can start immediately)

**Recommended model:** **Gemini 3.8 Flash (Medium)** *(ou **Gemini 4 Argon (Low)**)* — Tâche directe de configuration, nettoyage et CSS ciblé, idéale pour économiser tes crédits.

**Status:** ready-for-agent

- [ ] `vitest` est installé et configuré pour exécuter les tests des modules dans `www/modules/` via `npm test`, avec un premier test de fumée passant au vert.
- [ ] Les fichiers de démonstration HTML sont déplacés hors de `www/` (vers la racine du dépôt) afin de ne plus être embarqués dans l'APK Android, et la dépendance inutilisée `capacitor-plugin-send-intent` est retirée.
- [ ] Le Service Worker met bien en cache le fichier d'internationalisation ainsi que les nouveaux modules, et les appels redondants dans le gestionnaire de clic global des modales sont nettoyés.
- [ ] Sur écran tactile (tablette), toucher un bouton (ex. *Ajouter à la séance*) déclenche un retour `:active` net mais ne laisse aucun état `:hover` ou focus lumineux collé après le tap (`@media (hover: hover) and (pointer: fine)`).
- [ ] Tous les badges de durée et chronomètres (total de séance programmée, durée de séance en direct, badges de temps des exercices) utilisent `font-variant-numeric: tabular-nums` et une largeur minimale fixe de sorte que les éléments adjacents ne bougent jamais quand le temps défile.
- [ ] Les titres des **Cadres** et sous-sections internes du Métronome, du Dictaphone, du Lecteur Audio et du Trieur Express respectent le style harmonisé en petites majuscules espacées et couleur `--text-muted`.
