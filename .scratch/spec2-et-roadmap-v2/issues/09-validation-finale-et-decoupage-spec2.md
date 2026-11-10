# Assemblage final de la Spec 2 et découpage en tickets d'implémentation

Type: grilling
Status: open
Blocked by: 03, 05, 06, 07, 08

## Question

Une fois résolus :
- [Audit du monolithe script.js, migration vers Vite et résorption de la dette Spec 1](03-audit-architecture-vite-et-dette-spec1.md),
- [Prototype UI du Lecteur de Grille vectoriel et de l'Éditeur rapide](05-prototype-ui-lecteur-et-editeur-de-grille.md),
- [Prototype UI et Logique du Métronome Inner Clock, du Drone harmonique et du Studio Call & Response](06-prototype-outils-audio-jazz-shed.md),
- [Spécification du format Pack, des Plans multi-séances et du flux Daily/Weekly](07-format-pack-plan-et-flux-daily-github.md),
- [Contrat de données amont pour la Partition Dynamique et la banque d'accords Ear Training](08-contrat-inter-specs-partition-dynamique-et-ear-training.md),

rédiger et valider avec l'utilisateur :
1. L'ADR `docs/adr/0003-outillage-vite-es-modules-local-first.md` faisant évoluer l'[ADR-0001](../../../docs/adr/0001-modules-vanilla-sans-bundler.md).
2. La spécification complète de la **Spec 2** dans `.scratch/spec2-grilles-audio-packs/spec.md` et son découpage en tickets d'implémentation atomiques (`01` à `NN`) prêts pour le développement TDD.
